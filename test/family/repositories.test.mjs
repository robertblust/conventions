import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMembers, parseDrawing } from '../../family/repositories.mjs';

const md = `| Repository | Title | Purpose | Default branch | Local path |
| --- | --- | --- | --- | --- |
| robertblust/design | Robert Blust — Design | x | main | ~/git/robertblust/design |
| companygraph/meta-model | CompanyGraph — Meta Model | x | main | x |

\`\`\`mermaid
flowchart TB
  subgraph robertblust
    design[design]
    blust[robertblust.github.io]
  end
  subgraph companygraph
    meta[meta-model]
  end
  blust -->|tag| design & meta
\`\`\`
`;

test('the members are the rows of the table', () => {
  assert.deepEqual(parseMembers(md).map((m) => m.repo), ['robertblust/design', 'companygraph/meta-model']);
  assert.equal(parseMembers(md)[0].title, 'Robert Blust — Design');
});

test('the drawing gives every pair an edge line joins', () => {
  assert.deepEqual([...parseDrawing(md)].sort(), [
    'robertblust/robertblust.github.io>companygraph/meta-model',
    'robertblust/robertblust.github.io>robertblust/design',
  ]);
});

test('a file without a drawing draws nothing', () => {
  assert.equal(parseDrawing('# nothing\n').size, 0);
});

test('the family file itself parses', () => {
  const real = readFileSync(new URL('../../conventions/REPOSITORIES.md', import.meta.url), 'utf8');
  assert.ok(parseMembers(real).some((m) => m.repo === 'robertblust/conventions'));
  assert.ok(parseDrawing(real).has('companygraph/mcp-server>companygraph/meta-model'));
});
