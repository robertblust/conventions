import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orchestrate, nextMinor, membersOf, leftBehind } from '../../family/orchestrate.mjs';
import { assessFamily } from '../../family/report.mjs';
import { KINDS } from '../../family/pins.mjs';
import { commitMessage } from '../../family/words.mjs';
import { fakeGithub } from './fake-github.mjs';

const pinChain = (report, taker) => report.chains.find((c) => c.taker === taker && c.kind !== 'release').n;
const releaseChain = (report, taker) => report.chains.find((c) => c.taker === taker && c.kind === 'release').n;

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

test('the next minor resets the patch, and refuses a tag it cannot read', () => {
  assert.equal(nextMinor('v0.55.3'), 'v0.56.0');
  assert.throws(() => nextMinor('v2.0.0-rc1'));
  assert.throws(() => nextMinor(undefined));
});

test('a release that throws after update keeps pr and merge in the blocked record', () => {
  const github = world();
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const chain = pinChain(report, 'o/server');
  const calls = [];
  const member = {
    calls,
    update(repo, pins, opts) {
      calls.push({ op: 'update', repo, pins: pins.map((p) => `${p.upstream}@${p.available}`), verify: opts.verify });
      for (const p of pins) github.files[repo][p.file] = KINDS[p.kind].write(github.files[repo][p.file], p.upstream, p.available);
      return { pr: 'https://github.com/o/server/pull/1', merge: 'm1' };
    },
    release() {
      calls.push({ op: 'release' });
      throw new Error('gh release create failed');
    },
  };
  const record = orchestrate({ report, selection: [chain], github, member, date: '2026-09-28' });
  const server = record.find((r) => r.repo === 'o/server');
  assert.equal(server.status, 'blocked');
  assert.match(server.reason, /gh release create failed/);
  assert.equal(server.pr, 'https://github.com/o/server/pull/1');
  assert.equal(server.merge, 'm1');
});

test('a rerun releases a member whose pin already moved, then moves the next level onto it', () => {
  const github = world();
  github.files['o/server']['package.json'] = '{"m":"github:o/meta#v2.0.0"}';
  github.compares['o/server:v1.0.0...main'] = { aheadBy: 1, shas: ['s1'], files: [] };
  github.pulls['o/server:s1'] = ['resync-2026-09-28'];
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const chain = releaseChain(report, 'o/server');
  const member = fakeMember(github);
  const record = orchestrate({ report, selection: [chain], github, member, date: '2026-09-28' });
  assert.deepEqual(member.calls.map((c) => `${c.op} ${c.repo} ${c.pins?.join(',') ?? c.tag}`), [
    'release o/server v1.1.0',
    'update o/site o/server@v1.1.0',
  ]);
  assert.deepEqual(record.map((r) => `${r.repo} ${r.status}`), ['o/server done', 'o/site done']);
});

test('an undeclared pin does not cause a release', () => {
  const github = world();
  github.files['o/site']['pins.json'] = declare([npm('o/meta'), npm('o/other')]);
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const chain = pinChain(report, 'o/server');
  const member = fakeMember(github);
  const record = orchestrate({ report, selection: [chain], github, member, date: '2026-09-28' });
  assert.equal(member.calls.filter((c) => c.op === 'release').length, 0);
  assert.deepEqual(record.map((r) => `${r.repo} ${r.status}`), ['o/server done', 'o/site skipped']);
});

test('a member without pins.json holds its downstream', () => {
  const github = world();
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const chain = pinChain(report, 'o/server');
  delete github.files['o/server']['pins.json'];
  const member = fakeMember(github);
  const record = orchestrate({ report, selection: [chain], github, member, date: '2026-09-28' });
  assert.deepEqual(record.map((r) => `${r.repo} ${r.status}`), ['o/server unmanaged', 'o/site held']);
  assert.equal(record[0].reason, 'no pins.json');
  assert.match(record[1].reason, /waits on o\/server/);
});

test('an unknown chain number throws', () => {
  const github = world();
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const member = fakeMember(github);
  assert.throws(() => orchestrate({ report, selection: [9999], github, member, date: '2026-09-28' }), /no chain 9999 in the report/);
});

test('a commit message says what the member takes and what ran', () => {
  const m = commitMessage([{ upstream: 'o/meta', file: 'package.json', pinned: ['v1.0.0'], available: 'v2.0.0', url: 'um' }], ['npm install', 'npm test']);
  assert.equal(m.subject, 'Takes meta v2.0.0');
  assert.equal(m.full, 'Takes meta v2.0.0\n\nThe family resync moves o/meta in `package.json` from v1.0.0 to v2.0.0. The upstream notes are at um.\n\nVerified: `npm install` and `npm test` passed.\n\nProcess: Delivery\nPhase: Implement\nTrack: Code\n');
});

test('a read GitHub fails for one member blocks that member, holds its downstream and lets the rest go on', () => {
  const github = world();
  github.files['o/tool'] = { 'package.json': '{"m":"github:o/meta#v1.0.0"}', 'pins.json': declare([npm('o/meta')]) };
  const all = [...members, { repo: 'o/tool' }];
  const report = assessFamily({ github, members: all, drawing: new Set([...drawing, 'o/tool>o/meta']), date: '2026-09-28' });
  const file = github.file;
  github.file = (repo, ...rest) => {
    if (repo === 'o/server') throw new Error('gh api repos/o/server/contents/pins.json: HTTP 502');
    return file(repo, ...rest);
  };
  const member = fakeMember(github);
  const record = orchestrate({ report, selection: 'all', github, member, date: '2026-09-28' });
  assert.deepEqual(record.map((r) => `${r.repo} ${r.status}`), ['o/server blocked', 'o/tool done', 'o/site held']);
  assert.match(record[0].reason, /HTTP 502/);
  assert.match(record[2].reason, /waits on o\/server/);
});

const CONV = 'robertblust/conventions';
const conv = { kind: 'conventions', file: 'conventions.json', repo: CONV };
function withConventions(github) {
  github.files[CONV] = {};
  github.releases[CONV] = { tag: 'v1.35.0', url: 'uc' };
  github.files['o/server']['conventions.json'] = `{"repo":"${CONV}","tag":"v1.34.0"}`;
  github.files['o/server']['pins.json'] = declare([npm('o/meta'), conv], { verify: ['npm test'], release: ['bump {version}'] });
  return github;
}
const withConv = [{ repo: CONV }, ...members];

test('a conventions chain moves its taker alone and releases nothing', () => {
  const github = withConventions(world());
  const report = assessFamily({ github, members: withConv, drawing, date: '2026-09-28' });
  const chain = report.chains.find((c) => c.kind === 'conventions');
  assert.deepEqual(chain.steps, [['o/server']]);
  const member = fakeMember(github);
  const record = orchestrate({ report, selection: [chain.n], github, member, date: '2026-09-28' });
  assert.deepEqual(member.calls.map((c) => `${c.op} ${c.repo} ${c.pins?.join(',') ?? c.tag}`), [`update o/server ${CONV}@v1.35.0`]);
  assert.deepEqual(record.map((r) => `${r.repo} ${r.status} ${r.release}`), ['o/server done null']);
});

test('under all, a member that moved only its conventions pin is not released', () => {
  const github = withConventions(world());
  github.files['o/server']['package.json'] = '{"m":"github:o/meta#v2.0.0"}';
  const report = assessFamily({ github, members: withConv, drawing, date: '2026-09-28' });
  const member = fakeMember(github);
  orchestrate({ report, selection: 'all', github, member, date: '2026-09-28' });
  assert.deepEqual(member.calls.filter((c) => c.repo === 'o/server').map((c) => `${c.op} ${c.pins?.join(',') ?? c.tag}`), [`update ${CONV}@v1.35.0`]);
  const site = member.calls.find((c) => c.repo === 'o/site');
  assert.deepEqual([...site.pins].sort(), ['o/meta@v2.0.0', 'o/other@v1.1.0']);
});

test('a dry run says a member would re-pin an upstream it only released in the dry run', () => {
  const github = world();
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const calls = [];
  const member = {
    update(repo, pins) { calls.push(`update ${repo}`); return { pr: null, merge: null }; },
    release(repo, tag) { calls.push(`release ${repo} ${tag}`); return { tag: null }; },
  };
  const record = orchestrate({ report, selection: [pinChain(report, 'o/server')], github, member, date: '2026-09-28', dryRun: true });
  assert.deepEqual(calls, ['update o/server', 'release o/server v1.1.0']);
  assert.deepEqual(record.map((r) => `${r.repo} ${r.status} ${r.reason ?? ''}`), ['o/server done ', 'o/site skipped would re-pin o/server once it releases']);
});

test('a member that moved only its conventions pin still finishes a release an earlier run left undone', () => {
  const github = withConventions(world());
  github.files['o/server']['package.json'] = '{"m":"github:o/meta#v2.0.0"}';
  github.compares['o/server:v1.0.0...main'] = { aheadBy: 1, shas: ['s1'], files: [] };
  github.pulls['o/server:s1'] = ['resync-2026-09-27'];
  const report = assessFamily({ github, members: withConv, drawing, date: '2026-09-28' });
  const member = fakeMember(github);
  const record = orchestrate({ report, selection: 'all', github, member, date: '2026-09-28' });
  assert.deepEqual(member.calls.filter((c) => c.repo === 'o/server').map((c) => `${c.op} ${c.pins?.join(',') ?? c.tag}`), [`update ${CONV}@v1.35.0`, 'release v1.1.0']);
  assert.equal(record.find((r) => r.repo === 'o/server').release, 'v1.1.0');
  assert.ok(member.calls.find((c) => c.repo === 'o/site').pins.includes('o/server@v1.1.0'));
});

test('a member whose main holds only re-sync-only commits is still released when a later level takes it', () => {
  const github = world();
  github.compares['o/server:v1.0.0...main'] = { aheadBy: 2, shas: ['s1', 'm1'], files: [] };
  github.commits['o/server:s1'] = { subject: 'Takes conventions v1.35.0', parents: 1, parent: 'p1', files: ['conventions/WRITING.md', 'conventions.json'] };
  github.commits['o/server:m1'] = { subject: 'Merge pull request #3', parents: 2, parent: 'p2', files: ['conventions/WRITING.md', 'conventions.json'] };
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  assert.equal(report.members.find((m) => m.repo === 'o/server').blocked, null);
  const member = fakeMember(github);
  const record = orchestrate({ report, selection: [pinChain(report, 'o/server')], github, member, date: '2026-09-28' });
  assert.deepEqual(member.calls.map((c) => `${c.op} ${c.repo} ${c.pins?.join(',') ?? c.tag}`), [
    'update o/server o/meta@v2.0.0',
    'release o/server v1.1.0',
    'update o/site o/server@v1.1.0',
  ]);
  assert.deepEqual(record.map((r) => `${r.repo} ${r.status}`), ['o/server done', 'o/site done']);
});

test('a note from a release bump reaches the run record once, beside the update\'s', () => {
  const github = world();
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const chain = report.chains.find((c) => c.taker === 'o/server').n;
  const member = fakeMember(github);
  const personal = 'no clone of o/mental-model, so the commits carry the person\'s name';
  const { update, release } = member;
  member.update = (...a) => ({ ...update(...a), note: personal });
  member.release = (...a) => ({ ...release(...a), note: personal });
  const record = orchestrate({ report, selection: [chain], github, member, date: '2026-09-28' });
  assert.equal(record.find((r) => r.repo === 'o/server').note, personal);
});

test('a member that went through on a retry is done, and its record names each retry', () => {
  const github = world();
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const chain = report.chains.find((c) => c.taker === 'o/server').n;
  const member = fakeMember(github);
  const { update, release } = member;
  member.update = (...a) => ({ ...update(...a), retries: ['`npm test` failed once (fetch failed), passed on retry'] });
  member.release = (...a) => ({ ...release(...a), retries: ['the required check `verify` failed once, passed on rerun'] });
  const record = orchestrate({ report, selection: [chain], github, member, date: '2026-09-28' });
  const server = record.find((r) => r.repo === 'o/server');
  assert.equal(server.status, 'done');
  assert.deepEqual(server.retries, ['`npm test` failed once (fetch failed), passed on retry', 'the required check `verify` failed once, passed on rerun']);
});

test('a named member moves alone: nothing downstream runs, and it is not released', () => {
  const github = world();
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const member = fakeMember(github);
  const record = orchestrate({ report, selection: ['o/server'], github, member, date: '2026-09-28' });
  assert.deepEqual(member.calls.map((c) => `${c.op} ${c.repo} ${c.pins?.join(',') ?? c.tag}`), ['update o/server o/meta@v2.0.0']);
  assert.deepEqual(record.map((r) => `${r.repo} ${r.status}`), ['o/server done']);
  assert.deepEqual(leftBehind(report, ['o/server']), ['o/site']);
});

test('a name and a chain mix: the chain releases what it takes, the name adds its member', () => {
  const github = world();
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const site = report.chains.find((c) => c.taker === 'o/site' && c.upstream === 'o/other').n;
  const member = fakeMember(github);
  orchestrate({ report, selection: ['o/server', site], github, member, date: '2026-09-28' });
  assert.deepEqual(member.calls.map((c) => `${c.op} ${c.repo}`), ['update o/server', 'release o/server', 'update o/site']);
  const update = member.calls.find((c) => c.op === 'update' && c.repo === 'o/site');
  assert.deepEqual([...update.pins].sort(), ['o/other@v1.1.0', 'o/server@v1.1.0']);
});

test('a name given twice, or also a chosen chain\'s taker, runs once', () => {
  const github = world();
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const member = fakeMember(github);
  orchestrate({ report, selection: ['o/server', 'o/server', pinChain(report, 'o/server')], github, member, date: '2026-09-28' });
  assert.equal(member.calls.filter((c) => c.op === 'update' && c.repo === 'o/server').length, 1);
});

test('a name that is no member, or a member with nothing behind, refuses before anything moves', () => {
  const github = world();
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const member = fakeMember(github);
  assert.throws(() => orchestrate({ report, selection: ['o/nobody'], github, member, date: '2026-09-28' }), (e) => e.choice === true && /no member o\/nobody in the report/.test(e.message));
  assert.throws(() => orchestrate({ report, selection: ['o/meta'], github, member, date: '2026-09-28' }), (e) => e.choice === true && /o\/meta has no pin behind in the report/.test(e.message));
  assert.throws(() => orchestrate({ report, selection: [99], github, member, date: '2026-09-28' }), (e) => e.choice === true && /no chain 99/.test(e.message));
  assert.deepEqual(member.calls, []);
});

test('membersOf gathers the chains\' steps and the named members', () => {
  const github = world();
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const { closure, starts } = membersOf(report, ['o/server']);
  assert.deepEqual([...closure], ['o/server']);
  assert.equal(starts.size, 1);
  assert.deepEqual([...membersOf(report, 'all').closure].sort(), ['o/server', 'o/site']);
});

test('a named member whose only behind pin is its conventions pin moves and is not released', () => {
  const github = fakeGithub({
    files: {
      'robertblust/conventions': {},
      'o/server': { 'conventions.json': '{"repo":"robertblust/conventions","tag":"v1.0.0"}', 'pins.json': declare([{ kind: 'conventions', file: 'conventions.json', repo: 'robertblust/conventions' }]) },
      'o/site': { 'package.json': '{"s":"github:o/server#v1.0.0"}', 'pins.json': declare([npm('o/server')]) },
    },
    releases: { 'robertblust/conventions': { tag: 'v1.1.0', url: 'uc' }, 'o/server': { tag: 'v1.0.0', url: 'us' } },
  });
  const ms = ['robertblust/conventions', 'o/server', 'o/site'].map((repo) => ({ repo }));
  const report = assessFamily({ github, members: ms, drawing: new Set(['o/site>o/server']), date: '2026-09-28' });
  const member = fakeMember(github);
  orchestrate({ report, selection: ['o/server'], github, member, date: '2026-09-28' });
  assert.deepEqual(member.calls.map((c) => c.op), ['update']);
});

// o/server's main already holds o/meta v2.0.0 from hand pull request #7; its last release is v1.0.0.
function handMoved(github) {
  github.files['o/server']['package.json'] = '{"m":"github:o/meta#v2.0.0"}';
  github.files['o/server']['package.json@b7'] = '{"m":"github:o/meta#v1.0.0"}';
  github.files['o/server']['package.json@m7'] = '{"m":"github:o/meta#v2.0.0"}';
  github.compares['o/server:v1.0.0...main'] = { aheadBy: 1, shas: ['h1'], files: [] };
  github.commits['o/server:m7'] = { subject: 'Merge pull request #7', parents: 2, parent: 'b7', files: [] };
  github.pullRecords['o/server:h1'] = [{ number: 7, title: 'Takes meta v2.0.0', url: 'u7', head: 'meta-2', base: 'b7', merge: 'm7' }];
  return github;
}

test('a member moved by hand is released by the next run, its notes naming the pull request', () => {
  const github = handMoved(world());
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const member = fakeMember(github);
  orchestrate({ report, selection: [releaseChain(report, 'o/server')], github, member, date: '2026-09-28' });
  const rel = member.calls.find((c) => c.op === 'release' && c.repo === 'o/server');
  assert.equal(rel.tag, 'v1.1.0');
  assert.match(rel.notes, /\n\nIt also carries \[#7\]\(u7\), made by hand: Takes meta v2\.0\.0\.\n\n/);
  assert.ok(member.calls.some((c) => c.op === 'update' && c.repo === 'o/site'));
});

test('a dry run over a member moved by hand writes the same notes', () => {
  const github = handMoved(world());
  const report = assessFamily({ github, members, drawing, date: '2026-09-28' });
  const member = fakeMember(github);
  orchestrate({ report, selection: [releaseChain(report, 'o/server')], github, member, date: '2026-09-28', dryRun: true });
  assert.match(member.calls.find((c) => c.op === 'release').notes, /made by hand: Takes meta v2\.0\.0\./);
});
