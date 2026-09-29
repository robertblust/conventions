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
const view = (p) => ({ number: p.number, state: p.state, url: p.url, mergeCommit: p.merge ? { oid: p.merge } : null, mergeStateStatus: 'CLEAN', isCrossRepository: false });
// GH_STUB_FORK_PRS="repo:head,…" plants an open pull request from a fork on that head, listed
// first, the way GitHub lists a fork's branch of the same name beside the repository's own.
const forkPrs = (head) => (process.env.GH_STUB_FORK_PRS ?? '').split(',').filter((e) => e === `${repo}:${head}`)
  .map(() => ({ number: 900, state: 'OPEN', url: `https://github.com/${repo}/pull/900`, mergeCommit: null, mergeStateStatus: 'CLEAN', isCrossRepository: true }));
// GH_STUB_API is a JSON object from an API path to its answer; a null answer is a 404.
const api = process.env.GH_STUB_API ? JSON.parse(process.env.GH_STUB_API) : {};
const listed = (name) => (process.env[name] ?? '').split(',').includes(repo);
// GH_STUB_BLOCKED="repo:n,…" has that repository's pull request report BLOCKED for its first n
// reads of mergeStateStatus, and GH_STUB_POLICY="repo:n,…" has GitHub refuse its first n merges
// under the base branch policy: both what GitHub says while required checks are still registering.
const count = (name) => Number((process.env[name] ?? '').split(',').find((e) => e.startsWith(`${repo}:`))?.slice(repo.length + 1) ?? 0);
const once = (name) => {
  state.seen ??= {};
  const key = `${name}:${repo}`;
  state.seen[key] = (state.seen[key] ?? 0) + 1;
  save();
  return state.seen[key] <= count(name);
};
const [a, b] = args;

if (a === 'api' && Object.hasOwn(api, args[args.length - 1])) {
  const answer = api[args[args.length - 1]];
  if (answer === null) {
    console.error('gh: Not Found (HTTP 404)');
    process.exit(1);
  }
  console.log(typeof answer === 'string' ? answer : JSON.stringify(answer));
} else if (a === 'pr' && b === 'list') {
  console.log(JSON.stringify([...forkPrs(opt('--head')), ...state.prs.filter((p) => p.repo === repo && p.head === opt('--head')).map(view)]));
} else if (a === 'pr' && b === 'create') {
  const number = state.prs.length + 1;
  const url = `https://github.com/${repo}/pull/${number}`;
  const head = opt('--head');
  const closed = (process.env.GH_STUB_CLOSE ?? '').split(',').includes(`${repo}:${head}`);
  state.prs.push({ repo, number, head, state: closed ? 'CLOSED' : 'OPEN', url, title: opt('--title'), body: opt('--body') });
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
  const answer = view(pr());
  // GH_STUB_DIRTY="repo,…" has that repository's pull request conflict with main on every read.
  if (listed('GH_STUB_DIRTY')) answer.mergeStateStatus = 'DIRTY';
  else if (opt('--json').split(',').includes('mergeStateStatus') && once('GH_STUB_BLOCKED')) answer.mergeStateStatus = 'BLOCKED';
  console.log(JSON.stringify(answer));
} else if (a === 'pr' && b === 'merge') {
  if (once('GH_STUB_POLICY')) {
    console.error(`X Pull request ${repo}#${args[2]} is not mergeable: the base branch policy prohibits the merge.`);
    process.exit(1);
  }
  const p = pr();
  const work = mkdtempSync(join(tmpdir(), 'merge-'));
  git(work, 'clone', '-q', bare(repo), '.');
  git(work, '-c', 'user.email=gh@stub', '-c', 'user.name=gh', 'merge', '-q', '--no-ff', `origin/${p.head}`, '-m', `Merge pull request #${p.number}`);
  git(work, 'push', '-q', 'origin', 'HEAD:main');
  p.state = 'MERGED';
  p.merge = git(work, 'rev-parse', 'HEAD');
  save();
  if (listed('GH_STUB_AFTER_MERGE')) {
    // Someone merges a change of their own by hand right after the run's.
    writeFileSync(join(work, 'by-hand.txt'), 'by hand\n');
    git(work, 'add', '-A');
    git(work, '-c', 'user.email=hand@x', '-c', 'user.name=hand', 'commit', '-q', '-m', 'A change merged by hand');
    git(work, 'push', '-q', 'origin', 'HEAD:main');
  }
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
