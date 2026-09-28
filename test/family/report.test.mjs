import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessFamily } from '../../family/report.mjs';
import { renderReport } from '../../family/render.mjs';
import { longDate, listed } from '../../family/words.mjs';
import { fakeGithub } from './fake-github.mjs';

const conv = (tag) => `{"repo":"robertblust/conventions","tag":"${tag}"}`;
const declare = (...pins) => JSON.stringify({ pins });
const C = { kind: 'conventions', file: 'conventions.json', repo: 'robertblust/conventions' };

function world() {
  return fakeGithub({
    files: {
      'robertblust/conventions': { 'conventions.json': conv('v1.0.0') },
      'robertblust/design': { 'conventions.json': conv('v1.0.0'), 'pins.json': declare(C) },
      'robertblust/site': {
        'conventions.json': conv('v0.9.0'),
        'package.json': '{"d":"github:robertblust/design#v2.0.0","x":"github:someone/else#v1"}',
        'pins.json': declare(C, { kind: 'npm-tag', file: 'package.json', repo: 'robertblust/design' }),
      },
    },
    releases: { 'robertblust/conventions': { tag: 'v1.0.0', url: 'u1' }, 'robertblust/design': { tag: 'v2.1.0', url: 'u2' } },
    compares: { 'robertblust/design:v2.1.0...main': { aheadBy: 2, shas: ['s1', 's2'], files: [] } },
    unreachable: ['robertblust/gone'],
  });
}
const members = ['robertblust/conventions', 'robertblust/design', 'robertblust/site', 'robertblust/gone'].map((repo) => ({ repo }));

test('the report levels the family, blocks, chains and names what disagrees', () => {
  const r = assessFamily({ github: world(), members, drawing: new Set(['robertblust/site>robertblust/design']), date: '2026-09-28' });
  const m = Object.fromEntries(r.members.map((x) => [x.repo, x]));
  assert.equal(m['robertblust/conventions'].level, 0);
  assert.equal(m['robertblust/design'].level, 1);
  assert.equal(m['robertblust/site'].level, 2);
  assert.equal(m['robertblust/gone'].level, null);
  assert.equal(m['robertblust/design'].blocked, 'unreleased work on main: 2 commits since v2.1.0');
  assert.deepEqual(r.chains.map((c) => `${c.n} ${c.taker} ${c.upstream}`), ['1 robertblust/site robertblust/conventions', '2 robertblust/site robertblust/design']);
  assert.deepEqual(r.problems.map((p) => `${p.type} ${p.repo}`).sort(), ['outside robertblust/site', 'unreachable robertblust/gone']);
});

test('a pin the drawing does not show is named', () => {
  const r = assessFamily({ github: world(), members, drawing: new Set(), date: '2026-09-28' });
  assert.ok(r.problems.some((p) => p.type === 'undrawn' && p.repo === 'robertblust/site' && /robertblust\/design/.test(p.text)));
});

test('the Markdown opens with the counts and has one table per level', () => {
  const md = renderReport(assessFamily({ github: world(), members, drawing: new Set(['robertblust/site>robertblust/design']), date: '2026-09-28' }));
  assert.match(md, /^# Family resync report, Sep 28, 2026\n\n2 behind, 1 current, 0 unmanaged, 0 drift\.\n/);
  assert.match(md, /- robertblust\/design: unreleased work on main: 2 commits since v2\.1\.0/);
  assert.match(md, /## Level 2\n\n\| Member \| Pin \| Upstream \| Pinned \| Available \| Status \|\n\| --- \| --- \| --- \| --- \| --- \| --- \|\n/);
  assert.match(md, /\| robertblust\/site \| npm-tag `package.json` \| robertblust\/design \| v2\.0\.0 \| v2\.1\.0 \| behind \|/);
  assert.match(md, /## Chains\n\n1\. robertblust\/conventions v1\.0\.0 → robertblust\/site\n2\. robertblust\/design v2\.1\.0 → robertblust\/site\n/);
  assert.match(md, /## What disagrees\n\n/);
  assert.ok(md.endsWith('\n') && !md.endsWith('\n\n'));
});

test('a member whose main only holds resync work gets a pending release chain', () => {
  const github = world();
  github.compares['robertblust/design:v2.1.0...main'] = { aheadBy: 1, shas: ['s9'], files: [] };
  github.pulls['robertblust/design:s9'] = ['resync-2026-09-28'];
  const r = assessFamily({ github, members, drawing: new Set(['robertblust/site>robertblust/design']), date: '2026-09-28' });
  const m = Object.fromEntries(r.members.map((x) => [x.repo, x]));
  assert.equal(m['robertblust/design'].pending, true);
  assert.equal(m['robertblust/design'].blocked, null);
  assert.equal(m['robertblust/conventions'].pending, false);
  const chain = r.chains.find((c) => c.kind === 'release' && c.taker === 'robertblust/design');
  assert.ok(chain);
  const md = renderReport(r);
  assert.match(md, /has unreleased resync work/);
});

test('a member taken by tag only through an undeclared pin gets no pending chain', () => {
  const github = fakeGithub({
    files: {
      'robertblust/conventions': { 'conventions.json': conv('v1.0.0') },
      'robertblust/design': { 'conventions.json': conv('v1.0.0'), 'pins.json': declare(C) },
      'robertblust/extra': { 'pins.json': declare() },
      'robertblust/site': {
        'conventions.json': conv('v1.0.0'),
        'package.json': '{"d":"github:robertblust/design#v2.1.0","e":"github:robertblust/extra#v1.0.0"}',
        'pins.json': declare(C, { kind: 'npm-tag', file: 'package.json', repo: 'robertblust/design' }),
      },
    },
    releases: { 'robertblust/conventions': { tag: 'v1.0.0', url: 'u1' }, 'robertblust/design': { tag: 'v2.1.0', url: 'u2' }, 'robertblust/extra': { tag: 'v1.0.0', url: 'u3' } },
    compares: { 'robertblust/extra:v1.0.0...main': { aheadBy: 1, shas: ['s1'], files: [] } },
    pulls: { 'robertblust/extra:s1': ['resync-2026-09-28'] },
  });
  const extraMembers = ['robertblust/conventions', 'robertblust/design', 'robertblust/site', 'robertblust/extra'].map((repo) => ({ repo }));
  const extraDrawing = new Set(['robertblust/site>robertblust/design', 'robertblust/site>robertblust/extra']);
  const r = assessFamily({ github, members: extraMembers, drawing: extraDrawing, date: '2026-09-28' });
  const m = Object.fromEntries(r.members.map((x) => [x.repo, x]));
  assert.equal(m['robertblust/extra'].pending, false);
  assert.ok(!r.chains.some((c) => c.kind === 'release' && c.taker === 'robertblust/extra'));
});

test('dates and lists read as the family writes them', () => {
  assert.equal(longDate('2026-09-28'), 'Sep 28, 2026');
  assert.equal(listed(['a', 'b', 'c']), 'a, b and c');
  assert.equal(listed(['a']), 'a');
});
