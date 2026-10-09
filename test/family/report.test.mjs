import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessFamily } from '../../family/report.mjs';
import { renderReport } from '../../family/render.mjs';
import { releaseBlock, pendingRelease } from '../../family/assess.mjs';
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

test('a member whose main is ahead only by a vendored resync merge is not pending and not blocked', () => {
  const github = world();
  github.compares['robertblust/design:v2.1.0...main'] = { aheadBy: 1, shas: ['s9'], files: [] };
  github.pulls['robertblust/design:s9'] = ['resync-vendored-2026-09-28'];
  const r = assessFamily({ github, members, drawing: new Set(['robertblust/site>robertblust/design']), date: '2026-09-28' });
  const m = Object.fromEntries(r.members.map((x) => [x.repo, x]));
  assert.equal(m['robertblust/design'].pending, false);
  assert.equal(m['robertblust/design'].blocked, null);
  assert.equal(releaseBlock(github, 'robertblust/design'), null);
  assert.ok(!r.chains.some((c) => c.kind === 'release'));
});

test('a vendored and a propagating resync merge together are pending', () => {
  const github = world();
  github.compares['robertblust/design:v2.1.0...main'] = { aheadBy: 2, shas: ['s8', 's9'], files: [] };
  github.pulls['robertblust/design:s8'] = ['resync-vendored-2026-09-27'];
  github.pulls['robertblust/design:s9'] = ['resync-2026-09-28'];
  assert.equal(pendingRelease(github, 'robertblust/design'), true);
  assert.equal(releaseBlock(github, 'robertblust/design'), null);
});

test('a blocked member names its unreleased commits under its bullet, marking a re-sync', () => {
  const github = world();
  github.commits['robertblust/design:s1'] = { subject: 'Takes conventions v1.0.0', parents: 1, files: ['conventions/WRITING.md', 'conventions.json'] };
  github.commits['robertblust/design:s2'] = { subject: 'Tokens | spacing', parents: 1, files: ['tokens.css'] };
  const r = assessFamily({ github, members, drawing: new Set(['robertblust/site>robertblust/design']), date: '2026-09-28' });
  const m = Object.fromEntries(r.members.map((x) => [x.repo, x]));
  assert.equal(m['robertblust/design'].unreleased.compare, 'https://github.com/robertblust/design/compare/v2.1.0...main');
  assert.equal(m['robertblust/site'].unreleased, null);
  const md = renderReport(r);
  assert.match(md, /- robertblust\/design: unreleased work on main: 1 commit since v2\.1\.0\n  - \[v2\.1\.0\.\.\.main\]\(https:\/\/github\.com\/robertblust\/design\/compare\/v2\.1\.0\.\.\.main\)\n  - s1 Takes conventions v1\.0\.0 \(re-sync only\)\n  - s2 Tokens \\\| spacing\n/);
});

test('a hand pin move is marked in the commit list', () => {
  const github = world();
  github.commits['robertblust/design:s1'] = { subject: 'Takes meta v2.0.0', parents: 1, files: ['package.json'] };
  github.commits['robertblust/design:s2'] = { subject: 'Tokens spacing', parents: 1, files: ['tokens.css'] };
  github.files['robertblust/design']['pins.json'] = declare(C, { kind: 'npm-tag', file: 'package.json', repo: 'robertblust/meta' });
  github.files['robertblust/design']['conventions.json@b1'] = conv('v1.0.0');
  github.files['robertblust/design']['conventions.json@m1'] = conv('v1.0.0');
  github.files['robertblust/design']['package.json@b1'] = '{"m":"github:robertblust/meta#v1.0.0"}';
  github.files['robertblust/design']['package.json@m1'] = '{"m":"github:robertblust/meta#v2.0.0"}';
  github.commits['robertblust/design:m1'] = { subject: 'Merge pull request #1', parents: 2, files: [], parent: 'b1' };
  github.pullRecords['robertblust/design:s1'] = [{ number: 1, title: 'Takes meta v2.0.0', url: 'u1', head: 'meta-2', base: 'b1', merge: 'm1' }];
  const r = assessFamily({ github, members, drawing: new Set(['robertblust/site>robertblust/design']), date: '2026-09-28' });
  assert.match(renderReport(r), /\n  - s1 Takes meta v2\.0\.0 \(pin move\)\n  - s2 Tokens spacing\n/);
});

test('the Main section names a red, running or unknown main', () => {
  const github = world();
  github.runs['robertblust/design'] = [{ name: 'test', status: 'completed', conclusion: 'failure' }, { name: 'conventions', status: 'completed', conclusion: 'cancelled' }];
  github.runs['robertblust/site'] = [{ name: 'test', status: 'in_progress', conclusion: null }];
  github.runs['robertblust/conventions'] = () => { throw new Error('HTTP 502'); };
  const r = assessFamily({ github, members, drawing: new Set(['robertblust/site>robertblust/design']), date: '2026-09-28' });
  const m = Object.fromEntries(r.members.map((x) => [x.repo, x]));
  assert.deepEqual(m['robertblust/design'].main, { state: 'red', failing: ['conventions', 'test'] });
  assert.deepEqual(m['robertblust/conventions'].main, { state: 'unknown', failing: [] });
  assert.equal(m['robertblust/gone'].main, null);
  const md = renderReport(r);
  assert.match(md, /Blocked:[\s\S]*## Main\n\n- robertblust\/conventions: main's checks could not be read\n- robertblust\/design: main is red \(conventions, test\), so the run will block here\n- robertblust\/site: main's checks are still running\n\n## Level 0/);
});

test('the Main section is one line when every main is green or has no checks', () => {
  const github = world();
  github.runs['robertblust/design'] = [{ name: 'test', status: 'completed', conclusion: 'success' }];
  const md = renderReport(assessFamily({ github, members, drawing: new Set(['robertblust/site>robertblust/design']), date: '2026-09-28' }));
  assert.match(md, /## Main\n\nEvery member's main is green\.\n\n## Level 0/);
});

test('a commit the report cannot read leaves its list, not the report', () => {
  const github = world();
  github.commits['robertblust/design:s2'] = () => { throw new Error('HTTP 502'); };
  const r = assessFamily({ github, members, drawing: new Set(['robertblust/site>robertblust/design']), date: '2026-09-28' });
  const m = Object.fromEntries(r.members.map((x) => [x.repo, x]));
  assert.deepEqual(m['robertblust/design'].unreleased, { since: 'v2.1.0', compare: 'https://github.com/robertblust/design/compare/v2.1.0...main', commits: null, error: 'HTTP 502' });
  const md = renderReport(r);
  assert.match(md, /- robertblust\/design: unreleased work on main: 2 commits since v2\.1\.0, 1 commit could not be read: HTTP 502\n  - \[v2\.1\.0\.\.\.main\]\(https:\/\/github\.com\/robertblust\/design\/compare\/v2\.1\.0\.\.\.main\)\n  - the commits could not be read: HTTP 502\n\n/);
});

test('the re-sync-only label follows the AGENTS.md rule', () => {
  const github = world();
  const block = '<!-- conventions · v1.0.0 -->\nShared.\n<!-- end conventions -->\n';
  github.files['robertblust/design']['AGENTS.md@s1'] = block.replace('Shared.', 'Shared, newer.');
  github.files['robertblust/design']['AGENTS.md@p1'] = block;
  github.files['robertblust/design']['AGENTS.md@s2'] = `${block}Own words, changed.\n`;
  github.files['robertblust/design']['AGENTS.md@p2'] = `${block}Own words.\n`;
  github.commits['robertblust/design:s1'] = { subject: 'Takes conventions v1.0.0', parents: 1, parent: 'p1', files: ['AGENTS.md', 'conventions.json'] };
  github.commits['robertblust/design:s2'] = { subject: 'Says more', parents: 1, parent: 'p2', files: ['AGENTS.md'] };
  const r = assessFamily({ github, members, drawing: new Set(['robertblust/site>robertblust/design']), date: '2026-09-28' });
  const m = Object.fromEntries(r.members.map((x) => [x.repo, x]));
  assert.equal(m['robertblust/design'].blocked, 'unreleased work on main: 1 commit since v2.1.0');
  assert.deepEqual(m['robertblust/design'].unreleased.commits.map((c) => `${c.sha} ${c.resyncOnly}`), ['s1 true', 's2 false']);
  assert.match(renderReport(r), /  - s1 Takes conventions v1\.0\.0 \(re-sync only\)\n  - s2 Says more\n/);
});

test('a check in verify whose writer the steps never run is named under What disagrees', () => {
  const github = world();
  github.files['robertblust/site']['package.json'] = '{"scripts":{"sitemap":"node s.mjs","sitemap:check":"node s.mjs --check"},"d":"github:robertblust/design#v2.0.0","x":"github:someone/else#v1"}';
  github.files['robertblust/site']['pins.json'] = JSON.stringify({ pins: [C, { kind: 'npm-tag', file: 'package.json', repo: 'robertblust/design', after: ['npm run design'] }], verify: ['npm test && npm run sitemap:check'] });
  const r = assessFamily({ github, members, drawing: new Set(['robertblust/site>robertblust/design']), date: '2026-09-28' });
  assert.deepEqual(r.problems.filter((p) => p.type === 'missing-step'), [{ type: 'missing-step', repo: 'robertblust/site', text: 'pins.json never runs `npm run sitemap`, which `sitemap:check` in its verify checks' }]);
  assert.match(renderReport(r), /## What disagrees\n\n(- .*\n)*- robertblust\/site: pins\.json never runs `npm run sitemap`, which `sitemap:check` in its verify checks\n/);
});
