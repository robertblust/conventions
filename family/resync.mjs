#!/usr/bin/env node
// `node family/resync.mjs <report.json> <all | chain numbers…> [--dry-run]` runs the chains the
// owner chose from the report and writes dist/resync-run-<date>.md. It exits 1 when a member was
// blocked, so an Action that runs it fails where a person is needed.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { orchestrate } from './orchestrate.mjs';
import { realMember } from './member.mjs';
import { realGithub } from './github.mjs';
import { renderRecord } from './render.mjs';
import { HERE, today } from './report.mjs';

export function parseArgs(argv) {
  const [file, ...rest] = argv;
  const dryRun = rest.includes('--dry-run');
  const picks = rest.filter((a) => a !== '--dry-run');
  if (!file || !picks.length) return null;
  if (picks.length === 1 && picks[0] === 'all') return { file, selection: 'all', dryRun };
  const selection = picks.map(Number);
  if (selection.some((n) => !Number.isInteger(n) || n < 1)) return null;
  return { file, selection, dryRun };
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
    process.exit(2);
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
