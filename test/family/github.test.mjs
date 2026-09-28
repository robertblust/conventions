import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { realGithub } from '../../family/github.mjs';

const STUB = fileURLToPath(new URL('./gh-stub.mjs', import.meta.url));

function answering(api) {
  const tmp = mkdtempSync(join(tmpdir(), 'github-'));
  const bin = join(tmp, 'bin');
  const stub = join(tmp, 'stub');
  mkdirSync(bin);
  mkdirSync(stub);
  writeFileSync(join(bin, 'gh'), `#!/bin/sh\nexec node ${JSON.stringify(STUB)} "$@"\n`);
  chmodSync(join(bin, 'gh'), 0o755);
  Object.assign(process.env, { PATH: `${bin}:${process.env.PATH}`, GH_STUB_DIR: stub, GH_STUB_API: JSON.stringify(api) });
  return realGithub();
}

test('the pull requests of a commit count only those from the repository itself, not a fork', () => {
  const github = answering({
    'repos/o/server/commits/s1/pulls': [
      { head: { ref: 'resync-2026-09-28', repo: { full_name: 'o/server' } } },
      { head: { ref: 'resync-2026-09-28', repo: { full_name: 'fork/server' } } },
      { head: { ref: 'resync-gone', repo: null } },
    ],
  });
  assert.deepEqual(github.pullHeads('o/server', 's1'), ['resync-2026-09-28']);
});

test('a head or a compare GitHub does not find throws an error that names the repository and path', () => {
  const github = answering({ 'repos/o/server/commits/main': null, 'repos/o/server/compare/v1.0.0...main': null });
  assert.throws(() => github.head('o/server'), /o\/server.*repos\/o\/server\/commits\/main/);
  assert.throws(() => github.compare('o/server', 'v1.0.0', 'main'), /o\/server.*repos\/o\/server\/compare\/v1\.0\.0\.\.\.main/);
});

test('a commit and main\'s check runs are read in the shape the report uses', () => {
  const github = answering({
    'repos/o/server/commits/s1': { commit: { message: 'Takes conventions v1.35.0\n\nThe body.' }, parents: [{ sha: 'p' }], files: [{ filename: 'conventions.json' }, { filename: 'conventions/WRITING.md', previous_filename: 'src/WRITING.md' }] },
    'repos/o/server/commits/main/check-runs?per_page=100': { total_count: 1, check_runs: [{ name: 'test', status: 'completed', conclusion: 'failure', id: 7 }] },
  });
  assert.deepEqual(github.commit('o/server', 's1'), { subject: 'Takes conventions v1.35.0', parents: 1, parent: 'p', files: ['conventions.json', 'conventions/WRITING.md', 'src/WRITING.md'] });
  assert.deepEqual(github.checks('o/server'), [{ name: 'test', status: 'completed', conclusion: 'failure' }]);
});
