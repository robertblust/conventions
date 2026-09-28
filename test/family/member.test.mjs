import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { realMember, Blocked } from '../../family/member.mjs';

const STUB = fileURLToPath(new URL('./gh-stub.mjs', import.meta.url));
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();

function setup({ email = 'test@example.com' } = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'family-'));
  const dirs = Object.fromEntries(['remote', 'git', 'stub', 'bin'].map((d) => [d, join(tmp, d)]));
  for (const d of Object.values(dirs)) mkdirSync(d, { recursive: true });
  writeFileSync(join(dirs.bin, 'gh'), `#!/bin/sh\nexec node ${JSON.stringify(STUB)} "$@"\n`);
  chmodSync(join(dirs.bin, 'gh'), 0o755);
  const gitconfig = join(tmp, 'gitconfig');
  writeFileSync(gitconfig, email ? `[user]\n\temail = ${email}\n\tname = Test\n` : '');
  Object.assign(process.env, {
    PATH: `${dirs.bin}:${process.env.PATH}`, GH_STUB_DIR: dirs.stub, FAMILY_REMOTE: dirs.remote, GIT_CONFIG_GLOBAL: gitconfig, GIT_CONFIG_NOSYSTEM: '1',
    GH_STUB_FAIL_CHECKS: '', GH_STUB_LATE_CHECKS: '',
  });
  return dirs;
}

function seed(remote, repo, files) {
  const bare = join(remote, `${repo}.git`);
  mkdirSync(bare, { recursive: true });
  git(bare, 'init', '-q', '--bare', '-b', 'main');
  const work = mkdtempSync(join(tmpdir(), 'seed-'));
  git(work, 'init', '-q', '-b', 'main');
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(work, p)), { recursive: true });
    writeFileSync(join(work, p), c);
  }
  git(work, 'add', '-A');
  git(work, '-c', 'user.email=seed@x', '-c', 'user.name=seed', 'commit', '-q', '-m', 'Seed');
  git(work, 'push', '-q', bare, 'HEAD:main');
  return bare;
}

const pin = { taker: 'o/site', kind: 'source-commit', file: 'source.json', upstream: 'o/model', pinned: [A], available: B, url: 'https://github.com/o/model', entry: { kind: 'source-commit', file: 'source.json', repo: 'o/model', after: ['echo built > built.txt'] } };
const siteFiles = { 'source.json': `{"repo":"o/model","commit":"${A}"}\n` };
const calls = (d) => readFileSync(join(d.stub, 'calls.log'), 'utf8');
const member = (d, extra = {}) => realMember({ root: d.git, remote: d.remote, checkWait: 0, log: () => {}, ...extra });

test('a member is moved, verified, merged and cleaned up', () => {
  const d = setup();
  const bare = seed(d.remote, 'o/site', siteFiles);
  const out = member(d).update('o/site', [pin], { date: '2026-09-28', verify: ['test -f built.txt'] });
  assert.equal(out.pr, 'https://github.com/o/site/pull/1');
  assert.match(git(bare, 'show', 'main:source.json'), new RegExp(B));
  assert.equal(git(bare, 'show', 'main:built.txt'), 'built');
  assert.match(git(bare, 'log', '-1', '--format=%B', 'main^2'), /^Takes model bbbbbbb\n\nThe family resync moves o\/model in `source.json` from aaaaaaa to bbbbbbb\./);
  assert.match(git(bare, 'log', '-1', '--format=%B', 'main^2'), /Verified: `echo built > built.txt` and `test -f built.txt` passed\./);
  assert.match(calls(d), /pr merge 1 --repo o\/site --merge/);
  assert.equal(existsSync(join(d.git, 'o/site-resync-2026-09-28')), false);
});

test('a failing verify blocks the member before anything is pushed', () => {
  const d = setup();
  seed(d.remote, 'o/site', siteFiles);
  assert.throws(() => member(d).update('o/site', [pin], { date: '2026-09-28', verify: ['false'] }), (e) => e instanceof Blocked && /`false` failed/.test(e.message));
  assert.doesNotMatch(calls(d), /pr create/);
});

test('a check that does not pass blocks the member and nothing is merged', () => {
  const d = setup();
  seed(d.remote, 'o/site', siteFiles);
  process.env.GH_STUB_FAIL_CHECKS = 'o/site';
  assert.throws(() => member(d).update('o/site', [pin], { date: '2026-09-28', verify: [] }), /required check did not pass/);
  assert.doesNotMatch(calls(d), /pr merge/);
});

test('a check that has not started yet is waited for', () => {
  const d = setup();
  seed(d.remote, 'o/site', siteFiles);
  process.env.GH_STUB_LATE_CHECKS = 'o/site';
  const out = member(d).update('o/site', [pin], { date: '2026-09-28', verify: [] });
  assert.equal(out.pr, 'https://github.com/o/site/pull/1');
});

test('a second run the same day finds the merged pull request and opens none', () => {
  const d = setup();
  seed(d.remote, 'o/site', siteFiles);
  member(d).update('o/site', [pin], { date: '2026-09-28', verify: [] });
  const again = member(d).update('o/site', [pin], { date: '2026-09-28', verify: [] });
  assert.equal(again.pr, 'https://github.com/o/site/pull/1');
  assert.equal(calls(d).match(/pr create/g).length, 1);
});

test('a clone without an address blocks the member', () => {
  const d = setup({ email: '' });
  seed(d.remote, 'o/site', siteFiles);
  assert.throws(() => member(d).update('o/site', [pin], { date: '2026-09-28', verify: [] }), /no user\.email/);
});

test('a release bumps through its own pull request, then tags main', () => {
  const d = setup();
  const bare = seed(d.remote, 'o/server', { VERSION: '0.1.0\n' });
  const out = member(d).release('o/server', 'v0.2.0', 'Notes.\n', ['printf "{version}\\n" > VERSION'], { date: '2026-09-28' });
  assert.equal(out.tag, 'v0.2.0');
  assert.equal(git(bare, 'show', 'main:VERSION'), '0.2.0');
  const state = JSON.parse(readFileSync(join(d.stub, 'state.json'), 'utf8'));
  assert.deepEqual(state.releases.map((r) => [r.tag, r.target]), [['v0.2.0', git(bare, 'rev-parse', 'main')]]);
  assert.equal(state.prs[0].head, 'resync-2026-09-28-release');
});

test('a dry run commits locally and asks GitHub for nothing', () => {
  const d = setup();
  seed(d.remote, 'o/site', siteFiles);
  const out = member(d, { dryRun: true }).update('o/site', [pin], { date: '2026-09-28', verify: [] });
  assert.equal(out.pr, null);
  assert.equal(existsSync(join(d.stub, 'calls.log')), false);
  assert.match(git(join(d.git, 'o/site-resync-2026-09-28'), 'log', '-1', '--format=%s'), /^Takes model bbbbbbb$/);
});
