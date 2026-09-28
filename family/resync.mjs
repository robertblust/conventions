#!/usr/bin/env node
// `node family/resync.mjs <report.json> <all | chain numbers…> [--dry-run]` runs the chains the
// owner chose from the report and writes dist/resync-run-<date>.md. It exits 1 when a member was
// blocked, so an Action that runs it fails where a person is needed. `node family/resync.mjs
// --clean-dry-runs` instead clears the throwaway worktrees a dry run left behind, and touches
// nothing on GitHub.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { orchestrate } from './orchestrate.mjs';
import { realMember } from './member.mjs';
import { realGithub } from './github.mjs';
import { renderRecord } from './render.mjs';
import { parseMembers } from './repositories.mjs';
import { HERE, today } from './report.mjs';

export function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === '--clean-dry-runs') return { cleanDryRuns: true };
  const [file, ...rest] = argv;
  const dryRun = rest.includes('--dry-run');
  const picks = rest.filter((a) => a !== '--dry-run');
  if (!file || !picks.length) return null;
  if (picks.length === 1 && picks[0] === 'all') return { file, selection: 'all', dryRun };
  const selection = picks.map(Number);
  if (selection.some((n) => !Number.isInteger(n) || n < 1)) return null;
  return { file, selection, dryRun };
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
    console.error('usage: node family/resync.mjs <report.json> <all | chain numbers…> [--dry-run]');
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
  try {
    const { out, record } = runResync({ ...args, report, github: realGithub(), member: realMember({ dryRun: args.dryRun }), date, outDir: join(HERE, 'dist'), log: console.log });
    console.log(out);
    process.exit(record.some((r) => r.status === 'blocked') ? 1 : 0);
  } catch (err) {
    if (err.message.startsWith('no chain')) {
      console.error(err.message);
      process.exit(2);
    }
    throw err;
  }
}
