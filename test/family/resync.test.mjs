import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs, runResync, cleanDryRuns, lockRun, withLock, guardPulls, listResyncPulls, ownPulls, recordPull } from '../../family/resync.mjs';
import { assessFamily } from '../../family/report.mjs';
import { KINDS } from '../../family/pins.mjs';
import { fakeGithub } from './fake-github.mjs';
import { renderRecord } from '../../family/render.mjs';

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();

test('the choice is all or chain numbers, with an optional dry run', () => {
  assert.deepEqual(parseArgs(['r.json', 'all']), { file: 'r.json', selection: 'all', dryRun: false, force: false });
  assert.deepEqual(parseArgs(['r.json', '3', '5', '--dry-run']), { file: 'r.json', selection: [3, 5], dryRun: true, force: false });
  assert.deepEqual(parseArgs(['r.json', 'all', '--force']), { file: 'r.json', selection: 'all', dryRun: false, force: true });
  assert.equal(parseArgs(['r.json']), null);
  assert.equal(parseArgs(['r.json', 'x']), null);
  assert.equal(parseArgs(['r.json', '0']), null);
});

test('--clean-dry-runs takes no report argument', () => {
  assert.deepEqual(parseArgs(['--clean-dry-runs']), { cleanDryRuns: true });
});

test('--clean-dry-runs removes only the dry-run worktree and its branch', () => {
  const root = mkdtempSync(join(tmpdir(), 'clean-dry-runs-'));
  const dir = join(root, 'o/site');
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'f.txt'), 'x\n');
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.email=t@x', '-c', 'user.name=T', 'commit', '-q', '-m', 'seed');
  const dryWt = join(root, 'o/site-dry-run-2026-09-28');
  const realWt = join(root, 'o/site-resync-2026-09-28');
  git(dir, 'worktree', 'add', '-q', '-b', 'dry-run-2026-09-28', dryWt);
  git(dir, 'worktree', 'add', '-q', '-b', 'resync-2026-09-28', realWt);
  const said = [];
  cleanDryRuns({ root, members: [{ repo: 'o/site' }, { repo: 'o/absent' }], log: (m) => said.push(m) });
  assert.equal(existsSync(dryWt), false);
  assert.equal(existsSync(realWt), true);
  assert.doesNotMatch(git(dir, 'branch', '--list'), /dry-run-2026-09-28/);
  assert.match(git(dir, 'branch', '--list'), /resync-2026-09-28/);
  assert.deepEqual(said, ['o/site: removed dry-run-2026-09-28']);
});

test('the run record has a row per member', () => {
  const md = renderRecord([
    { repo: 'o/server', status: 'done', pr: 'https://x/1', merge: 'a'.repeat(40), release: 'v1.1.0', note: null },
    { repo: 'o/site', status: 'held', reason: 'waits on o/server' },
  ], '2026-09-28', false);
  assert.match(md, /^# Family resync run, Sep 28, 2026\n\n\| Member \| Status \| Pull request \| Merge \| Release \| Note \|\n/);
  assert.match(md, /\| o\/server \| done \| https:\/\/x\/1 \| aaaaaaa \| v1\.1\.0 \| {2}\|/);
  assert.match(md, /\| o\/site \| held \| {2}\| {2}\| {2}\| waits on o\/server \|/);
});

test('a run that moved nothing says so', () => {
  assert.match(renderRecord([], '2026-09-28', true), /^# Family resync run, Sep 28, 2026 \(dry run\)\n\nThe choice moved nothing\.\n$/);
});

test('a run that stops partway still writes the record of what it did', () => {
  const pins = JSON.stringify({ pins: [{ kind: 'npm-tag', file: 'package.json', repo: 'o/meta' }] });
  const github = fakeGithub({
    files: { 'o/meta': {}, 'o/a': { 'package.json': '{"m":"github:o/meta#v1.0.0"}', 'pins.json': pins }, 'o/b': { 'package.json': '{"m":"github:o/meta#v1.0.0"}', 'pins.json': pins } },
    releases: { 'o/meta': { tag: 'v2.0.0', url: 'um' } },
  });
  const report = assessFamily({ github, members: ['o/meta', 'o/a', 'o/b'].map((repo) => ({ repo })), drawing: new Set(['o/a>o/meta', 'o/b>o/meta']), date: '2026-09-28' });
  const member = {
    update(repo, moved) {
      for (const p of moved) github.files[repo][p.file] = KINDS[p.kind].write(github.files[repo][p.file], p.upstream, p.available);
      return { pr: `https://github.com/${repo}/pull/1`, merge: 'a'.repeat(40) };
    },
  };
  let said = 0;
  const log = () => { said += 1; if (said === 2) throw new Error('the terminal went away'); };
  const outDir = mkdtempSync(join(tmpdir(), 'resync-'));
  assert.throws(() => runResync({ report, selection: 'all', dryRun: false, github, member, date: '2026-09-28', outDir, log }), /the terminal went away/);
  const md = readFileSync(join(outDir, 'resync-run-2026-09-28.md'), 'utf8');
  assert.match(md, /\| o\/a \| done \|/);
});

test('a chain the report does not hold writes no record', () => {
  const github = fakeGithub({ files: { 'o/meta': {} } });
  const report = assessFamily({ github, members: [{ repo: 'o/meta' }], drawing: new Set(), date: '2026-09-28' });
  const outDir = mkdtempSync(join(tmpdir(), 'resync-'));
  assert.throws(() => runResync({ report, selection: [7], dryRun: false, github, member: {}, date: '2026-09-28', outDir, log: () => {} }), /no chain 7/);
  assert.equal(existsSync(join(outDir, 'resync-run-2026-09-28.md')), false);
});

const lockPath = () => join(mkdtempSync(join(tmpdir(), 'resync-lock-')), 'dist', 'resync.lock');
const deadPid = () => spawnSync('true').pid;

test('a lock whose run is alive refuses, naming its pid and start', () => {
  const path = lockPath();
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify({ pid: process.pid, started: '2026-10-01T08:00:00.000Z', args: ['r.json', 'all'] }));
  assert.throws(() => lockRun({ path, args: ['r.json', '1'], pid: 999999, log: () => {} }), (e) => e.refused && new RegExp(`pid ${process.pid}, started 2026-10-01T08:00:00.000Z`).test(e.message));
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).pid, process.pid);
});

test('a lock whose run is gone is taken over, and the run says so', () => {
  const path = lockPath();
  mkdirSync(join(path, '..'), { recursive: true });
  const dead = deadPid();
  writeFileSync(path, JSON.stringify({ pid: dead, started: '2026-09-30T08:00:00.000Z', args: ['r.json', 'all'] }));
  const said = [];
  const release = lockRun({ path, args: ['r.json', 'all'], log: (m) => said.push(m) });
  const held = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(held.pid, process.pid);
  assert.deepEqual(held.args, ['r.json', 'all']);
  assert.match(held.started, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(said.join('\n'), new RegExp(`took over .*pid ${dead}`));
  release();
  assert.equal(existsSync(path), false);
});

test('the lock is gone after a run that ends and after one that throws', () => {
  const path = lockPath();
  assert.equal(withLock({ path, args: ['r.json', 'all'], log: () => {} }, () => { assert.equal(existsSync(path), true); return 7; }), 7);
  assert.equal(existsSync(path), false);
  assert.throws(() => withLock({ path, args: ['r.json', 'all'], log: () => {} }, () => { throw new Error('the run broke'); }), /the run broke/);
  assert.equal(existsSync(path), false);
});

const pullsOf = (open) => (repo) => open[repo] ?? [];
const members = [{ repo: 'companygraph/chat-server' }, { repo: 'o/site' }];
const guard = (list, own, force = false, log = () => {}) => () => guardPulls({ members, own, force, list, log });

test('an open pull request on an older resync branch refuses, naming it and --force', () => {
  const list = pullsOf({ 'companygraph/chat-server': [{ number: 64, headRefName: 'resync-2026-09-29-release', url: 'u64' }] });
  assert.throws(guard(list, new Set()), (e) => e.refused
    && /companygraph\/chat-server #64 resync-2026-09-29-release is open/.test(e.message) && /--force/.test(e.message));
});

test('an open pull request on today’s branch name that today’s record does not name refuses', () => {
  const list = pullsOf({ 'o/site': [{ number: 5, headRefName: 'resync-2026-10-01', url: 'https://github.com/o/site/pull/5' }] });
  assert.throws(guard(list, new Set(['https://github.com/o/site/pull/4'])), (e) => e.refused && /o\/site #5 resync-2026-10-01 is open/.test(e.message));
});

test('an open pull request that today’s record names does not refuse', () => {
  const list = pullsOf({
    'companygraph/chat-server': [{ number: 70, headRefName: 'resync-2026-10-01', url: 'u70' }],
    'o/site': [{ number: 3, headRefName: 'resync-vendored-2026-10-01', url: 'u3' }],
  });
  assert.doesNotThrow(guard(list, new Set(['u70', 'u3'])));
});

test('--force runs beside a pull request no record names, and says so', () => {
  const list = pullsOf({ 'o/site': [{ number: 9, headRefName: 'resync-vendored-2026-09-30', url: 'u' }] });
  const said = [];
  assert.doesNotThrow(guard(list, new Set(), true, (m) => said.push(m)));
  assert.match(said.join('\n'), /o\/site #9 resync-vendored-2026-09-30 is open/);
});

test('the open pull requests are asked of gh and only resync branches kept', () => {
  const calls = [];
  const run = (args) => { calls.push(args); return JSON.stringify([{ number: 1, headRefName: 'resync-2026-09-29', url: 'a' }, { number: 2, headRefName: 'a-feature', url: 'b' }]); };
  assert.deepEqual(listResyncPulls('o/site', run), [{ number: 1, headRefName: 'resync-2026-09-29', url: 'a' }]);
  assert.deepEqual(calls, [['pr', 'list', '--repo', 'o/site', '--state', 'open', '--limit', '100', '--json', 'number,headRefName,url']]);
});

test('without a record of today, no pull request is the run’s own, and every open resync one refuses', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'resync-'));
  const own = ownPulls(outDir, '2026-10-01');
  assert.equal(own.size, 0);
  const list = pullsOf({ 'o/site': [{ number: 5, headRefName: 'resync-2026-10-01', url: 'u5' }] });
  assert.throws(guard(list, own), (e) => e.refused);
});

test('a run writes its record as JSON, and its pull requests are its own the same day', () => {
  const pins = JSON.stringify({ pins: [{ kind: 'npm-tag', file: 'package.json', repo: 'o/meta' }] });
  const github = fakeGithub({
    files: { 'o/meta': {}, 'o/a': { 'package.json': '{"m":"github:o/meta#v1.0.0"}', 'pins.json': pins } },
    releases: { 'o/meta': { tag: 'v2.0.0', url: 'um' } },
  });
  const report = assessFamily({ github, members: ['o/meta', 'o/a'].map((repo) => ({ repo })), drawing: new Set(['o/a>o/meta']), date: '2026-10-01' });
  const member = {
    update(repo, moved) {
      for (const p of moved) github.files[repo][p.file] = KINDS[p.kind].write(github.files[repo][p.file], p.upstream, p.available);
      return { pr: `https://github.com/${repo}/pull/1`, merge: 'a'.repeat(40) };
    },
  };
  const outDir = mkdtempSync(join(tmpdir(), 'resync-'));
  const { record } = runResync({ report, selection: 'all', dryRun: false, github, member, date: '2026-10-01', outDir, log: () => {} });
  assert.deepEqual(JSON.parse(readFileSync(join(outDir, 'resync-run-2026-10-01.json'), 'utf8')), record);
  assert.deepEqual([...ownPulls(outDir, '2026-10-01')], ['https://github.com/o/a/pull/1']);
  assert.equal(ownPulls(outDir, '2026-10-02').size, 0);
});

test('a run killed after it opened a pull request still counts it as its own', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'resync-'));
  const onPull = recordPull(outDir, '2026-10-01');
  assert.throws(() => { onPull('https://github.com/o/site/pull/8'); throw new Error('killed'); }, /killed/);
  assert.equal(existsSync(join(outDir, 'resync-run-2026-10-01.json')), false);
  assert.deepEqual([...ownPulls(outDir, '2026-10-01')], ['https://github.com/o/site/pull/8']);
  assert.equal(ownPulls(outDir, '2026-10-02').size, 0);
});
