import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orchestrate, nextMinor } from '../../family/orchestrate.mjs';
import { assessFamily } from '../../family/report.mjs';
import { KINDS } from '../../family/pins.mjs';
import { commitMessage } from '../../family/words.mjs';
import { fakeGithub } from './fake-github.mjs';

const declare = (pins, extra = {}) => JSON.stringify({ pins, ...extra });
const npm = (repo) => ({ kind: 'npm-tag', file: 'package.json', repo });

function world() {
  return fakeGithub({
    files: {
      'o/meta': {},
      'o/other': {},
      'o/server': { 'package.json': '{"m":"github:o/meta#v1.0.0"}', 'pins.json': declare([npm('o/meta')], { verify: ['npm test'], release: ['bump {version}'] }) },
      'o/site': { 'package.json': '{"s":"github:o/server#v1.0.0","m":"github:o/meta#v1.0.0","x":"github:o/other#v1.0.0"}', 'pins.json': declare([npm('o/server'), npm('o/meta'), npm('o/other')]) },
    },
    releases: { 'o/meta': { tag: 'v2.0.0', url: 'um' }, 'o/server': { tag: 'v1.0.0', url: 'us' }, 'o/other': { tag: 'v1.1.0', url: 'uo' } },
  });
}
const members = ['o/meta', 'o/other', 'o/server', 'o/site'].map((repo) => ({ repo }));
const drawing = new Set(['o/server>o/meta', 'o/site>o/server', 'o/site>o/meta', 'o/site>o/other']);

// A member that does what the real one does to GitHub's state: it moves the pins, and a release
// becomes the latest release of its repository.
function fakeMember(github, { blockOn = [] } = {}) {
  const calls = [];
  return {
    calls,
    update(repo, pins, opts) {
      calls.push({ op: 'update', repo, pins: pins.map((p) => `${p.upstream}@${p.available}`), verify: opts.verify });
      if (blockOn.includes(repo)) throw new Error('`npm test` failed');
      for (const p of pins) github.files[repo][p.file] = KINDS[p.kind].write(github.files[repo][p.file], p.upstream, p.available);
      return { pr: `https://github.com/${repo}/pull/1`, merge: 'm1' };
    },
    release(repo, tag, notes, commands) {
      calls.push({ op: 'release', repo, tag, commands, notes });
      github.releases[repo] = { tag, url: `r-${repo}` };
      return { tag };
    },
  };
}

test('a chain moves level by level, and a member a later level takes is released between', () => {
  const github = world();
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const chain = report.chains.find((c) => c.taker === 'o/server').n;
  const member = fakeMember(github);
  const record = orchestrate({ report, selection: [chain], github, member, date: '2026-09-28' });
  assert.deepEqual(member.calls.map((c) => `${c.op} ${c.repo} ${c.pins?.join(',') ?? c.tag}`), [
    'update o/server o/meta@v2.0.0',
    'release o/server v1.1.0',
    'update o/site o/server@v1.1.0',
  ]);
  assert.deepEqual(member.calls[0].verify, ['npm test']);
  assert.deepEqual(member.calls[1].commands, ['bump {version}']);
  assert.deepEqual(record.map((r) => `${r.repo} ${r.status}`), ['o/server done', 'o/site done']);
});

test('all moves every behind pin of a member in one update', () => {
  const github = world();
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const member = fakeMember(github);
  orchestrate({ report, selection: 'all', github, member, date: '2026-09-28' });
  const site = member.calls.filter((c) => c.op === 'update' && c.repo === 'o/site');
  assert.equal(site.length, 1);
  assert.deepEqual([...site[0].pins].sort(), ['o/meta@v2.0.0', 'o/other@v1.1.0', 'o/server@v1.1.0']);
});

test('a blocked member holds everything downstream of it', () => {
  const github = world();
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const member = fakeMember(github, { blockOn: ['o/server'] });
  const record = orchestrate({ report, selection: 'all', github, member, date: '2026-09-28' });
  assert.deepEqual(record.map((r) => `${r.repo} ${r.status}`), ['o/server blocked', 'o/site held']);
  assert.match(record[0].reason, /npm test/);
  assert.match(record[1].reason, /waits on o\/server/);
});

test('work on main that no release describes blocks a member before it is moved', () => {
  const github = world();
  github.compares['o/server:v1.0.0...main'] = { aheadBy: 2, shas: ['s1', 's2'], files: [] };
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const member = fakeMember(github);
  const record = orchestrate({ report, selection: 'all', github, member, date: '2026-09-28' });
  assert.equal(member.calls.filter((c) => c.repo === 'o/server').length, 0);
  assert.match(record.find((r) => r.repo === 'o/server').reason, /unreleased work on main: 2 commits since v1\.0\.0/);
});

test('the next minor resets the patch', () => {
  assert.equal(nextMinor('v0.55.3'), 'v0.56.0');
  assert.equal(nextMinor(undefined), 'v0.1.0');
});

test('a commit message says what the member takes and what ran', () => {
  const m = commitMessage([{ upstream: 'o/meta', file: 'package.json', pinned: ['v1.0.0'], available: 'v2.0.0', url: 'um' }], ['npm install', 'npm test']);
  assert.equal(m.subject, 'Takes meta v2.0.0');
  assert.equal(m.full, 'Takes meta v2.0.0\n\nThe family resync moves o/meta in `package.json` from v1.0.0 to v2.0.0. The upstream notes are at um.\n\nVerified: `npm install` and `npm test` passed.\n');
});
