#!/usr/bin/env node
// `node family/resync.mjs <report.json> <all | chain numbers…> [--dry-run] [--force]` runs the
// chains the owner chose from the report and writes dist/resync-run-<date>.md, and .json for a
// real run. It exits 1 when a member was blocked, so an Action that runs it fails where a person
// is needed. `node family/resync.mjs --clean-dry-runs` instead clears the throwaway worktrees a
// dry run left behind, and touches nothing on GitHub. A run holds family-resync.lock in the
// clone's git directory while it goes, and refuses to start beside another run or beside an open
// resync pull request its own record of the day does not name, which `--force` overrides.
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, renameSync, linkSync, statSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { orchestrate } from './orchestrate.mjs';
import { realMember } from './member.mjs';
import { realGithub } from './github.mjs';
import { gh } from './gh.mjs';
import { renderRecord } from './render.mjs';
import { parseMembers } from './repositories.mjs';
import { HERE, today } from './report.mjs';

export function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === '--clean-dry-runs') return { cleanDryRuns: true };
  const [file, ...rest] = argv;
  const dryRun = rest.includes('--dry-run');
  const force = rest.includes('--force');
  const picks = rest.filter((a) => a !== '--dry-run' && a !== '--force');
  if (!file || !picks.length) return null;
  if (picks.length === 1 && picks[0] === 'all') return { file, selection: 'all', dryRun, force };
  const selection = picks.map(Number);
  if (selection.some((n) => !Number.isInteger(n) || n < 1)) return null;
  return { file, selection, dryRun, force };
}

// A refusal stops the run before it moved anything, and says why.
const refusal = (message) => Object.assign(new Error(message), { refused: true });

// A pid that signal 0 reaches is a process still running; EPERM means it runs as someone else.
const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};

// The lock sits in the clone's common git directory, which every worktree of the clone shares,
// so two sessions in two worktrees of this repository see the one lock, under one real path.
export function lockPathOf(dir) {
  return join(realpathSync(resolve(dir, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: dir, encoding: 'utf8' }).trim())), 'family-resync.lock');
}

// A lock that cannot be read is one being written, unless it is older than this.
const UNREADABLE_FOR = 5 * 60 * 1000;

// Two runs at once open the same resync-<date> branches and write the same dist/ files, so a
// run takes the lock before anything else and refuses while the run that holds it is alive. The
// lock is written whole to a file of its own and linked into place, which fails if a lock is
// there, so no run reads a lock another has half written. A lock whose run has died is moved
// aside and removed, and the link tried again, so of two runs taking it over only one wins and
// the other then finds it held. The lock answers the function that removes it.
export function lockRun({ path, args, pid = process.pid, log = console.log }) {
  mkdirSync(dirname(path), { recursive: true });
  const body = `${JSON.stringify({ pid, started: new Date().toISOString(), args })}\n`;
  const aside = (what) => `${path}.${pid}.${what}`;
  const create = () => {
    writeFileSync(aside('new'), body);
    try {
      linkSync(aside('new'), path);
      return true;
    } catch (e) {
      if (e.code === 'EEXIST') return false;
      throw e;
    } finally {
      unlinkSync(aside('new'));
    }
  };
  for (let tries = 0; tries < 5; tries++) {
    if (create()) {
      let released = false;
      return () => {
        if (released) return;
        released = true;
        try {
          if (JSON.parse(readFileSync(path, 'utf8')).pid === pid) unlinkSync(path);
        } catch { /* gone already */ }
      };
    }
    let seen;
    let held = null;
    try {
      seen = statSync(path);
      held = JSON.parse(readFileSync(path, 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') continue;
    }
    if (Number.isInteger(held?.pid)) {
      if (isAlive(held.pid)) throw refusal(`another resync is running: pid ${held.pid}, started ${held.started}; its lock is ${path}`);
    } else if (Date.now() - seen.mtimeMs < UNREADABLE_FOR) {
      throw refusal(`a resync lock at ${path} cannot be read, and another run may be writing it; it counts as held until it is ${UNREADABLE_FOR / 60000} minutes old`);
    }
    // Moved aside first, so that a lock another run has put in its place since is put back
    // rather than removed.
    try {
      renameSync(path, aside('dead'));
    } catch (e) {
      if (e.code === 'ENOENT') continue;
      throw e;
    }
    if (statSync(aside('dead')).ino === seen.ino) {
      log(`took over ${path} from pid ${held?.pid ?? 'unknown'}, started ${held?.started ?? 'unknown'}, which is no longer running`);
    } else {
      try { linkSync(aside('dead'), path); } catch { /* a third run holds it now */ }
    }
    unlinkSync(aside('dead'));
  }
  throw refusal(`could not take the resync lock at ${path}; other runs keep taking it`);
}

// Runs fn under the lock and removes it however fn ends.
export function withLock(lock, fn) {
  const release = lockRun(lock);
  try {
    return fn(release);
  } finally {
    release();
  }
}

// The open pull requests of one member whose head starts with `resync-`.
export function listResyncPulls(repo, run = gh) {
  return JSON.parse(run(['pr', 'list', '--repo', repo, '--state', 'open', '--limit', '100', '--json', 'number,headRefName,url']))
    .filter((p) => p.headRefName.startsWith('resync-'));
}

const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
};

// The pull requests this checkout's runs of the day opened or took on. A second session the same
// day uses the same resync-<date> branch names, so a name says nothing about whose run a pull
// request is; only what a run here wrote down does. dist/resync-own-<date>.json is written the
// moment a pull request has a url, so it holds one a run left open when it was blocked, threw or
// was killed; the run's own record is read as well.
export function ownPulls(outDir, date) {
  const own = readJson(join(outDir, `resync-own-${date}.json`), []);
  const record = readJson(join(outDir, `resync-run-${date}.json`), []);
  return new Set([...own, ...record.map((r) => r.pr)].filter(Boolean));
}

// Adds a url to the day's own pull requests, through a rename so that a run stopped mid-write
// leaves the file whole.
export function recordPull(outDir, date) {
  const path = join(outDir, `resync-own-${date}.json`);
  return (url) => {
    const own = readJson(path, []);
    if (own.includes(url)) return;
    mkdirSync(outDir, { recursive: true });
    writeFileSync(`${path}.${process.pid}.tmp`, `${JSON.stringify([...own, url], null, 2)}\n`);
    renameSync(`${path}.${process.pid}.tmp`, path);
  };
}

// The member a run moves through; only a real run records its pull requests, since a dry run
// opens none.
export function memberFor({ dryRun, outDir, date, ...options }) {
  return realMember({ ...options, dryRun, ...(dryRun ? {} : { onPull: recordPull(outDir, date) }) });
}

// An open resync pull request the record does not name is a run that has not finished, and
// starting beside it moves the same pins twice.
export function guardPulls({ members, own, force, list = listResyncPulls, log = console.log }) {
  const ask = (repo) => {
    try {
      return list(repo);
    } catch (e) {
      throw refusal(`could not ask GitHub for the open pull requests of ${repo}, so the run cannot tell whether another is unfinished: ${e.message}`);
    }
  };
  const open = members.flatMap(({ repo }) => ask(repo).filter((p) => !own.has(p.url)).map((p) => `${repo} #${p.number} ${p.headRefName} is open`));
  if (!open.length) return;
  if (force) {
    log(`--force: running beside ${open.join('; ')}`);
    return;
  }
  throw refusal(`an earlier resync has not finished:\n${open.join('\n')}\nonly the pull requests a run in this checkout opened or took on today are its own, so one left open on an earlier day refuses too; merge or close each first, or pass --force to run beside them`);
}

// The worktrees of one member's clone whose branch starts with `dry-run-`, a throwaway a dry run
// leaves for the owner to inspect and the only kind this cleans.
function dryRunWorktreesOf(dir) {
  let out;
  try {
    out = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: dir, encoding: 'utf8' });
  } catch {
    return [];
  }
  const trees = [];
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) { cur = { path: line.slice('worktree '.length) }; trees.push(cur); }
    else if (cur && line.startsWith('branch refs/heads/')) cur.branch = line.slice('branch refs/heads/'.length);
  }
  return trees.filter((t) => t.branch?.startsWith('dry-run-'));
}

// Removes every dry-run worktree and its local branch from each member clone under the root, and
// nothing else: it never reaches GitHub, and a member with no local clone is skipped.
export function cleanDryRuns({ root = process.env.FAMILY_ROOT || join(homedir(), 'git'), members, log = console.log }) {
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  for (const { repo } of members) {
    const dir = join(root, repo);
    if (!existsSync(dir)) continue;
    for (const { path, branch } of dryRunWorktreesOf(dir)) {
      git(dir, 'worktree', 'remove', '--force', path);
      git(dir, 'branch', '-D', branch);
      log(`${repo}: removed ${branch}`);
    }
  }
}

// Runs the choice and writes the record. A run that throws partway still writes the record of
// what it did before it stopped, so the owner sees which members moved; a chain the report does
// not hold stops the run before anything moved, and writes nothing.
export function runResync({ report, selection, dryRun, github, member, date, outDir, log }) {
  const record = [];
  const write = () => {
    mkdirSync(outDir, { recursive: true });
    const out = join(outDir, `resync-run-${date}.md`);
    writeFileSync(out, renderRecord(record, date, dryRun));
    // The JSON is what a later run the same day reads to know its own pull requests; a dry run
    // opens none, so it leaves a real run's record standing.
    if (!dryRun) writeFileSync(join(outDir, `resync-run-${date}.json`), `${JSON.stringify(record, null, 2)}\n`);
    return out;
  };
  try {
    orchestrate({ report, selection, github, member, date, dryRun, log, record });
  } catch (err) {
    if (!err.message.startsWith('no chain')) console.error(`the run stopped; its record is at ${write()}`);
    throw err;
  }
  return { out: write(), record };
}

// The command, as a function of its arguments and of what it reaches, so a test can stub GitHub
// and the members. It answers the exit code: 0 for a run with nothing blocked, 1 for a run that
// blocked a member, 2 for a usage error, a chain the report does not hold or a refusal. It
// installs no signal handler: the run waits in child processes, where a handler would never run
// and would only keep the signal from ending the run, and a killed run's lock is taken over the
// next time.
export function main({
  argv,
  here = HERE,
  date = today(),
  lockPath = lockPathOf(here),
  list = listResyncPulls,
  github = realGithub(),
  memberOf = memberFor,
  log = console.log,
  error = console.error,
}) {
  const args = parseArgs(argv);
  if (!args) {
    error('usage: node family/resync.mjs <report.json> <all | chain numbers…> [--dry-run] [--force]');
    error('   or: node family/resync.mjs --clean-dry-runs');
    return 2;
  }
  if (args.cleanDryRuns) {
    const markdown = readFileSync(join(here, 'conventions/REPOSITORIES.md'), 'utf8');
    cleanDryRuns({ members: parseMembers(markdown), log });
    return 0;
  }
  const report = JSON.parse(readFileSync(args.file, 'utf8'));
  if (report.date !== date) log(`the report is from ${report.date}; the run reads every member again before it moves it`);
  const outDir = join(here, 'dist');
  try {
    return withLock({ path: lockPath, args: argv, log }, () => {
      guardPulls({ members: report.members, own: ownPulls(outDir, date), force: args.force, list, log });
      const { out, record } = runResync({ ...args, report, github, member: memberOf({ dryRun: args.dryRun, outDir, date }), date, outDir, log });
      log(out);
      return record.some((r) => r.status === 'blocked') ? 1 : 0;
    });
  } catch (err) {
    if (err.refused || err.message.startsWith('no chain')) {
      error(err.message);
      return 2;
    }
    throw err;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main({ argv: process.argv.slice(2) }));
}
