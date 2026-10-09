# Resync by member Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A family resync run can move named members alone, and releases a member whose only unreleased work is a merged pull request that moved one of its own declared pins.

**Architecture:** `parseArgs` accepts member names beside chain numbers; one function, `membersOf`, turns a report and a selection into the run's starts and closure, used by `orchestrate` and by `leftBehind`, which the run record prints. A new GitHub question, `pullsOf`, lets `family/assess.mjs` recognize a pull request that moved a declared pin; `releaseBlock`, `pendingRelease` and `unreleasedCommits` count its commits as the run's own, and the release notes name it through `withCarried`.

**Tech Stack:** Node.js ES modules, `node:test`, the `gh` CLI behind `family/github.mjs`, the fake GitHub in `test/family/fake-github.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-09-resync-by-member-design.md`

## Global Constraints

- Work in the worktree `/Users/rob/git/robertblust/conventions-resync-by-member`, branch `resync-by-member`. This repository is the source, so its hook path is set by hand: `git config core.hooksPath conventions/hooks` (already set).
- Before node: `export PATH="/opt/homebrew/bin:$PATH"`. The suite is `sh test/run.sh`; a family test file runs alone with `node --test test/family/<file>.test.mjs`.
- Code commits are authored `Implementer <implementer@blust.ch>`, prose commits (README, skill) `Writer <writer@blust.ch>`, in the git register of `conventions/WRITING.md`: plain subject under seventy characters, why-first body, a `Verified:` line, trailers `Process: Delivery`, `Phase: Implement`, `Track: Code` or `Track: Prose`, `Co-Authored-By: <model> <noreply@anthropic.com>`. Never bypass the hook.
- `all` and chain numbers keep their meaning and every existing test passes unchanged, except where a task says which expectation moves and why.
- A name is a member as `conventions/REPOSITORIES.md` lists it, `owner/repo`; the report's `members` holds exactly those.
- Release notes name a hand pull request as: `It also carries [#<number>](<url>), made by hand: <title>.` — one line per pull request, its title verbatim.
- The report marks a pin-move commit ` (pin move)`, beside the existing ` (re-sync only)`.
- Blocking stays the side a wrong guess is undone from: a pull request whose files or pin values cannot be read counts its commits as work.

## Review Focus

- A name given twice, or a name that is also the taker of a chosen chain: the member runs once, not twice. Test in Task 1.
- A named member whose only behind pin is a conventions pin: it moves and is not released, as a chain of its own would. Test in Task 1.
- A hand pull request whose merge left the pin value equal to its base (a revert, or a moved-and-moved-back pin): it moved no pin and blocks. Test in Task 2.
- A commit that belongs to two pull requests, one of them a pin move: it counts as the run's if any merged pull request it belongs to moved a pin. Test in Task 2.
- A dry run over a member with a hand pull request: the notes it would write still name the pull request, and nothing is released. Test in Task 2.

---

### Task 1: A run picks members by name

**Files:**

- Modify: `family/resync.mjs` (`parseArgs`, `runResync`, `main`'s usage and error handling)
- Modify: `family/orchestrate.mjs` (export `choiceError`, `membersOf`, `leftBehind`; `orchestrate` uses `membersOf`)
- Modify: `family/render.mjs` (`renderRecord` takes what was left behind)
- Test: `test/family/resync.test.mjs`, `test/family/orchestrate.test.mjs`

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: `parseArgs(argv) → { file, selection: 'all' | Array<number | string>, dryRun, force } | null`; `choiceError(message: string): Error & { choice: true }`; `membersOf(report, selection) → { chosen: Chain[], starts: Set<string>, closure: Set<string> }`; `leftBehind(report, selection) → string[]` (sorted); `renderRecord(record, date, dryRun, left = [])`.

- [ ] **Step 1: Write the failing tests**

In `test/family/resync.test.mjs`, replace the test "the choice is all or chain numbers, with an optional dry run" with:

```js
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
```

In `test/family/orchestrate.test.mjs`, add the import `membersOf, leftBehind` from `../../family/orchestrate.mjs` beside `orchestrate, nextMinor`, and append:

```js
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
```

For the Review Focus line on a conventions-only member: in `world()` a conventions pin is not modeled; add this test, which builds its own world:

```js
test('a named member whose only behind pin is its conventions pin moves and is not released', () => {
  const github = fakeGithub({
    files: {
      'robertblust/conventions': {},
      'o/server': { 'conventions.json': '{"tag":"v1.0.0"}', 'pins.json': declare([{ kind: 'conventions', file: 'conventions.json', repo: 'robertblust/conventions' }]) },
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
```

In `test/family/resync.test.mjs`, append:

```js
test('the run record names what a run picking members left for a later run', () => {
  assert.match(renderRecord([{ repo: 'o/server', status: 'done' }], '2026-10-09', false, ['o/site', 'o/web']), /\n\nLeft for a later run: o\/site and o\/web\.\n$/);
  assert.doesNotMatch(renderRecord([{ repo: 'o/server', status: 'done' }], '2026-10-09', false, []), /Left for a later run/);
});
```

and add `import { renderRecord } from '../../family/render.mjs';` at the top if it is not already imported.

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test test/family/resync.test.mjs test/family/orchestrate.test.mjs` Expected: FAIL — `parseArgs` returns `null` for a name, `membersOf` and `leftBehind` are not exported, a name throws "no chain NaN", and the record has no leftover line.

- [ ] **Step 3: Parse names**

In `family/resync.mjs`, replace the body of `parseArgs` after the `--clean-dry-runs` line with:

```js
  const [file, ...rest] = argv;
  const dryRun = rest.includes('--dry-run');
  const force = rest.includes('--force');
  const picks = rest.filter((a) => a !== '--dry-run' && a !== '--force');
  if (!file || !picks.length) return null;
  if (picks.length === 1 && picks[0] === 'all') return { file, selection: 'all', dryRun, force };
  // A pick is a chain number or a member's name as REPOSITORIES.md lists it, owner/repo.
  const selection = picks.map((p) => (/^\d+$/.test(p) ? Number(p) : /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(p) ? p : null));
  if (selection.some((p) => p === null || p === 0)) return null;
  return { file, selection, dryRun, force };
```

and change both usage lines in `main` to:

```js
    error('usage: node family/resync.mjs <report.json> <all | chain numbers | member names…> [--dry-run] [--force]');
```

(the `--clean-dry-runs` line stays). Update the comment at the top of the file the same way: `<all | chain numbers | member names…>`, adding one sentence: "A name moves that member alone; a chain number moves its taker and everything downstream."

- [ ] **Step 4: Gather the run's members in one function**

In `family/orchestrate.mjs`, import `downstreamOf` from `./graph.mjs` beside `releasesIn, edgesOf, NON_PROPAGATING`, and add above `orchestrate`:

```js
// A choice the report cannot answer stops the run before it moves anything.
export const choiceError = (message) => Object.assign(new Error(message), { choice: true });

// The run's members from the owner's choice: each chosen chain's steps, and each named member
// alone. `starts` are the pins the choice itself moves; a member reached through `closure` also
// moves a pin whose upstream the run moves before it.
export function membersOf(report, selection) {
  const picks = selection === 'all' ? report.chains.map((c) => c.n) : selection;
  const chosen = [...new Set(picks.filter((p) => typeof p === 'number'))].map((n) => {
    const c = report.chains.find((c) => c.n === n);
    if (!c) throw choiceError(`no chain ${n} in the report`);
    return c;
  });
  const starts = new Set(chosen.map((c) => pinKey(c)));
  const closure = new Set(chosen.flatMap((c) => c.steps.flat()));
  for (const name of new Set(picks.filter((p) => typeof p === 'string'))) {
    if (!report.members.some((m) => m.repo === name)) throw choiceError(`no member ${name} in the report`);
    const behind = report.pins.filter((p) => p.taker === name && p.status === 'behind' && p.entry);
    if (!behind.length) throw choiceError(`${name} has no pin behind in the report`);
    for (const p of behind) starts.add(pinKey(p));
    closure.add(name);
  }
  return { chosen, starts, closure };
}

// The members downstream of what a choice names that it does not move itself, so the run record
// says what the next run would take. A choice of chains alone leaves nothing behind.
export function leftBehind(report, selection) {
  if (selection === 'all') return [];
  const { closure } = membersOf(report, selection);
  const names = selection.filter((p) => typeof p === 'string');
  const below = new Set(names.flatMap((n) => [...downstreamOf(n, report.edges)]));
  return [...below].filter((r) => !closure.has(r)).sort();
}
```

In `orchestrate`, replace the lines from `const chosen = selection === 'all'` through `const closure = new Set(chosen.flatMap((c) => c.steps.flat()));` with:

```js
  const { starts, closure } = membersOf(report, selection);
```

- [ ] **Step 5: Say what was left, and refuse on the choice**

In `family/render.mjs`, import `listed` from `./words.mjs` beside `shortV, longDate, plural`, and change `renderRecord`:

```js
export function renderRecord(record, date, dryRun, left = []) {
  const lines = [`# Family resync run, ${longDate(date)}${dryRun ? ' (dry run)' : ''}`, ''];
  if (!record.length) return `${lines[0]}\n\nThe choice moved nothing.\n`;
  lines.push('| Member | Status | Pull request | Merge | Release | Note |', '| --- | --- | --- | --- | --- | --- |');
  for (const r of record) {
    lines.push(`| ${r.repo} | ${r.status} | ${r.pr ?? ''} | ${r.merge ? shortV(r.merge) : ''} | ${r.release ?? ''} | ${cell([r.reason ?? r.note, ...(r.retries ?? [])].filter(Boolean).join('; '))} |`);
  }
  if (left.length) lines.push('', `Left for a later run: ${listed(left)}.`);
  return `${lines.join('\n')}\n`;
}
```

In `family/resync.mjs`, import `leftBehind` from `./orchestrate.mjs` (beside the existing `orchestrate` import), and in `runResync`:

```js
  const write = () => {
    mkdirSync(outDir, { recursive: true });
    const out = join(outDir, `resync-run-${date}.md`);
    writeFileSync(out, renderRecord(record, date, dryRun, leftBehind(report, selection)));
```

and change the catch to `if (!err.choice) console.error(...)`. In `main`, change `if (err.refused || err.message.startsWith('no chain'))` to `if (err.refused || err.choice)`.

- [ ] **Step 6: Run the tests to see them pass**

Run: `node --test test/family/resync.test.mjs test/family/orchestrate.test.mjs` Expected: PASS, the test "a chain the report does not hold writes no record" included.

- [ ] **Step 7: Run the whole suite**

Run: `sh test/run.sh; echo "exit $?"; sh conventions/conventions-format; sh conventions/conventions-check` Expected: `all pass`, exit 0, and both checks exit 0.

- [ ] **Step 8: Commit**

```bash
git add family/resync.mjs family/orchestrate.mjs family/render.mjs test/family/resync.test.mjs test/family/orchestrate.test.mjs
git commit --author "Implementer <implementer@blust.ch>"
```

Subject: `A resync run can name members and move each alone`. Body: why first (a chain runs to the end of everything downstream, so one taker cannot move alone), then names beside numbers, `membersOf`, the leftover line, and that a choice the report cannot answer refuses before anything moves.

---

### Task 2: A pin move made by hand is the run's own work

**Files:**

- Modify: `family/github.mjs` (the question `pullsOf`)
- Modify: `test/family/fake-github.mjs` (answers `pullsOf` from a `pullRecords` fixture)
- Modify: `family/assess.mjs` (`movedPin`, `scanUnreleased`, `releaseBlock`, `handPulls`, `pendingRelease`, `unreleasedCommits`)
- Modify: `family/words.mjs` (`withCarried`)
- Modify: `family/orchestrate.mjs` (the `release` helper appends the carried lines)
- Modify: `family/render.mjs` (` (pin move)` in the report's commit list)
- Test: `test/family/assess.test.mjs`, `test/family/github.test.mjs`, `test/family/orchestrate.test.mjs`, `test/family/report.test.mjs`

**Interfaces:**

- Consumes: Task 1's `membersOf` (unchanged here).
- Produces: `github.pullsOf(repo, sha) → Array<{ number: number, title: string, url: string, head: string, base: string, merge: string | null }>`; `handPulls(github, repo) → Array<{ number, title, url }>` (distinct, by number); `withCarried(notes: string, pulls) → string`; a commit in `unreleasedCommits(...).commits` gains `pinMove: boolean`.

- [ ] **Step 1: Write the failing tests**

In `test/family/fake-github.mjs`, add `pullRecords = {}` to the destructured fixtures, expose it as `pullRecords`, and add the question:

```js
    pullsOf(repo, sha) { gate(repo); return pullRecords[`${repo}:${sha}`] ?? []; },
```

and extend the file's top comment with: "A commit's pull requests for `pullsOf` are keyed `<repo>:<sha>` in `pullRecords`."

In `test/family/github.test.mjs`, append:

```js
test('a commit\'s merged pull requests from the repository itself, in the shape the scan uses', () => {
  const github = answering({
    'repos/o/server/commits/s1/pulls': [
      { number: 7, title: 'Takes meta v2.0.0', html_url: 'u7', merged_at: '2026-10-09T10:00:00Z', merge_commit_sha: 'm7', base: { sha: 'b7' }, head: { ref: 'meta-2', repo: { full_name: 'o/server' } } },
      { number: 8, title: 'Open', html_url: 'u8', merged_at: null, merge_commit_sha: 'm8', base: { sha: 'b8' }, head: { ref: 'open', repo: { full_name: 'o/server' } } },
      { number: 9, title: 'Fork', html_url: 'u9', merged_at: '2026-10-09T10:00:00Z', merge_commit_sha: 'm9', base: { sha: 'b9' }, head: { ref: 'fork', repo: { full_name: 'fork/server' } } },
    ],
  });
  assert.deepEqual(github.pullsOf('o/server', 's1'), [{ number: 7, title: 'Takes meta v2.0.0', url: 'u7', head: 'meta-2', base: 'b7', merge: 'm7' }]);
});
```

In `test/family/assess.test.mjs`, import `handPulls` and `pendingRelease` beside the existing imports, and append:

```js
// A hand pull request #12 that moved design's pin on tokens, two commits: the move and a fix.
function handWorld(shas, { base = '{"t":"github:robertblust/tokens#v1.0.0"}', merge = '{"t":"github:robertblust/tokens#v2.0.0"}' } = {}) {
  const gh = resyncWorld(since(shas));
  gh.files['robertblust/design']['pins.json'] = JSON.stringify({ pins: [{ kind: 'npm-tag', file: 'package.json', repo: 'robertblust/tokens' }] });
  if (base !== null) gh.files['robertblust/design']['package.json@b12'] = base;
  gh.files['robertblust/design']['package.json@m12'] = merge;
  const pull = { number: 12, title: 'Takes tokens v2.0.0', url: 'https://github.com/robertblust/design/pull/12', head: 'tokens-2', base: 'b12', merge: 'm12' };
  gh.commits['robertblust/design:hand'] = { subject: 'Takes tokens v2.0.0', parents: 1, parent: 'p-hand', files: ['package.json', 'package-lock.json'] };
  gh.commits['robertblust/design:fix'] = { subject: 'The token test follows v2.0.0', parents: 1, parent: 'p-fix', files: ['test/tokens.test.mjs'] };
  gh.pullRecords['robertblust/design:hand'] = [pull];
  gh.pullRecords['robertblust/design:fix'] = [pull];
  return gh;
}

test('a merged pull request that moved a declared pin is the run\'s own work, its fix included', () => {
  assert.equal(releaseBlock(handWorld(['hand', 'fix']), 'robertblust/design'), null);
  assert.deepEqual(handPulls(handWorld(['hand', 'fix']), 'robertblust/design').map((p) => p.number), [12]);
});

test('a pull request that left the pin where it was blocks', () => {
  const same = '{"t":"github:robertblust/tokens#v1.0.0"}';
  assert.equal(releaseBlock(handWorld(['hand', 'fix'], { merge: same }), 'robertblust/design'), 'unreleased work on main: 2 commits since v2.1.0');
});

test('a pin-move pull request beside a feature commit blocks, counting the feature alone', () => {
  assert.equal(releaseBlock(handWorld(['hand', 'fix', 'own']), 'robertblust/design'), 'unreleased work on main: 1 commit since v2.1.0');
});

test('a pull request whose pin value cannot be read blocks', () => {
  assert.match(releaseBlock(handWorld(['hand'], { base: null }), 'robertblust/design'), /^unreleased work on main: 1 commit since v2\.1\.0, 1 commit could not be read/);
});

test('a commit in two pull requests counts as the run\'s when one of them moved a pin', () => {
  const gh = handWorld(['hand']);
  gh.pullRecords['robertblust/design:hand'] = [{ number: 11, title: 'Other', url: 'u11', head: 'other', base: 'm12', merge: 'm12' }, ...gh.pullRecords['robertblust/design:hand']];
  assert.equal(releaseBlock(gh, 'robertblust/design'), null);
});

test('a hand pin move makes a release pending, and the report lists its commits as pin moves', () => {
  const gh = handWorld(['hand', 'fix']);
  assert.equal(pendingRelease(gh, 'robertblust/design'), true);
  assert.deepEqual(unreleasedCommits(gh, 'robertblust/design').commits.map((c) => `${c.sha} ${c.pinMove}`), ['hand true', 'fix true']);
});
```

In `test/family/orchestrate.test.mjs`, append:

```js
// o/server's main already holds o/meta v2.0.0 from hand pull request #7; its last release is v1.0.0.
function handMoved(github) {
  github.files['o/server']['package.json'] = '{"m":"github:o/meta#v2.0.0"}';
  github.files['o/server']['package.json@b7'] = '{"m":"github:o/meta#v1.0.0"}';
  github.files['o/server']['package.json@m7'] = '{"m":"github:o/meta#v2.0.0"}';
  github.compares['o/server:v1.0.0...main'] = { aheadBy: 1, shas: ['h1'], files: [] };
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
```

In `test/family/report.test.mjs`, add a test that `renderReport` prints a commit with `pinMove: true` as `` - h1 Takes meta v2.0.0 (pin move)``.

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test test/family/assess.test.mjs test/family/github.test.mjs test/family/orchestrate.test.mjs test/family/report.test.mjs` Expected: FAIL — `pullsOf` and `handPulls` do not exist, and every hand pull request counts as work.

- [ ] **Step 3: Ask GitHub for a commit's pull requests**

In `family/github.mjs`, add to the returned object, and change the file's top comment from "seven questions" to "eight":

```js
    pullsOf(repo, sha) {
      return (json(`repos/${repo}/commits/${sha}/pulls`) ?? [])
        .filter((p) => p.head.repo?.full_name === repo && p.merged_at)
        .map((p) => ({ number: p.number, title: p.title, url: p.html_url, head: p.head.ref, base: p.base.sha, merge: p.merge_commit_sha }));
    },
```

In `test/family/fake-github.mjs`, change "the same seven questions" to "the same eight questions".

- [ ] **Step 4: Recognize a pin move, and count it as the run's**

In `family/assess.mjs`, import `KINDS` from `./pins.mjs` (beside whatever it imports from there now), and replace `releaseBlock` with:

```js
// Whether a merged pull request moved one of the member's declared pins: the value a pin reads
// in its file differs between the pull request's base and its merge. A file or value that cannot
// be read throws, and the caller counts the commit as work.
function movedPin(github, repo, pull, declared) {
  return (declared?.pins ?? []).some((d) => {
    const read = (ref) => {
      const text = github.file(repo, d.file, ref);
      if (text === null) throw new Error(`${repo}: ${d.file} at ${ref} cannot be read`);
      return KINDS[d.kind].read(text, d.repo).join(',');
    };
    return read(pull.base) !== read(pull.merge);
  });
}

const declaredPins = (github, repo) => {
  try {
    return validatePins(JSON.parse(github.file(repo, 'pins.json')));
  } catch {
    return null;
  }
};

// The commits on main since the latest release, each judged once: the run's own (a resync pull
// request, a re-sync, or a pull request that moved one of the member's declared pins, whose
// every commit counts, the fix that came with the move included) or work. A merge commit only
// carries the others and is not counted either way. A commit that cannot be read counts as work,
// because blocking is the side a wrong guess can be undone from, and so does every commit past
// the most the compare lists. `carried` holds the hand pull requests the run's notes name.
function scanUnreleased(github, repo) {
  const rel = github.latestRelease(repo);
  if (!rel) return { rel: null };
  const c = github.compare(repo, rel.tag, 'main');
  const declared = declaredPins(github, repo);
  const carried = new Map();
  const commits = [];
  let work = Math.max(0, c.aheadBy - c.shas.length);
  const unread = [];
  for (const sha of c.shas) {
    try {
      const heads = github.pullHeads(repo, sha);
      if (heads.some((h) => h.startsWith('resync-'))) { commits.push({ sha, resync: true }); continue; }
      const commit = github.commit(repo, sha);
      if (commit.parents !== 1) continue;
      const moved = github.pullsOf(repo, sha).find((p) => p.merge && movedPin(github, repo, p, declared));
      if (moved) {
        carried.set(moved.number, { number: moved.number, title: moved.title, url: moved.url });
        commits.push({ sha, subject: commit.subject, pinMove: true });
        continue;
      }
      const only = resyncOnly(github, repo, sha, commit);
      commits.push({ sha, subject: commit.subject, resyncOnly: only });
      if (!only) work += 1;
    } catch (e) {
      work += 1;
      unread.push(e.message);
    }
  }
  return { rel, aheadBy: c.aheadBy, work, unread, carried: [...carried.values()], commits };
}

export function releaseBlock(github, repo) {
  const s = scanUnreleased(github, repo);
  if (!s.rel) return 'has no release to follow';
  if (s.aheadBy === 0 || s.work === 0) return null;
  const why = s.unread.length ? `, ${plural(s.unread.length, 'commit')} could not be read: ${s.unread[0]}` : '';
  return `unreleased work on main: ${plural(s.work, 'commit')} since ${s.rel.tag}${why}`;
}

// The hand pull requests a release of this member would carry, for its notes.
export function handPulls(github, repo) {
  const s = scanUnreleased(github, repo);
  return s.rel && s.work === 0 ? s.carried : [];
}
```

Keep the existing comment above `releaseBlock` and extend its first sentence: "…only for work a person did that moved none of its pins, and that work is what blocks it".

Change `pendingRelease` so a hand pin move counts with the run's own pull requests. In `scanUnreleased`, record whether a resync commit's pull request was a vendored re-sync: change its first branch to

```js
      if (heads.some((h) => h.startsWith('resync-'))) {
        commits.push({ sha, resync: true, vendored: !heads.some((h) => h.startsWith('resync-') && !h.startsWith('resync-vendored-')) });
        continue;
      }
```

and replace `pendingRelease` with:

```js
// A member whose main holds only the run's own work since its last release, a resync pull
// request or a pin a person moved by hand, has a release a rerun can finish, though nothing in it
// is behind; a vendored re-sync alone owes none.
export function pendingRelease(github, repo) {
  const s = scanUnreleased(github, repo);
  if (!s.rel || s.aheadBy <= 0 || s.work > 0) return false;
  if (!s.commits.every((c) => c.resync || c.pinMove)) return false;
  return s.commits.some((c) => c.pinMove || (c.resync && !c.vendored));
}
```

A commit that only re-synced and came from no resync pull request has neither mark, so it keeps today's answer: the release is not pending.

`unreleasedCommits` keeps its own loop and its return shape, and marks a pin move. Before the loop, take the pin-move commits from the scan, `const moves = new Set(scanUnreleased(github, repo).commits?.filter((c) => c.pinMove).map((c) => c.sha) ?? []);`, and push each commit as `{ sha, subject: commit.subject, resyncOnly: resyncOnly(github, repo, sha, commit), pinMove: moves.has(sha) }`.

- [ ] **Step 5: Name the hand pull requests in the notes**

In `family/words.mjs`, add:

```js
// The release notes of a member whose unreleased work includes pull requests a person made to
// move its pins: the run's notes, with one line per pull request after their first paragraph.
export function withCarried(notes, pulls) {
  if (!pulls.length) return notes;
  const lines = pulls.map((p) => `It also carries [#${p.number}](${p.url}), made by hand: ${p.title}.`).join('\n');
  const [first, ...rest] = notes.split('\n\n');
  return [first, lines, ...rest].join('\n\n');
}
```

In `family/orchestrate.mjs`, import `handPulls` from `./assess.mjs` and `withCarried` from `./words.mjs`, and change the `release` helper so every release passes its notes through them:

```js
  const release = (repo, tag, notes, ...rest) => {
    const { tag: released, note = null, retries = [] } = member.release(repo, tag, withCarried(notes, handPulls(github, repo)), ...rest);
    if (dryRun) wouldRelease.add(repo);
    return { tag: released, note, retries };
  };
```

In `family/render.mjs`, change the commit line in `renderReport` to:

```js
      for (const c of m.unreleased.commits ?? []) lines.push(`  - ${c.sha.slice(0, 7)} ${cell(c.subject)}${c.resyncOnly ? ' (re-sync only)' : ''}${c.pinMove ? ' (pin move)' : ''}`);
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `node --test test/family/assess.test.mjs test/family/github.test.mjs test/family/orchestrate.test.mjs test/family/report.test.mjs` Expected: PASS, every existing test in these files included.

- [ ] **Step 7: Run the whole suite**

Run: `sh test/run.sh; echo "exit $?"; sh conventions/conventions-format; sh conventions/conventions-check` Expected: `all pass`, exit 0, and both checks exit 0.

- [ ] **Step 8: Commit**

```bash
git add family/github.mjs family/assess.mjs family/words.mjs family/orchestrate.mjs family/render.mjs test/family/fake-github.mjs test/family/assess.test.mjs test/family/github.test.mjs test/family/orchestrate.test.mjs test/family/report.test.mjs
git commit --author "Implementer <implementer@blust.ch>"
```

Subject: `A pin moved by hand is the resync's own work`. Body: why first (a member fixed by hand after a block blocked the next run as unreleased work, and held everything taking it), then `pullsOf`, how a pin move is recognized, that the notes name the pull request, and that any other work still blocks.

---

### Task 3: The README and the skill say how to pick members

**Files:**

- Modify: `README.md` (the section "Keeping the family in step")
- Modify: `.claude/skills/family-resync/SKILL.md`

**Interfaces:**

- Consumes: Task 1's pick syntax and Task 2's behavior.
- Produces: nothing other tasks read.

- [ ] **Step 1: The README**

In `README.md`'s section "Keeping the family in step", in the paragraph that opens `` `node family/resync.mjs dist/resync-<date>.json all` ``, change "or chain numbers from the report in place of `all`" to "or chain numbers from the report or members' names in place of `all`", and add after the sentence that ends "…moves the chosen chains level by level: one pull request per member, merged once its required check passes, and a minor release wherever a later level takes the member by tag.":

```markdown
A member's name, as `conventions/REPOSITORIES.md` lists it, moves that member alone: its pins the report shows behind, and nothing downstream of it, which the run record names as left for a later run and the next report offers as chains of their own. A member named alone is released only where something else in the run takes it by tag. A merged pull request that moved one of a member's declared pins counts as the run's own work, the fix that came with the move included, so a member fixed by hand after a block is released by the next run, with notes that name the pull request; any other work on its main still blocks.
```

- [ ] **Step 2: The skill**

In `.claude/skills/family-resync/SKILL.md`, change step 2 to ask "which chains or members to run: all, a list of chain numbers, or members' names — a name moves that member alone and leaves what is downstream of it for a later run", and change step 3's command to `node family/resync.mjs dist/resync-<date>.json <all | numbers… | names…>`.

- [ ] **Step 3: Check the prose**

Run: `sh conventions/conventions-format; sh conventions/conventions-check; sh test/run.sh; echo "exit $?"` Expected: every command exits 0 (the suite holds the README's commands where it reads them).

- [ ] **Step 4: Commit**

```bash
git add README.md .claude/skills/family-resync/SKILL.md
git commit --author "Writer <writer@blust.ch>"
```

Subject: `The README and the skill say how to pick members`. Body: why first (the run accepts names now; a reader who knows only chains would not find it), then what each says. Trailers with `Track: Prose`.
