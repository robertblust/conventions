#!/usr/bin/env node
// The body of the issue the scheduled report keeps current: a line naming the run that wrote it,
// then the report. GitHub refuses an issue body over 65536 characters, so a longer report is cut
// at the last whole line that fits and says the rest is in the run's artifact, which carries it
// whole. `node family/issue.mjs <markdown> <run-url>` prints the body.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ISSUE_LIMIT = 65536;

export function issueBody(markdown, runUrl, limit = ISSUE_LIMIT) {
  const note = `Written by the workflow run ${runUrl}.\n\n`;
  if (note.length + markdown.length <= limit) return `${note}${markdown}`;
  const tail = `\n\nThe report is cut here; the rest is in the run's artifact, family-report: ${runUrl}.\n`;
  const room = limit - note.length - tail.length;
  const lines = markdown.split('\n');
  let kept = '';
  for (const line of lines) {
    const next = kept === '' ? line : `${kept}\n${line}`;
    if (next.length > room) break;
    kept = next;
  }
  return `${note}${kept.replace(/\n+$/, '')}${tail}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, runUrl] = process.argv.slice(2);
  process.stdout.write(issueBody(readFileSync(file, 'utf8'), runUrl));
}
