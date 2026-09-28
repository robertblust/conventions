// One member carried through a resync: a clone from the remote, a worktree on the day's branch,
// each pin moved and the member rebuilt as its pins.json says, a pull request merged once its
// check passes, and a release where the run needs one. Anything that needs a person's judgment
// throws Blocked, and the run holds what is downstream. A rerun is idempotent on what a pin's
// file holds, not on a branch name: a branch is chosen by walking past whatever a prior day's
// run already merged, a reused worktree is reset to what the branch actually holds before
// anything runs again, and a dry run works its own throwaway branch so it never leaves a
// worktree a real run would mistake for its own.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { gh } from './gh.mjs';
import { KINDS } from './pins.mjs';
import { commitMessage, listed } from './words.mjs';

export class Blocked extends Error {}

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

  function clone(repo) {
    const dir = join(root, repo);
    if (!existsSync(dir)) {
      mkdirSync(dirname(dir), { recursive: true });
      git(root, 'clone', '-q', `${remote}/${repo}.git`, dir);
    }
    git(dir, 'fetch', '-q', 'origin');
    const branch = git(dir, 'rev-parse', '--abbrev-ref', 'HEAD');
    if (branch !== 'main') return { dir, note: `the clone was left alone on ${branch}` };
    if (git(dir, 'status', '--porcelain') !== '') return { dir, note: 'the clone was left alone with uncommitted changes' };
    try {
      git(dir, 'merge', '-q', '--ff-only', 'origin/main');
      return { dir, note: null };
    } catch {
      return { dir, note: 'the clone could not fast-forward main' };
    }
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

  function worktree(repo, dir, branch) {
    const wt = join(root, `${repo}-${branch}`);
    const base = onRemote(dir, branch) ? `origin/${branch}` : 'origin/main';
    if (existsSync(wt)) {
      git(wt, 'fetch', '-q', 'origin');
      git(wt, 'reset', '-q', '--hard', base);
      return wt;
    }
    git(dir, 'worktree', 'add', '-q', '-B', branch, wt, base);
    return wt;
  }

  function dryRunWorktree(repo, dir, base) {
    const branch = base.replace(/^resync-/, 'dry-run-');
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

  const existingPr = (repo, branch) => JSON.parse(gh(['pr', 'list', '--repo', repo, '--head', branch, '--state', 'all', '--json', 'number,state,url,mergeCommit']))[0] ?? null;

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

  function commitIfChanged(wt, message) {
    const changed = stage(wt);
    if (changed) git(wt, 'commit', '-q', '-m', message.full);
    return changed || hasNewCommit(wt);
  }

  function pushAndMerge(repo, dir, wt, branch, message) {
    if (dryRun) {
      log(`dry run: ${repo}: committed in ${wt}; would push ${branch}, open “${message.subject}”, wait for its check and merge it`);
      return { pr: null, merge: null };
    }
    git(wt, 'push', '-q', '-u', 'origin', branch);
    let pr = existingPr(repo, branch);
    if (!pr) {
      gh(['pr', 'create', '--repo', repo, '--head', branch, '--base', 'main', '--title', message.subject, '--body', message.body]);
      pr = existingPr(repo, branch);
    }
    const landed = merge(repo, pr);
    cleanup(dir, wt, branch);
    return landed;
  }

  function land(repo, dir, wt, branch, message) {
    if (!commitIfChanged(wt, message)) throw new Blocked('the move changed nothing');
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

  const combineNotes = (cloneNote, extra) => (cloneNote ? `${cloneNote}; ${extra}` : extra);

  return {
    update(repo, pins, { date, verify = [] }) {
      const { dir, note: cloneNote } = clone(repo);
      if (pinsCurrent(dir, pins)) {
        return { pr: null, merge: null, note: combineNotes(cloneNote, 'the pins are already on main') };
      }
      const { wt, branch } = prepareWorktree(repo, dir, `resync-${date}`);
      identity(wt);
      const ran = [];
      for (const p of pins) move(wt, p, ran);
      for (const cmd of verify) { sh(wt, cmd); ran.push(cmd); }
      return { ...land(repo, dir, wt, branch, commitMessage(pins, ran)), note: cloneNote };
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
      if (commands.length) {
        const { dir } = clone(repo);
        const { wt, branch } = prepareWorktree(repo, dir, `resync-${date}-release`);
        identity(wt);
        const ran = [];
        for (const c of commands) { const cmd = c.replaceAll('{version}', version); sh(wt, cmd); ran.push(cmd); }
        const subject = `The version reads ${version}`;
        const body = `The family resync releases ${tag} so that the repositories taking this one can re-pin it.\n\nVerified: ${ran.length ? `${listed(ran.map((c) => `\`${c}\``))} passed` : 'the bump was already committed'}.`;
        const message = { subject, body, full: `${subject}\n\n${body}\n` };
        if (commitIfChanged(wt, message)) pushAndMerge(repo, dir, wt, branch, message);
        else cleanup(dir, wt, branch);
      }
      if (dryRun) {
        log(`dry run: ${repo}: would release ${tag}`);
        return { tag: null };
      }
      const target = JSON.parse(gh(['api', `repos/${repo}/commits/main`])).sha;
      gh(['release', 'create', tag, '--repo', repo, '--target', target, '--title', tag, '--notes', notes]);
      return { tag };
    },
  };
}
