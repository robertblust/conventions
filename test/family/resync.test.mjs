import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, utimesSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs, runResync, cleanDryRuns, lockRun, withLock, guardPulls, listResyncPulls, ownPulls, recordPull, lockPathOf, main } from '../../family/resync.mjs';
import { assessFamily } from '../../family/report.mjs';
import { KINDS } from '../../family/pins.mjs';
import { fakeGithub } from './fake-github.mjs';
import { renderRecord } from '../../family/render.mjs';

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();

test('the choice is all, chain numbers or member names, with an optional dry run', () => {
  assert.deepEqual(parseArgs(['r.json', 'all']), { file: 'r.json', selection: 'all', dryRun: false, force: false });
  assert.deepEqual(parseArgs(['r.json', '3', '5', '--dry-run']), { file: 'r.json', selection: [3, 5], dryRun: true, force: false });
  assert.deepEqual(parseArgs(['r.json', 'all', '--force']), { file: 'r.json', selection: 'all', dryRun: false, force: true });
  assert.deepEqual(parseArgs(['r.json', 'companygraph/mental-model']), { file: 'r.json', selection: ['companygraph/mental-model'], dryRun: false, force: false });
  assert.deepEqual(parseArgs(['r.json', '3', 'o/site', 'o/server']), { file: 'r.json', selection: [3, 'o/site', 'o/server'], dryRun: false, force: false });
  assert.equal(parseArgs(['r.json']), null);
  assert.equal(parseArgs(['r.json', 'x']), null);
  assert.equal(parseArgs(['r.json', '0']), null);
  assert.equal(parseArgs(['r.json', 'o/site/extra']), null);
  assert.equal(parseArgs(['r.json', 'all', 'o/site']), null);
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

test('the run record names each retry in the Note column', () => {
  const md = renderRecord([
    { repo: 'o/server', status: 'done', pr: 'https://x/1', merge: 'a'.repeat(40), release: 'v1.1.0', note: 'a note', retries: ['`npm run og` failed once (TimeoutError), passed on retry', 'the required check `verify` failed once, passed on rerun'] },
    { repo: 'o/site', status: 'done', pr: 'https://x/2', merge: 'b'.repeat(40), note: null, retries: ['`curl x` failed once, passed on retry'] },
  ], '2026-09-28', false);
  assert.match(md, /\| o\/server \| done \| https:\/\/x\/1 \| aaaaaaa \| v1\.1\.0 \| a note; `npm run og` failed once \(TimeoutError\), passed on retry; the required check `verify` failed once, passed on rerun \|/);
  assert.match(md, /\| o\/site \| done \| https:\/\/x\/2 \| bbbbbbb \| {2}\| `curl x` failed once, passed on retry \|/);
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
    && /companygraph\/chat-server #64 resync-2026-09-29-release is open/.test(e.message) && /--force/.test(e.message)
    && /earlier day/.test(e.message));
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

test('recordPull keeps a url written before the run threw, with no run record written', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'resync-'));
  const onPull = recordPull(outDir, '2026-10-01');
  assert.throws(() => { onPull('https://github.com/o/site/pull/8'); throw new Error('killed'); }, /killed/);
  assert.equal(existsSync(join(outDir, 'resync-run-2026-10-01.json')), false);
  assert.deepEqual([...ownPulls(outDir, '2026-10-01')], ['https://github.com/o/site/pull/8']);
  assert.equal(ownPulls(outDir, '2026-10-02').size, 0);
});

test('an empty lock is held while it is fresh, and taken over once it is old', () => {
  const path = lockPath();
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, '');
  assert.throws(() => lockRun({ path, args: [], log: () => {} }), (e) => e.refused && /cannot be read/.test(e.message));
  const old = new Date(Date.now() - 10 * 60 * 1000);
  utimesSync(path, old, old);
  const said = [];
  const release = lockRun({ path, args: [], log: (m) => said.push(m) });
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).pid, process.pid);
  assert.match(said.join('\n'), /took over/);
  release();
});

test('taking the lock leaves nothing beside it but the lock', () => {
  const path = lockPath();
  const release = lockRun({ path, args: [], log: () => {} });
  assert.deepEqual(readdirSync(join(path, '..')), ['resync.lock']);
  release();
  assert.deepEqual(readdirSync(join(path, '..')), []);
});

test('two worktrees of one clone share one lock', () => {
  const root = mkdtempSync(join(tmpdir(), 'lock-wt-'));
  const dir = join(root, 'conventions');
  mkdirSync(dir);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, '-c', 'user.email=t@x', '-c', 'user.name=T', 'commit', '-q', '--allow-empty', '-m', 'seed');
  const wt = join(root, 'conventions-a-branch');
  git(dir, 'worktree', 'add', '-q', '-b', 'a-branch', wt);
  assert.equal(lockPathOf(wt), lockPathOf(dir));
  assert.equal(join(realpathSync(dirname(lockPathOf(dir))), 'family-resync.lock'), join(realpathSync(join(dir, '.git')), 'family-resync.lock'));
  const release = lockRun({ path: lockPathOf(dir), args: [], log: () => {} });
  assert.throws(() => lockRun({ path: lockPathOf(wt), args: [], log: () => {} }), (e) => e.refused);
  release();
});

test('a member whose open pull requests gh cannot list refuses, naming it and gh', () => {
  const list = (repo) => { if (repo === 'o/site') throw new Error('gh pr list --repo o/site: HTTP 502'); return []; };
  assert.throws(guard(list, new Set()), (e) => e.refused && /o\/site/.test(e.message) && /HTTP 502/.test(e.message));
});

// The entry point, with GitHub and the members stubbed: a report that holds one member and
// nothing to move, a lock in a temp directory, and a list of open pull requests the test chooses.
function entry({ list, lock = lockPath(), pick = 'all' } = {}) {
  const here = mkdtempSync(join(tmpdir(), 'resync-main-'));
  const github = fakeGithub({ files: { 'o/meta': {} } });
  const report = assessFamily({ github, members: [{ repo: 'o/meta' }], drawing: new Set(), date: '2026-10-01' });
  const file = join(here, 'report.json');
  writeFileSync(file, JSON.stringify(report));
  const said = [];
  const run = () => main({ argv: [file, pick], here, date: '2026-10-01', lockPath: lock, list, github, memberOf: () => ({}), log: () => {}, error: (m) => said.push(m) });
  return { run, said, lock, here };
}

test('the entry takes the lock before it asks for pull requests, and removes it after', () => {
  const e = entry({ list: () => { assert.equal(existsSync(e.lock), true); return []; } });
  assert.equal(e.run(), 0);
  assert.equal(existsSync(e.lock), false);
  assert.equal(existsSync(join(e.here, 'dist/resync-run-2026-10-01.md')), true);
});

test('the entry exits 2 on a refusal, says why and leaves no lock', () => {
  const e = entry({ list: () => [{ number: 4, headRefName: 'resync-2026-09-30', url: 'u4' }] });
  assert.equal(e.run(), 2);
  assert.match(e.said.join('\n'), /o\/meta #4 resync-2026-09-30 is open/);
  assert.equal(existsSync(e.lock), false);
});

test('the entry exits 2 on a member name the report does not hold, writes nothing and says why', () => {
  const e = entry({ list: () => [], pick: 'o/nobody' });
  assert.equal(e.run(), 2);
  assert.match(e.said.join('\n'), /no member o\/nobody in the report/);
  assert.equal(existsSync(e.lock), false);
  assert.equal(existsSync(join(e.here, 'dist/resync-run-2026-10-01.md')), false);
  assert.equal(existsSync(join(e.here, 'dist/resync-run-2026-10-01.json')), false);
});

test('the entry exits 2 on a live lock and asks GitHub nothing', () => {
  let asked = false;
  const e = entry({ list: () => { asked = true; return []; } });
  mkdirSync(join(e.lock, '..'), { recursive: true });
  writeFileSync(e.lock, JSON.stringify({ pid: process.pid, started: 'then', args: [] }));
  assert.equal(e.run(), 2);
  assert.equal(asked, false);
  assert.match(e.said.join('\n'), new RegExp(`pid ${process.pid}`));
  assert.equal(existsSync(e.lock), true);
});

test('the entry installs no signal handler, so a signal still stops the run', () => {
  const before = [process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')];
  entry({ list: () => [] }).run();
  assert.deepEqual([process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')], before);
});

test('the run record names what a run picking members left for a later run', () => {
  assert.match(renderRecord([{ repo: 'o/server', status: 'done' }], '2026-10-09', false, ['o/site', 'o/web']), /\n\nLeft for a later run: o\/site and o\/web\.\n$/);
  assert.doesNotMatch(renderRecord([{ repo: 'o/server', status: 'done' }], '2026-10-09', false, []), /Left for a later run/);
});
