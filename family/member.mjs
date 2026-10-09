// One member carried through a resync: a clone from the remote, a worktree on the day's branch,
// each pin moved and the member rebuilt as its pins.json says, a pull request merged once its
// check passes, and a release where the run needs one. Anything that needs a person's judgment
// throws Blocked, and the run holds what is downstream. A rerun is idempotent on what a pin's
// file holds, not on a branch name: a branch is chosen by walking past whatever a prior day's
// run already merged, a reused worktree is reset to what the branch actually holds before
// anything runs again, unless it holds work the run did not leave there, which blocks; and a
// dry run works its own throwaway branch so it never leaves a worktree a real run would mistake
// for its own. One run takes hundreds of steps across the family, so a download cut off or a
// render timed out under load is likely somewhere in it, and a failure like that passes when it
// is tried again where a real one fails twice: every command the run runs in a worktree, and the
// required checks of each pull request, get a second try before the member blocks, and each
// second try that passed is named in what the member returns.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { gh } from './gh.mjs';
import { KINDS } from './pins.mjs';
import { NON_PROPAGATING } from './graph.mjs';
import { commitMessage, listed, TRAILERS } from './words.mjs';
import { localPathOf } from './repositories.mjs';

export class Blocked extends Error {}

// The host an identity's url names, without `www.`, as the seat check in meta-model reads it.
const domainOf = (url) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
};
const identityUrl = (instance) => {
  const path = join(instance, 'model/identity.md');
  if (!existsSync(path)) return null;
  const front = readFileSync(path, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return front?.[1].match(/^url:\s*(\S+)\s*$/m)?.[1] ?? null;
};

// Who a resync commit is authored by. A re-pin, a re-sync and a release bump are the
// Implementer's, at the domain of the governing instance's identity url; the governing instance
// is found as conventions/hooks/commit-msg finds it, the member itself where it is one and
// otherwise its organization's mental-model at the local path the member's REPOSITORIES.md
// gives. Where that clone is missing the commit keeps the person's own name, and the note says so.
export function implementerOf(wt, repo) {
  let instance = wt;
  if (!existsSync(join(wt, '.companygraph/manifest.json'))) {
    const governing = `${repo.split('/')[0]}/mental-model`;
    const list = join(wt, 'conventions/REPOSITORIES.md');
    let path = existsSync(list) ? localPathOf(readFileSync(list, 'utf8'), governing) : null;
    if (path?.startsWith('~/')) path = join(homedir(), path.slice(2));
    if (!path || !existsSync(join(path, '.companygraph/manifest.json'))) {
      return { author: null, note: `no clone of ${governing}${path ? ` at ${path}` : ''}, so the commits carry the person's name` };
    }
    instance = path;
  }
  const domain = domainOf(identityUrl(instance) ?? '');
  if (!domain) return { author: null, note: `no identity url in ${instance}, so the commits carry the person's name` };
  return { author: `Implementer <implementer@${domain}>`, note: null };
}

const CHECK_LINE = /(robertblust\/conventions\/\.github\/workflows\/check\.yml@)[^\s'"]+/g;

export function realMember({
  root = process.env.FAMILY_ROOT || join(homedir(), 'git'),
  remote = process.env.FAMILY_REMOTE || 'https://github.com',
  dryRun = false,
  log = console.log,
  checkWait = 10,
  checkTries = 30,
  // The seconds a failed command waits before its second try.
  retryWait = 10,
  // Told the url of each pull request the run opens or takes on, the moment it has one, so a
  // run that stops before its record is written still knows the pull request as its own.
  onPull = () => {},
} = {}) {
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const pause = (seconds) => { if (seconds > 0) execFileSync('sleep', [String(seconds)]); };
  // Runs a command in a worktree, and once more after a pause when it fails; only a second
  // failure blocks, naming what each try said, and a second try that passed is added to retries.
  const attempt = (cwd, cmd) => {
    try {
      execFileSync('sh', ['-c', cmd], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
      return null;
    } catch (e) {
      return `${e.stdout ?? ''}${e.stderr ?? ''}`.trim().split('\n').slice(-5).join('\n');
    }
  };
  const sh = (cwd, cmd, retries) => {
    const first = attempt(cwd, cmd);
    if (first === null) return;
    pause(retryWait);
    const second = attempt(cwd, cmd);
    if (second !== null) {
      const tries = first || second ? `, first with:\n${first || 'nothing'}\nthen with:\n${second || 'nothing'}` : ', saying nothing either time';
      throw new Blocked(`\`${cmd}\` failed twice${tries}`);
    }
    const said = first.split('\n').filter(Boolean).at(-1);
    retries.push(`\`${cmd}\` failed once${said ? ` (${said})` : ''}, passed on retry`);
  };

  // Fast-forwards a clone's `main` to `origin/main`, the one rule the run holds it to whether it
  // is about to work or has just watched a pull request of its own merge: only when the clone is
  // on `main` and clean does it move, and otherwise it says why it left the clone alone.
  function fastForward(dir) {
    git(dir, 'fetch', '-q', 'origin');
    const branch = git(dir, 'rev-parse', '--abbrev-ref', 'HEAD');
    if (branch !== 'main') return `the clone was left alone on ${branch}`;
    if (git(dir, 'status', '--porcelain') !== '') return 'the clone was left alone with uncommitted changes';
    try {
      git(dir, 'merge', '-q', '--ff-only', 'origin/main');
      return null;
    } catch {
      return 'the clone could not fast-forward main';
    }
  }

  function clone(repo) {
    const dir = join(root, repo);
    if (!existsSync(dir)) {
      mkdirSync(dirname(dir), { recursive: true });
      git(root, 'clone', '-q', `${remote}/${repo}.git`, dir);
    }
    return { dir, note: fastForward(dir) };
  }

  function onRemote(dir, branch) {
    return git(dir, 'ls-remote', '--heads', 'origin', branch) !== '';
  }

  function freshWorktree(dir, wt, branch, base) {
    if (existsSync(wt)) {
      try {
        git(dir, 'worktree', 'remove', '--force', wt);
      } catch {
        rmSync(wt, { recursive: true, force: true });
        try {
          git(dir, 'worktree', 'prune', '-q');
        } catch {
          // nothing left to prune
        }
      }
    }
    git(dir, 'worktree', 'add', '-q', '-B', branch, wt, base);
  }

  // What a worktree holds when the run blocks in it: its commit and the tree of every file in it,
  // written beside the worktree's own git files. A rerun that finds the worktree holding exactly
  // that knows the leftovers are its own; anything else is work a person did there.
  const leftPath = (wt) => {
    const p = git(wt, 'rev-parse', '--git-path', 'resync-left');
    return isAbsolute(p) ? p : join(wt, p);
  };
  function snapshot(wt) {
    const index = `${leftPath(wt)}.index`;
    rmSync(index, { force: true });
    const env = { ...process.env, GIT_INDEX_FILE: index };
    const run = (...args) => execFileSync('git', args, { cwd: wt, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    try {
      run('add', '-A');
      return `${git(wt, 'rev-parse', 'HEAD')} ${run('write-tree')}`;
    } finally {
      rmSync(index, { force: true });
    }
  }
  function remember(wt) {
    try {
      writeFileSync(leftPath(wt), snapshot(wt));
    } catch {
      // without the note a rerun treats the leftovers as a person's and blocks, which is safe
    }
  }
  function leftByRun(wt) {
    const path = leftPath(wt);
    return existsSync(path) && readFileSync(path, 'utf8') === snapshot(wt);
  }
  const whileIn = (wt, fn) => {
    try {
      return fn();
    } catch (e) {
      if (existsSync(wt)) remember(wt);
      throw e;
    }
  };

  function worktree(repo, dir, branch) {
    const wt = join(root, `${repo}-${branch}`);
    const remote = onRemote(dir, branch);
    const base = remote ? `origin/${branch}` : 'origin/main';
    if (existsSync(wt)) {
      git(wt, 'fetch', '-q', 'origin');
      const dirty = git(wt, 'status', '--porcelain') !== '';
      const unpushed = git(wt, 'rev-list', 'HEAD', '--not', 'origin/main', ...(remote ? [`origin/${branch}`] : [])) !== '';
      if ((dirty || unpushed) && !leftByRun(wt)) {
        throw new Blocked(`${wt} holds work the run did not make; commit and push it to ${branch}, or remove the worktree, then run again`);
      }
      git(wt, 'reset', '-q', '--hard', base);
      git(wt, 'clean', '-q', '-fd');
      rmSync(leftPath(wt), { force: true });
      return wt;
    }
    git(dir, 'worktree', 'add', '-q', '-B', branch, wt, base);
    return wt;
  }

  function dryRunWorktree(repo, dir, base) {
    const branch = base.replace(/^resync-(vendored-)?/, 'dry-run-');
    const wt = join(root, `${repo}-${branch}`);
    freshWorktree(dir, wt, branch, 'origin/main');
    return { wt, branch };
  }

  function prepareWorktree(repo, dir, base) {
    if (dryRun) return dryRunWorktree(repo, dir, base);
    const branch = chooseBranch(repo, base);
    return { wt: worktree(repo, dir, branch), branch };
  }

  function identity(wt) {
    try {
      if (git(wt, 'config', 'user.email')) return;
    } catch {
      // git config exits 1 when the key is unset
    }
    throw new Blocked('no user.email in this clone, so nothing is committed under an address nobody chose');
  }

  // A fork may push a branch of the same name, and GitHub lists its pull request beside the
  // repository's own, so only a pull request from the repository itself is the run's.
  const existingPr = (repo, branch) => JSON.parse(gh(['pr', 'list', '--repo', repo, '--head', branch, '--state', 'all', '--json', 'number,state,url,mergeCommit,isCrossRepository']))
    .find((p) => !p.isCrossRepository) ?? null;

  function chooseBranch(repo, base) {
    for (let i = 1; ; i++) {
      const name = i === 1 ? base : `${base}-${i}`;
      const found = existingPr(repo, name);
      if (!found) return name;
      if (found.state === 'MERGED') continue;
      if (found.state === 'CLOSED') throw new Blocked(`pull request #${found.number} of ${repo} was closed by hand`);
      return name;
    }
  }

  const tailOf = (msg) => {
    const i = msg.indexOf(': ');
    return i < 0 ? msg : msg.slice(i + 2);
  };

  // The checks of a pull request that failed, and the workflow runs they belong to, read from
  // the run id each check's link names; a check whose link names no run cannot be rerun.
  function failingChecks(repo, number) {
    const checks = JSON.parse(gh(['pr', 'checks', String(number), '--repo', repo, '--required', '--json', 'name,bucket,link']));
    const failed = checks.filter((c) => c.bucket === 'fail');
    const runs = [...new Set(failed.map((c) => c.link?.match(/\/runs\/(\d+)/)?.[1]).filter(Boolean))];
    return { names: [...new Set(failed.map((c) => c.name))], runs };
  }

  // GitHub queues a rerun, so a read made at once can still show the failure from before it. The
  // run waits until none of the rerun checks reads `fail`, a bounded number of times, and only
  // then watches the checks to their end.
  function rerunStarted(repo, number, names) {
    for (let i = 0; i < checkTries; i++) {
      execFileSync('sleep', [String(checkWait)]);
      let checks;
      try {
        checks = JSON.parse(gh(['pr', 'checks', String(number), '--repo', repo, '--required', '--json', 'name,bucket']));
      } catch {
        continue;
      }
      if (!checks.some((c) => names.includes(c.name) && c.bucket === 'fail')) return;
    }
  }
  const named = (names) => listed(names.map((n) => `\`${n}\``));

  // A required check that fails has its failed jobs rerun once, the second try a failed command
  // gets, and only a failure after that blocks. A check that has not registered yet is waited
  // for and is no failure.
  function waitForChecks(repo, number, rerun) {
    for (let i = 0; ; i++) {
      try {
        gh(['pr', 'checks', String(number), '--repo', repo, '--watch', '--required']);
        if (rerun.pending) {
          rerun.retries.push(`the required check ${rerun.pending} failed once, passed on rerun`);
          rerun.pending = null;
        }
        return;
      } catch (e) {
        const noChecksYet = /no (required )?checks reported/i.test(e.message);
        if (noChecksYet && i < checkTries) {
          execFileSync('sleep', [String(checkWait)]);
          continue;
        }
        const base = `the required check did not pass on pull request #${number} of ${repo}`;
        if (noChecksYet) throw new Blocked(base);
        let failing = null;
        try {
          failing = failingChecks(repo, number);
        } catch {
          // without the failing runs there is nothing to rerun, and the failure stands
        }
        if (rerun.pending) throw new Blocked(`${base}: ${failing?.names.length ? named(failing.names) : rerun.pending} failed again after a rerun`);
        if (rerun.done || !failing?.runs.length) throw new Blocked(`${base}: ${tailOf(e.message)}`);
        try {
          for (const id of failing.runs) gh(['run', 'rerun', id, '--repo', repo, '--failed']);
        } catch (r) {
          throw new Blocked(`${base}: ${named(failing.names)} failed, and its rerun was refused: ${tailOf(r.message)}`);
        }
        rerun.done = true;
        rerun.pending = named(failing.names);
        rerunStarted(repo, number, failing.names);
        i = -1;
      }
    }
  }

  // The checks wait can return before every required check has registered, and GitHub then
  // reports the pull request BLOCKED or UNKNOWN, or refuses the merge under the base branch
  // policy, for as long as it takes the rest to report. So CLEAN, HAS_HOOKS and UNSTABLE merge —
  // UNSTABLE is every required check passed and only one the ruleset does not require failing
  // or running — and any other state, DRAFT among them, and that refusal, is waited out and the
  // checks watched again, a bounded number of times, and only then blocks with the last state
  // named. BEHIND is not waiting: the branch takes main and the checks run again. DIRTY does not
  // heal by waiting either: a conflict with main needs a person, so it blocks at once.
  const POLICY = /base branch policy prohibits the merge/i;
  function merge(repo, pr, retries) {
    if (pr.state === 'MERGED') return { pr: pr.url, merge: pr.mergeCommit.oid };
    const n = String(pr.number);
    let behind = 0;
    let last = null;
    const rerun = { done: false, pending: null, retries };
    for (let tries = 0; ; ) {
      waitForChecks(repo, pr.number, rerun);
      const { mergeStateStatus } = JSON.parse(gh(['pr', 'view', n, '--repo', repo, '--json', 'mergeStateStatus']));
      if (mergeStateStatus === 'BEHIND') {
        if (++behind > 3) throw new Blocked(`pull request #${n} of ${repo} stayed behind main`);
        gh(['pr', 'update-branch', n, '--repo', repo]);
        continue;
      }
      if (mergeStateStatus === 'DIRTY') throw new Blocked(`pull request #${n} of ${repo} conflicts with main`);
      if (['CLEAN', 'HAS_HOOKS', 'UNSTABLE'].includes(mergeStateStatus)) {
        try {
          gh(['pr', 'merge', n, '--repo', repo, '--merge']);
          const done = JSON.parse(gh(['pr', 'view', n, '--repo', repo, '--json', 'url,mergeCommit']));
          return { pr: done.url, merge: done.mergeCommit.oid };
        } catch (e) {
          if (!POLICY.test(e.message)) throw e;
          last = 'refused by the base branch policy';
        }
      } else {
        last = mergeStateStatus;
      }
      if (++tries > checkTries) throw new Blocked(`pull request #${n} of ${repo} was still ${last} after ${checkTries} waits`);
      execFileSync('sleep', [String(checkWait)]);
    }
  }

  function cleanup(dir, wt, branch) {
    const steps = [
      ['remove the worktree', () => git(dir, 'worktree', 'remove', '--force', wt)],
      ['delete the local branch', () => git(dir, 'branch', '-D', branch)],
    ];
    if (!dryRun) steps.push(['delete the remote branch', () => git(dir, 'push', '-q', 'origin', '--delete', branch)]);
    for (const [desc, fn] of steps) {
      try {
        fn();
      } catch (e) {
        log(`could not ${desc} for ${branch} of ${dir}: ${e.message}`);
      }
    }
  }

  function stage(wt) {
    git(wt, 'add', '-A');
    return git(wt, 'diff', '--cached', '--name-only') !== '';
  }

  const hasNewCommit = (wt) => git(wt, 'rev-list', '--count', 'origin/main..HEAD') !== '0';

  function commitIfChanged(wt, message, author) {
    const changed = stage(wt);
    if (changed) git(wt, 'commit', '-q', ...(author ? ['--author', author] : []), '-m', message.full);
    return changed || hasNewCommit(wt);
  }

  function pushAndMerge(repo, dir, wt, branch, message, retries) {
    if (dryRun) {
      log(`dry run: ${repo}: committed in ${wt}; would push ${branch}, open “${message.subject}”, wait for its check and merge it`);
      return { pr: null, merge: null, note: null };
    }
    git(wt, 'push', '-q', '-u', 'origin', branch);
    let pr = existingPr(repo, branch);
    if (!pr) {
      gh(['pr', 'create', '--repo', repo, '--head', branch, '--base', 'main', '--title', message.subject, '--body', message.body]);
      pr = existingPr(repo, branch);
    }
    onPull(pr.url);
    const landed = merge(repo, pr, retries);
    cleanup(dir, wt, branch);
    // The merge just moved origin/main; the clone follows it under the same rule as before work.
    return { ...landed, note: fastForward(dir) };
  }

  function land(repo, dir, wt, branch, message, author, retries) {
    if (!commitIfChanged(wt, message, author)) throw new Blocked('the move changed nothing');
    return pushAndMerge(repo, dir, wt, branch, message, retries);
  }

  function move(wt, p, ran, retries) {
    const kind = KINDS[p.kind];
    if (p.entry.move) {
      const cmd = p.entry.move.replaceAll('{version}', p.available);
      sh(wt, cmd, retries);
      ran.push(cmd);
    } else {
      const path = join(wt, p.file);
      writeFileSync(path, kind.write(readFileSync(path, 'utf8'), p.upstream, p.available));
      if (p.kind === 'conventions') rewriteWorkflows(wt, p.available);
      for (const cmd of kind.commands) { sh(wt, cmd, retries); ran.push(cmd); }
    }
    const after = p.entry.after ?? [];
    if (after.length) installAt(wt, '.', ran, retries);
    for (const cmd of after) { sh(wt, cmd, retries); ran.push(cmd); }
  }

  // A step that runs in a worktree needs the packages its lockfile names, and a move that never
  // touches an npm-tag pin leaves none: a pin's `after` steps and the verify commands fail before
  // they say anything about what they build or verify. So where a lockfile sits and no
  // node_modules answers it, `npm ci` runs once, in the worktree root before the first `after`
  // step, and again for every directory a verify command names with `--prefix`; where
  // node_modules is already there, an npm-tag pin's own `npm install` having left it, nothing
  // runs twice.
  function installAt(wt, dir, ran, retries) {
    const base = dir === '.' ? wt : join(wt, dir);
    if (!existsSync(join(base, 'package-lock.json')) || existsSync(join(base, 'node_modules'))) return;
    const cmd = dir === '.' ? 'npm ci' : `npm ci --prefix ${dir}`;
    sh(wt, cmd, retries);
    ran.push(cmd);
  }

  function installForVerify(wt, verify, ran, retries) {
    installAt(wt, '.', ran, retries);
    const dirs = [...new Set([...verify.join(' ').matchAll(/--prefix[= ]+(\S+)/g)].map((m) => m[1]))];
    for (const dir of dirs) installAt(wt, dir, ran, retries);
  }

  function rewriteWorkflows(wt, tag) {
    const dir = join(wt, '.github/workflows');
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
      const path = join(dir, f);
      const text = readFileSync(path, 'utf8');
      const next = text.replace(CHECK_LINE, `$1${tag}`);
      if (next !== text) writeFileSync(path, next);
    }
  }

  function pinsCurrent(dir, pins) {
    return pins.every((p) => {
      let text;
      try {
        text = git(dir, 'show', `origin/main:${p.file}`);
      } catch {
        return false;
      }
      const read = KINDS[p.kind].read(text, p.upstream);
      return read.length === 1 && read[0] === p.available;
    });
  }

  const combineNotes = (...notes) => {
    const seen = new Set();
    const kept = [];
    for (const n of notes) {
      if (n && !seen.has(n)) {
        seen.add(n);
        kept.push(n);
      }
    }
    return kept.join('; ') || null;
  };

  return {
    update(repo, pins, { date, verify = [] }) {
      const { dir, note: cloneNote } = clone(repo);
      if (pinsCurrent(dir, pins)) {
        return { pr: null, merge: null, note: combineNotes(cloneNote, 'the pins are already on main'), retries: [] };
      }
      // A merge that moves only vendored files is named apart, so a later report does not read
      // it as work a release is owed for.
      const vendored = pins.every((p) => NON_PROPAGATING.has(p.kind));
      const { wt, branch } = prepareWorktree(repo, dir, vendored ? `resync-vendored-${date}` : `resync-${date}`);
      return whileIn(wt, () => {
        identity(wt);
        const seat = implementerOf(wt, repo);
        const ran = [];
        const retries = [];
        for (const p of pins) move(wt, p, ran, retries);
        installForVerify(wt, verify, ran, retries);
        for (const cmd of verify) { sh(wt, cmd, retries); ran.push(cmd); }
        const landed = land(repo, dir, wt, branch, commitMessage(pins, ran), seat.author, retries);
        return { ...landed, note: combineNotes(cloneNote, seat.note, landed.note), retries };
      });
    },

    release(repo, tag, notes, commands, { date }) {
      if (!dryRun) {
        try {
          gh(['release', 'view', tag, '--repo', repo]);
          return { tag, retries: [] };
        } catch {
          // not released yet
        }
      }
      const version = tag.replace(/^v/, '');
      // The tag goes on a commit the run knows, never on whatever main holds by the time the
      // checks are done: the merge of the bump's own pull request, or else the main the run just
      // fetched and found the bump already on.
      let target = null;
      let note = null;
      const retries = [];
      if (commands.length) {
        const { dir } = clone(repo);
        const { wt, branch } = prepareWorktree(repo, dir, `resync-${date}-release`);
        target = whileIn(wt, () => {
          identity(wt);
          const seat = implementerOf(wt, repo);
          const bump = () => {
            const ran = [];
            for (const c of commands) { const cmd = c.replaceAll('{version}', version); sh(wt, cmd, retries); ran.push(cmd); }
            return ran;
          };
          const subject = `The version reads ${version}`;
          // A release branch reused from an earlier run the same day that already holds commits
          // beyond main holds the bump, pushed before that run was cut short; bumping again would
          // fail where a command refuses an unchanged version, so the run takes that branch on.
          // A merge of main that `gh pr update-branch` left there is not a commit of its own.
          const made = hasNewCommit(wt);
          if (made && git(wt, 'log', '--no-merges', '--format=%s', 'origin/main..HEAD').split('\n').some((s) => s !== subject)) {
            throw new Blocked(`${branch} holds commits that are not the bump to ${version}`);
          }
          const ran = made ? [] : bump();
          const body = `The family resync releases ${tag} so that the repositories taking this one can re-pin it.\n\nVerified: ${ran.length ? `${listed(ran.map((c) => `\`${c}\``))} passed` : 'the bump was already committed'}.`;
          const message = { subject, body, full: `${subject}\n\n${body}\n\n${TRAILERS}\n` };
          if (commitIfChanged(wt, message, seat.author)) {
            const landed = pushAndMerge(repo, dir, wt, branch, message, retries);
            note = combineNotes(seat.note, landed.note);
            return landed.merge;
          } else {
            const main = git(wt, 'rev-parse', 'origin/main');
            if (git(wt, 'rev-parse', 'HEAD') !== main) {
              git(wt, 'reset', '-q', '--hard', main);
              bump();
              if (stage(wt)) throw new Blocked(`the bump to ${version} is not on main`);
            }
            cleanup(dir, wt, branch);
            note = seat.note;
            return main;
          }
        });
      }
      if (dryRun) {
        log(`dry run: ${repo}: would release ${tag}`);
        return { tag: null, note, retries };
      }
      if (!target) target = git(clone(repo).dir, 'rev-parse', 'origin/main');
      gh(['release', 'create', tag, '--repo', repo, '--target', target, '--title', tag, '--notes', notes]);
      return { tag, note, retries };
    },
  };
}
