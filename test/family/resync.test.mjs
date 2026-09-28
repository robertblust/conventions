import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs, runResync, cleanDryRuns } from '../../family/resync.mjs';
import { assessFamily } from '../../family/report.mjs';
import { KINDS } from '../../family/pins.mjs';
import { fakeGithub } from './fake-github.mjs';
import { renderRecord } from '../../family/render.mjs';

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();

test('the choice is all or chain numbers, with an optional dry run', () => {
  assert.deepEqual(parseArgs(['r.json', 'all']), { file: 'r.json', selection: 'all', dryRun: false });
  assert.deepEqual(parseArgs(['r.json', '3', '5', '--dry-run']), { file: 'r.json', selection: [3, 5], dryRun: true });
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
