import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { issueBody, ISSUE_LIMIT } from '../../family/issue.mjs';

const RUN = 'https://github.com/robertblust/conventions/actions/runs/7';

test('the issue body opens with the run and carries the report whole when it fits', () => {
  const markdown = '# Family resync report\n\nAll in step.\n';
  const body = issueBody(markdown, RUN);
  assert.equal(body, `Written by the workflow run ${RUN}.\n\n${markdown}`);
  assert.equal(ISSUE_LIMIT, 65536);
});

test('a report too long for an issue is cut at a line below the cap and says where the rest is', () => {
  const lines = Array.from({ length: 50 }, (_, i) => `line ${i} ${'—'.repeat(20)}`);
  const markdown = `${lines.join('\n')}\n`;
  const limit = 400;
  const body = issueBody(markdown, RUN, limit);
  assert.ok(body.length <= limit, `${body.length} > ${limit}`);
  const [head, ...rest] = body.split('\n\n');
  assert.equal(head, `Written by the workflow run ${RUN}.`);
  const tail = rest.pop();
  assert.equal(tail, `The report is cut here; the rest is in the run's artifact, family-report: ${RUN}.\n`);
  const kept = rest.join('\n\n').split('\n');
  assert.ok(kept.length > 0);
  assert.deepEqual(kept, lines.slice(0, kept.length), 'only whole lines, from the start');
});

test('the report at exactly the cap is not cut', () => {
  const note = `Written by the workflow run ${RUN}.\n\n`;
  const markdown = `${'x'.repeat(100 - note.length - 1)}\n`;
  assert.equal(issueBody(markdown, RUN, 100), `${note}${markdown}`);
});

test('the entry prints the body of the Markdown file it is given', () => {
  const dir = mkdtempSync(join(tmpdir(), 'issue-'));
  const file = join(dir, 'resync-2026-10-01.md');
  writeFileSync(file, '# Report\n');
  const script = join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), 'family/issue.mjs');
  const out = execFileSync('node', [script, file, RUN], { encoding: 'utf8' });
  assert.equal(out, `Written by the workflow run ${RUN}.\n\n# Report\n`);
});
