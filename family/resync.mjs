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
    const record = orchestrate({ report, selection: args.selection, github: realGithub(), member: realMember({ dryRun: args.dryRun }), date, log: console.log });
    mkdirSync(join(HERE, 'dist'), { recursive: true });
    const out = join(HERE, 'dist', `resync-run-${date}.md`);
    writeFileSync(out, renderRecord(record, date, args.dryRun));
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
