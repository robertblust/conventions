// One member carried through a resync: a clone from the remote, a worktree on the day's branch,
// each pin moved and the member rebuilt as its pins.json says, a pull request merged once its
// check passes, and a release where the run needs one. Anything that needs a person's judgment
// throws Blocked, and the run holds what is downstream. A rerun is idempotent on what a pin's
// file holds, not on a branch name: a branch is chosen by walking past whatever a prior day's
// run already merged, a reused worktree is reset to what the branch actually holds before
// anything runs again, unless it holds work the run did not leave there, which blocks; and a
// dry run works its own throwaway branch so it never leaves a worktree a real run would mistake
// for its own.
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
} = {}) {
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const sh = (cwd, cmd) => {
    try {
      execFileSync('sh', ['-c', cmd], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
    } catch (e) {
      const tail = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim().split('\n').slice(-5).join('\n');
      throw new Blocked(`\`${cmd}\` failed${tail ? `:\n${tail}` : ''}`);
    }
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

  function waitForChecks(repo, number) {
    for (let i = 0; ; i++) {
      try {
        gh(['pr', 'checks', String(number), '--repo', repo, '--watch', '--required']);
        return;
      } catch (e) {
        const noChecksYet = /no (required )?checks reported/i.test(e.message);
        if (noChecksYet && i < checkTries) {
          execFileSync('sleep', [String(checkWait)]);
          continue;
        }
        const base = `the required check did not pass on pull request #${number} of ${repo}`;
        throw new Blocked(noChecksYet ? base : `${base}: ${tailOf(e.message)}`);
      }
    }
  }

  function merge(repo, pr) {
    if (pr.state === 'MERGED') return { pr: pr.url, merge: pr.mergeCommit.oid };
    for (let i = 0; i < 3; i++) {
      waitForChecks(repo, pr.number);
      const { mergeStateStatus } = JSON.parse(gh(['pr', 'view', String(pr.number), '--repo', repo, '--json', 'mergeStateStatus']));
      if (mergeStateStatus === 'BEHIND') {
        gh(['pr', 'update-branch', String(pr.number), '--repo', repo]);
        continue;
      }
      gh(['pr', 'merge', String(pr.number), '--repo', repo, '--merge']);
      const done = JSON.parse(gh(['pr', 'view', String(pr.number), '--repo', repo, '--json', 'url,mergeCommit']));
      return { pr: done.url, merge: done.mergeCommit.oid };
    }
    throw new Blocked(`pull request #${pr.number} of ${repo} stayed behind main`);
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

  function pushAndMerge(repo, dir, wt, branch, message) {
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
    const landed = merge(repo, pr);
    cleanup(dir, wt, branch);
    // The merge just moved origin/main; the clone follows it under the same rule as before work.
    return { ...landed, note: fastForward(dir) };
  }

  function land(repo, dir, wt, branch, message, author) {
    if (!commitIfChanged(wt, message, author)) throw new Blocked('the move changed nothing');
    return pushAndMerge(repo, dir, wt, branch, message);
  }

  function move(wt, p, ran) {
    const kind = KINDS[p.kind];
    if (p.entry.move) {
      const cmd = p.entry.move.replaceAll('{version}', p.available);
      sh(wt, cmd);
      ran.push(cmd);
    } else {
      const path = join(wt, p.file);
      writeFileSync(path, kind.write(readFileSync(path, 'utf8'), p.upstream, p.available));
      if (p.kind === 'conventions') rewriteWorkflows(wt, p.available);
      for (const cmd of kind.commands) { sh(wt, cmd); ran.push(cmd); }
    }
    for (const cmd of p.entry.after ?? []) { sh(wt, cmd); ran.push(cmd); }
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
        return { pr: null, merge: null, note: combineNotes(cloneNote, 'the pins are already on main') };
      }
      // A merge that moves only vendored files is named apart, so a later report does not read
      // it as work a release is owed for.
      const vendored = pins.every((p) => NON_PROPAGATING.has(p.kind));
      const { wt, branch } = prepareWorktree(repo, dir, vendored ? `resync-vendored-${date}` : `resync-${date}`);
      return whileIn(wt, () => {
        identity(wt);
        const seat = implementerOf(wt, repo);
        const ran = [];
        for (const p of pins) move(wt, p, ran);
        for (const cmd of verify) { sh(wt, cmd); ran.push(cmd); }
        const landed = land(repo, dir, wt, branch, commitMessage(pins, ran), seat.author);
        return { ...landed, note: combineNotes(cloneNote, seat.note, landed.note) };
      });
    },

    release(repo, tag, notes, commands, { date }) {
      if (!dryRun) {
        try {
          gh(['release', 'view', tag, '--repo', repo]);
          return { tag };
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
      if (commands.length) {
        const { dir } = clone(repo);
        const { wt, branch } = prepareWorktree(repo, dir, `resync-${date}-release`);
        target = whileIn(wt, () => {
          identity(wt);
          const seat = implementerOf(wt, repo);
          const bump = () => {
            const ran = [];
            for (const c of commands) { const cmd = c.replaceAll('{version}', version); sh(wt, cmd); ran.push(cmd); }
            return ran;
          };
          const ran = bump();
          const subject = `The version reads ${version}`;
          const body = `The family resync releases ${tag} so that the repositories taking this one can re-pin it.\n\nVerified: ${ran.length ? `${listed(ran.map((c) => `\`${c}\``))} passed` : 'the bump was already committed'}.`;
          const message = { subject, body, full: `${subject}\n\n${body}\n\n${TRAILERS}\n` };
          if (commitIfChanged(wt, message, seat.author)) {
            const landed = pushAndMerge(repo, dir, wt, branch, message);
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
        return { tag: null, note };
      }
      if (!target) target = git(clone(repo).dir, 'rev-parse', 'origin/main');
      gh(['release', 'create', tag, '--repo', repo, '--target', target, '--title', tag, '--notes', notes]);
      return { tag, note };
    },
  };
}
