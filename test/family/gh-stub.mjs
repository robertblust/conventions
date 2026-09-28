// A gh for the tests: it records every call and answers the few the run makes from a state file,
// merging into the bare repositories under FAMILY_REMOTE the way GitHub would.
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = process.env.GH_STUB_DIR;
const args = process.argv.slice(2);
appendFileSync(join(dir, 'calls.log'), `${args.join(' ')}\n`);
const statePath = join(dir, 'state.json');
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { prs: [], releases: [], late: [] };
const save = () => writeFileSync(statePath, JSON.stringify(state));
const opt = (name) => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const repo = opt('--repo');
const bare = (r) => join(process.env.FAMILY_REMOTE, `${r}.git`);
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
const pr = () => state.prs.find((p) => p.repo === repo && p.number === Number(args[2]));
const view = (p) => ({ number: p.number, state: p.state, url: p.url, mergeCommit: p.merge ? { oid: p.merge } : null, mergeStateStatus: 'CLEAN' });
const listed = (name) => (process.env[name] ?? '').split(',').includes(repo);
const [a, b] = args;

if (a === 'pr' && b === 'list') {
  console.log(JSON.stringify(state.prs.filter((p) => p.repo === repo && p.head === opt('--head')).map(view)));
} else if (a === 'pr' && b === 'create') {
  const number = state.prs.length + 1;
  const url = `https://github.com/${repo}/pull/${number}`;
  state.prs.push({ repo, number, head: opt('--head'), state: 'OPEN', url, title: opt('--title'), body: opt('--body') });
  save();
  console.log(url);
} else if (a === 'pr' && b === 'checks') {
  if (listed('GH_STUB_LATE_CHECKS') && !state.late.includes(repo)) {
    state.late.push(repo);
    save();
    console.error("no checks reported on the 'resync' branch");
    process.exit(1);
  }
  process.exit(listed('GH_STUB_FAIL_CHECKS') ? 1 : 0);
} else if (a === 'pr' && b === 'view') {
  console.log(JSON.stringify(view(pr())));
} else if (a === 'pr' && b === 'merge') {
  const p = pr();
  const work = mkdtempSync(join(tmpdir(), 'merge-'));
  git(work, 'clone', '-q', bare(repo), '.');
  git(work, '-c', 'user.email=gh@stub', '-c', 'user.name=gh', 'merge', '-q', '--no-ff', `origin/${p.head}`, '-m', `Merge pull request #${p.number}`);
  git(work, 'push', '-q', 'origin', 'HEAD:main');
  p.state = 'MERGED';
  p.merge = git(work, 'rev-parse', 'HEAD');
  save();
} else if (a === 'release' && b === 'view') {
  process.exit(state.releases.some((r) => r.repo === repo && r.tag === args[2]) ? 0 : 1);
} else if (a === 'release' && b === 'create') {
  state.releases.push({ repo, tag: args[2], target: opt('--target'), notes: opt('--notes') });
  save();
} else if (a === 'api' && /^repos\/.+\/commits\/main$/.test(b)) {
  const r = b.replace(/^repos\//, '').replace(/\/commits\/main$/, '');
  console.log(JSON.stringify({ sha: git(bare(r), 'rev-parse', 'main') }));
} else {
  console.error(`gh stub: no answer for ${args.join(' ')}`);
  process.exit(2);
}
