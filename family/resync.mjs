#!/usr/bin/env node
// `node family/resync.mjs <report.json> <all | chain numbers…> [--dry-run]` runs the chains the
// owner chose from the report and writes dist/resync-run-<date>.md. It exits 1 when a member was
// blocked, so an Action that runs it fails where a person is needed. `node family/resync.mjs
// --clean-dry-runs` instead clears the throwaway worktrees a dry run left behind, and touches
// nothing on GitHub. A run holds dist/resync.lock while it goes, and refuses to start beside
// another run or beside an open resync pull request of an earlier day, which `--force` overrides.
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
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

// Two runs at once open the same resync-<date> branches and write the same dist/ files, so a
// run takes the lock before anything else and refuses while the run that holds it is alive. A
// lock whose run has died is taken over. The lock answers the function that removes it.
export function lockRun({ path, args, pid = process.pid, log = console.log }) {
  mkdirSync(dirname(path), { recursive: true });
  const body = `${JSON.stringify({ pid, started: new Date().toISOString(), args })}\n`;
  try {
    writeFileSync(path, body, { flag: 'wx' });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let held = null;
    try { held = JSON.parse(readFileSync(path, 'utf8')); } catch { /* an unreadable lock holds nothing */ }
    if (Number.isInteger(held?.pid) && isAlive(held.pid)) {
      throw refusal(`another resync is running: pid ${held.pid}, started ${held.started}; its lock is ${path}`);
    }
    log(`took over ${path} from pid ${held?.pid ?? 'unknown'}, started ${held?.started ?? 'unknown'}, which is no longer running`);
    writeFileSync(path, body);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      if (JSON.parse(readFileSync(path, 'utf8')).pid === pid) unlinkSync(path);
    } catch { /* gone already */ }
  };
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
  return JSON.parse(run(['pr', 'list', '--repo', repo, '--state', 'open', '--json', 'number,headRefName,url']))
    .filter((p) => p.headRefName.startsWith('resync-'));
}

// A run reuses only the branches it names for its own day, so an open resync pull request of
// another day is a run that has not finished, and starting beside it moves the same pins twice.
const ownBranch = (head, date) => head === `resync-${date}` || head.startsWith(`resync-${date}-`) || head.startsWith(`resync-vendored-${date}`);

export function guardPulls({ members, date, force, list = listResyncPulls, log = console.log }) {
  const open = members.flatMap(({ repo }) => list(repo).filter((p) => !ownBranch(p.headRefName, date)).map((p) => `${repo} #${p.number} ${p.headRefName} is open`));
  if (!open.length) return;
  if (force) {
    log(`--force: running beside ${open.join('; ')}`);
    return;
  }
  throw refusal(`an earlier resync has not finished:\n${open.join('\n')}\nmerge or close each first, or pass --force to run beside them`);
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error('usage: node family/resync.mjs <report.json> <all | chain numbers…> [--dry-run] [--force]');
    console.error('   or: node family/resync.mjs --clean-dry-runs');
    process.exit(2);
  }
  if (args.cleanDryRuns) {
    const markdown = readFileSync(join(HERE, 'conventions/REPOSITORIES.md'), 'utf8');
    cleanDryRuns({ members: parseMembers(markdown), log: console.log });
    process.exit(0);
  }
  const report = JSON.parse(readFileSync(args.file, 'utf8'));
  const date = today();
  if (report.date !== date) console.log(`the report is from ${report.date}; the run reads every member again before it moves it`);
  let code;
  try {
    code = withLock({ path: join(HERE, 'dist/resync.lock'), args: process.argv.slice(2) }, (release) => {
      // An exit on a signal skips the finally, so the lock is removed here as well.
      for (const [signal, exit] of [['SIGINT', 130], ['SIGTERM', 143]]) process.on(signal, () => { release(); process.exit(exit); });
      guardPulls({ members: report.members, date, force: args.force });
      const { out, record } = runResync({ ...args, report, github: realGithub(), member: realMember({ dryRun: args.dryRun }), date, outDir: join(HERE, 'dist'), log: console.log });
      console.log(out);
      return record.some((r) => r.status === 'blocked') ? 1 : 0;
    });
  } catch (err) {
    if (err.refused || err.message.startsWith('no chain')) {
      console.error(err.message);
      process.exit(2);
    }
    throw err;
  }
  process.exit(code);
}
