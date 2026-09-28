# Family resync — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A report in this repository that reads every member's pins from GitHub and says what is behind, and a run that moves the chains the owner chooses through to merged pull requests and releases.

**Architecture:** Node modules under `family/`, no dependencies, each with one job: parse `REPOSITORIES.md`, read and write the pin kinds, ask GitHub five questions, assess a member's pins, compute levels and chains, render Markdown, orchestrate the run, and carry one member through git and GitHub. Every call to `gh` goes through `family/gh.mjs`, so the report is tested against an in-memory GitHub and the run against real git repositories in a temporary folder with a `gh` stub first on the path. Two skills call the two scripts.

**Tech Stack:** Node 22 (`node:test`, `node:child_process`, `node:fs`), git, `gh`, POSIX sh for `test/run.sh`.

**Spec:** `docs/superpowers/specs/2026-09-28-family-resync-design.md`

## Global Constraints

- No npm dependency anywhere under `family/` or `test/family/`; Node 22 is what CI's `actions/setup-node` gives.
- The report writes only `dist/resync-YYYY-MM-DD.md` and `dist/resync-YYYY-MM-DD.json`; the run writes only `dist/resync-run-YYYY-MM-DD.md` in this repository. `dist` is ignored.
- The date is the local date as `YYYY-MM-DD`, `new Date().toLocaleDateString('en-CA')`; a person reads it as `Sep 28, 2026`.
- Branch `resync-YYYY-MM-DD`, release branch `resync-YYYY-MM-DD-release`, worktree `<root>/<owner>/<name>-<branch>`, where `<root>` is `FAMILY_ROOT` or `~/git`.
- Clones come from `FAMILY_REMOTE` or `https://github.com`, as `<remote>/<owner>/<name>.git`.
- Merge only with `gh pr merge <n> --repo <r> --merge`. Tags are `v<major>.<minor>.<patch>`; a release the run makes is the next minor of the latest GitHub Release.
- The run never releases `robertblust/conventions`.
- Markdown in the repository follows `conventions/WRITING.md`: American spelling, one line per paragraph, compact tables, and `sh conventions/conventions-check` and `sh conventions/conventions-format` pass after every task.
- Commit messages are in the git register: a plain sentence as subject, a short body, a `Verified:` line, then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Commit only on the owner's word, which approving this plan for execution gives for the plan's commits.
- `sh test/run.sh` runs the family tests; it must pass after every task from Task 3 on.

## Review Focus

- `robertblust/conventions` holds a `conventions.json` that names itself; that self-pin must be ignored, or conventions sits on a cycle and every member is blocked. Task 5 tests it.
- A member the token cannot read, or a repository in the table that does not exist, must be named under what disagrees and left out of the levels, not crash the report. Task 7 tests it.
- A run cut short and run again the same day must find its branch, pull request and release and go on, never open a second pull request. Task 9 tests it.
- `gh pr checks` right after `gh pr create` answers “no checks reported” before the workflow has started; the run must wait and retry, not block the member. Task 9 tests it.
- A member with two pins that move in one run must get one pull request carrying both. Task 8 tests it.

---

### Task 1: `REPOSITORIES.md` names the pins the stack still misses

The scan behind the spec found three pins that #60 and #61 do not show. The report of Task 7 holds the drawing to the members' real pins, so the drawing must carry them before the report is useful. This is a fourth layer on the stack, because #60 to #63 are pushed and are not rewritten.

**Files:**

- Modify: `conventions/REPOSITORIES.md` (the “What pins what” paragraph and the Mermaid block)

- [ ] **Step 1: Add the worktree on top of the stack**

```bash
cd ~/git/robertblust/conventions && git fetch -q origin
git worktree add ../conventions-repositories-names-the-rest -b repositories-names-the-rest origin/pins-by-what-is-taken
cd ../conventions-repositories-names-the-rest && git config user.email
```

Expected: the last line prints `robert.blust@flatland.ch`.

- [ ] **Step 2: Edit the paragraph**

In the “What pins what” paragraph make three replacements, each string exactly once:

- `All three sites also depend on `companygraph/meta-model` by tag in `package.json` for the instance parser.` → `All three sites also depend on `companygraph/meta-model` by tag in `package.json` for the instance parser, and take `companygraph/mcp-server` by tag there too.`
- `and the server by tag in `package.json`, and builds` → `and the server and `robertblust/design` by tag in `package.json`, and builds`
- `The chat server pins nothing of the family: it is a client of whichever MCP host a deployment names, and each of the same three deployments pins it by tag in `chat/package.json`` → `The chat server takes `companygraph/mcp-server` by tag in `package.json` as a development dependency and is a client of whichever MCP host a deployment names, and each of the same three deployments pins it and `robertblust/design` by tag in `chat/package.json``

- [ ] **Step 3: Edit the drawing**

Add these three lines inside the Mermaid block, after the line `mcpsrv & obsidian -->|tag| meta`:

```text
  blust & cgio & ggio -->|tag| mcpsrv
  chat -->|tag| mcpsrv
  mcpblust & mcpcg & mcpgg -->|tag| design
```

- [ ] **Step 4: Run the checks**

Run: `sh test/run.sh > /tmp/t 2>&1; echo $?; grep -E '✗|drawn|all pass' /tmp/t; sh conventions/conventions-check; sh conventions/conventions-format`

Expected: `0`, `✓ every repository in REPOSITORIES.md is drawn or named as left out`, `all pass`, and both checks print their `✓` line.

- [ ] **Step 5: Commit, push, open the pull request and link it to the stack**

```bash
git commit -qam "REPOSITORIES.md names the pins the stack still missed

A scan of every member's pin files found three pins the paragraph and the drawing
leave out: the three sites take mcp-server by tag, chat-server takes it as a
development dependency, and the three deployments take design by tag in both of
their package files. The family report holds the drawing to the members' real pins,
so the drawing carries them.

Verified: sh test/run.sh, conventions-check and conventions-format pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push -qu origin repositories-names-the-rest
gh pr create --base pins-by-what-is-taken --title "REPOSITORIES.md names the pins the stack still missed" --body "Stacked on #63, #61 and #60. The sites take mcp-server by tag, chat-server takes it as a development dependency, and the deployments take design by tag in both package files; the paragraph and the drawing now say so.

Verified: sh test/run.sh, conventions-check and conventions-format pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh stack link 60 61 63 "$(gh pr view --json number -q .number)"
```

Expected: the stack reports four pull requests. The owner merges the stack and #64 before Task 2 starts.

---

### Task 2: The contract, `conventions/PINS.md`, vendored

**Files:**

- Create: `conventions/PINS.md`
- Modify: `conventions/conventions-sync:22` (the `FILES` list), `test/run.sh:21` (the list of vendored files), `AGENTS.md` (the block's list), `README.md` (the list of files near the top), `.gitignore`, `docs/superpowers/specs/2026-09-28-family-resync-design.md`

- [ ] **Step 1: Add the worktree from `main`**

```bash
cd ~/git/robertblust/conventions && git switch -q main && git pull -q
git worktree add ../conventions-family-resync -b family-resync main
cd ../conventions-family-resync && git config user.email
```

Expected: `robert.blust@flatland.ch`. Every later task works in `~/git/robertblust/conventions-family-resync`.

- [ ] **Step 2: Write the failing test**

In `test/run.sh` line 21, add `PINS.md` after `REPOSITORIES.md` in the `for f in …` list.

- [ ] **Step 3: Run it to see it fail**

Run: `sh test/run.sh 2>&1 | grep PINS`

Expected: `✗ sync did not write conventions/PINS.md`

- [ ] **Step 4: Write `conventions/PINS.md`**

````markdown
# Pins

What a member takes from another member of the family is a pin, and `WORKING.md` says why a pin is a tag or a commit. This file says how a member declares its pins so that the family resync in robertblust/conventions can read and move them: a report that says which pins are behind, and a run that moves the ones the owner chooses through to merged pull requests and releases.

## The kinds

| Kind | The line | How it moves |
| --- | --- | --- |
| `conventions` | `tag` in `conventions.json` | set the tag, `sh conventions/conventions-sync sync`, and every `robertblust/conventions/.github/workflows/check.yml@<tag>` line under `.github/workflows/` |
| `service-conventions` | `tag` in `service-conventions.json` | set the tag, `sh service-conventions/service-conventions-sync sync` |
| `npm-tag` | `github:owner/repo#tag` in a `package.json` | set the tag, `npm install` |
| `source-commit` | an object with `repo` and `commit` in a JSON file, at the top or under a key | set the commit of the object whose `repo` matches |
| `contract-commit` | a string `owner/repo@commit:path` in a JSON file | set the commit of every string for that repository |
| `core-release` | `core.version` in `.companygraph/manifest.json` | the entry's own `move` command |

## `pins.json`

A member declares its pins in `pins.json` at its root. The report reads every pin a member's files hold, declared or not, and shows a pin the file does not declare as unmanaged and never moves it. The file is a member's consent to be moved, and the commands in it are how the member rebuilds itself after a move.

```json
{
  "pins": [
    { "kind": "conventions", "file": "conventions.json", "repo": "robertblust/conventions" },
    { "kind": "npm-tag", "file": "package.json", "repo": "robertblust/design", "after": ["npm run design"] },
    { "kind": "source-commit", "file": "source.json", "repo": "robertblust/mental-model", "after": ["npm run model", "npm run pages"] }
  ],
  "verify": ["npm test"],
  "release": ["npm version {version} --no-git-tag-version"]
}
```

`pins` lists the pins. Each names its `kind`, the `file` that holds the line and the `repo` it points at. `after` lists the commands that run in the member once that pin has moved, in order. `move`, a command with `{version}` in it, replaces the kind's own move, and a `core-release` pin must give one. `watch` lists paths in the upstream for a commit pin, which is then behind only when a newer commit touches one of them; a `contract-commit` pin watches the paths its strings name without being told.

`verify` lists the commands that run once every pin of the member has moved, and a failing one blocks the member. `release` lists the commands that run when the resync releases the member, with `{version}` standing for the new version without its `v`; they leave the bump uncommitted, and the run commits it. A member that nothing takes by tag has no `release`.

The report names every entry that does not match a line in the file it names, so a `pins.json` that has fallen behind its member is seen the first time the report runs.
````

- [ ] **Step 5: Vendor it and name it**

- `conventions/conventions-sync:22`: add `PINS.md` after `REPOSITORIES.md` in `FILES`.
- `AGENTS.md` block, after the `REPOSITORIES.md` line: `- `conventions/PINS.md` — what a member pins and how the family resync moves it.`
- `README.md`, in the list of files near the top, after the `REPOSITORIES.md` line: `- `conventions/PINS.md` — how a member declares its pins in `pins.json`, for the family resync.`
- `.gitignore`, at the end:

```text
# The family report and the resync write here; what they write is regenerated, never kept.
/dist
```

- [ ] **Step 6: Amend the spec where the plan settled it**

In `docs/superpowers/specs/2026-09-28-family-resync-design.md`, section 3: replace `` `release` runs when the member is released and leaves the version bump uncommitted for the run to commit. `` with `` `release` runs when the member is released, with `{version}` for the new version without its `v`, and leaves the bump uncommitted for the run to commit. `` In section 4, replace `a pin the members hold that the paragraph and drawing of `REPOSITORIES.md` do not show` with `a pin the members hold that the drawing in `REPOSITORIES.md` does not show — the drawing is the form a script can read, and the note beside it holds the paragraph to it —`, and add after the paragraph on levels: `A member's pin on itself, as conventions' own `conventions.json` is, is not an edge.`

- [ ] **Step 7: Run the checks**

Run: `sh test/run.sh > /tmp/t 2>&1; echo $?; grep -E '✗|all pass' /tmp/t; sh conventions/conventions-check; sh conventions/conventions-format`

Expected: `0`, `all pass`, and both `✓` lines. If the block test compares `AGENTS.md` against a list the script writes, it names the file to change beside it; add the same line there.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -qm "PINS.md says how a member declares its pins

The family resync moves a member's pins only where the member has said what they are
and how it rebuilds after a move. PINS.md names the six kinds of pin and the format
of pins.json, and is vendored so a member reads it where it writes that file. The
report and the run write to dist/, which is ignored.

Verified: sh test/run.sh, conventions-check and conventions-format pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The family as `REPOSITORIES.md` writes it

**Files:**

- Create: `family/repositories.mjs`, `test/family/repositories.test.mjs`
- Modify: `test/run.sh` (run the family tests)

**Interfaces:**

- Produces: `parseMembers(markdown: string) → { repo: string, title: string }[]`; `parseDrawing(markdown: string) → Set<string>` of `"<from repo>><to repo>"`.

- [ ] **Step 1: Hook the family tests into `test/run.sh`**

Insert before the comment `# the workflow's declared release and the marker version cannot drift apart`:

```sh
# The family report and run carry their own tests, on Node's runner.
if command -v node > /dev/null 2>&1; then
  if node --test "$HERE"/test/family/*.test.mjs > "$TMP/family.out" 2>&1
  then ok "the family report and run pass their tests"
  else bad "the family tests failed: $(tail -30 "$TMP/family.out")"
  fi
else
  bad "node is not on the path, so the family tests did not run"
fi
```

- [ ] **Step 2: Write the failing test**

`test/family/repositories.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMembers, parseDrawing } from '../../family/repositories.mjs';

const md = `| Repository | Title | Purpose | Default branch | Local path |
| --- | --- | --- | --- | --- |
| robertblust/design | Robert Blust — Design | x | main | ~/git/robertblust/design |
| companygraph/meta-model | CompanyGraph — Meta Model | x | main | x |

\`\`\`mermaid
flowchart TB
  subgraph robertblust
    design[design]
    blust[robertblust.github.io]
  end
  subgraph companygraph
    meta[meta-model]
  end
  blust -->|tag| design & meta
\`\`\`
`;

test('the members are the rows of the table', () => {
  assert.deepEqual(parseMembers(md).map((m) => m.repo), ['robertblust/design', 'companygraph/meta-model']);
  assert.equal(parseMembers(md)[0].title, 'Robert Blust — Design');
});

test('the drawing gives every pair an edge line joins', () => {
  assert.deepEqual([...parseDrawing(md)].sort(), [
    'robertblust/robertblust.github.io>companygraph/meta-model',
    'robertblust/robertblust.github.io>robertblust/design',
  ]);
});

test('a file without a drawing draws nothing', () => {
  assert.equal(parseDrawing('# nothing\n').size, 0);
});

test('the family file itself parses', () => {
  const real = readFileSync(new URL('../../conventions/REPOSITORIES.md', import.meta.url), 'utf8');
  assert.ok(parseMembers(real).some((m) => m.repo === 'robertblust/conventions'));
  assert.ok(parseDrawing(real).has('companygraph/mcp-server>companygraph/meta-model'));
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `node --test test/family/repositories.test.mjs`

Expected: FAIL, `Cannot find module …/family/repositories.mjs`.

- [ ] **Step 4: Write `family/repositories.mjs`**

```js
// The family as REPOSITORIES.md writes it: the members of its table, and the pairs its drawing
// of what pins what connects, as "<from>><to>".
export function parseMembers(markdown) {
  return markdown
    .split('\n')
    .map((line) => line.match(/^\| ([\w.-]+\/[\w.-]+) \| ([^|]+) \|/))
    .filter(Boolean)
    .map((m) => ({ repo: m[1], title: m[2].trim() }));
}

export function parseDrawing(markdown) {
  const pairs = new Set();
  const block = markdown.match(/^```mermaid\n([\s\S]*?)^```$/m);
  if (!block) return pairs;
  const repoOf = {};
  const edges = [];
  let org = null;
  for (const line of block[1].split('\n')) {
    const sub = line.match(/^\s*subgraph (\S+)/);
    if (sub) { org = sub[1]; continue; }
    if (/^\s*end\s*$/.test(line)) { org = null; continue; }
    const edge = line.match(/^\s*(.+?)\s*-->\s*(?:\|[^|]*\|\s*)?(.+?)\s*$/);
    if (edge) { edges.push([edge[1], edge[2]]); continue; }
    const node = line.match(/^\s*(\w+)\[([^\]]+)\]\s*$/);
    if (node && org) repoOf[node[1]] = `${org}/${node[2]}`;
  }
  const ids = (s) => s.split('&').map((x) => x.trim());
  for (const [from, to] of edges) for (const a of ids(from)) for (const b of ids(to)) pairs.add(`${repoOf[a]}>${repoOf[b]}`);
  return pairs;
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `node --test test/family/repositories.test.mjs && sh test/run.sh | tail -1`

Expected: 4 tests pass, then `all pass`.

- [ ] **Step 6: Commit**

```bash
git add family test && git commit -qm "The family scripts read REPOSITORIES.md

The report takes the members from the table and holds the members' pins to the
drawing, so both are parsed here, and test/run.sh runs the family tests on Node's
own runner.

Verified: node --test test/family and sh test/run.sh pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The pin kinds

**Files:**

- Create: `family/pins.mjs`, `test/family/pins.test.mjs`

**Interfaces:**

- Produces: `KINDS: Record<kind, { byTag: boolean, read(text, repo) → string[], write(text, repo, value) → string | null, watch?(text, repo) → string[], commands: string[] }>`; `SCANNED: string[]`; `discover(file, text) → { kind, file, repo }[]`; `pinKey(p: { taker, kind, file, upstream }) → string`; `validatePins(obj) → obj`, throwing `Error` with the reason.

- [ ] **Step 1: Write the failing test**

`test/family/pins.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KINDS, discover, validatePins, pinKey } from '../../family/pins.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);

test('a conventions pin reads and writes its tag and nothing else', () => {
  const text = '{ "repo": "robertblust/conventions", "tag": "v1.34.0", "exclude": ["meta"] }\n';
  assert.deepEqual(KINDS.conventions.read(text), ['v1.34.0']);
  assert.equal(KINDS.conventions.write(text, 'robertblust/conventions', 'v1.35.0'), '{ "repo": "robertblust/conventions", "tag": "v1.35.0", "exclude": ["meta"] }\n');
});

test('an npm pin moves only its own repository', () => {
  const text = '{ "a": "github:companygraph/meta-model#v0.55.0", "b": "github:companygraph/mcp-server#v0.38.0" }';
  assert.deepEqual(KINDS['npm-tag'].read(text, 'companygraph/meta-model'), ['v0.55.0']);
  assert.equal(KINDS['npm-tag'].write(text, 'companygraph/meta-model', 'v0.56.0'), '{ "a": "github:companygraph/meta-model#v0.56.0", "b": "github:companygraph/mcp-server#v0.38.0" }');
});

test('a source pin finds its object at the top or under a key', () => {
  const top = `{"repo": "robertblust/mental-model", "commit": "${A}"}`;
  const keyed = `{"meta-model":{"repo":"companygraph/meta-model","commit":"${A}"},"mental-model":{"repo":"companygraph/mental-model","commit":"${B}"}}`;
  assert.deepEqual(KINDS['source-commit'].read(top, 'robertblust/mental-model'), [A]);
  assert.equal(KINDS['source-commit'].write(keyed, 'companygraph/mental-model', C), keyed.replace(B, C));
});

test('a contract pin moves every string of its repository and watches their paths', () => {
  const text = `{ "sources": [ "guestgraph/engine@${A}:specs/005/contracts/a.yaml", "guestgraph/engine@${B}:specs/009/contracts/b.yaml" ] }`;
  assert.deepEqual(KINDS['contract-commit'].read(text, 'guestgraph/engine'), [A, B]);
  assert.deepEqual(KINDS['contract-commit'].watch(text, 'guestgraph/engine'), ['specs/005/contracts/a.yaml', 'specs/009/contracts/b.yaml']);
  const moved = KINDS['contract-commit'].write(text, 'guestgraph/engine', C);
  assert.deepEqual(KINDS['contract-commit'].read(moved, 'guestgraph/engine'), [C]);
});

test('a core pin reads core.version and is moved only by its own command', () => {
  assert.deepEqual(KINDS['core-release'].read('{"tooling":"0.57.0","core":{"version":"0.46.0"}}'), ['0.46.0']);
  assert.equal(KINDS['core-release'].write, null);
});

test('discover finds the pins of every scanned file', () => {
  const kinds = (ps) => ps.map((p) => `${p.kind} ${p.repo}`);
  assert.deepEqual(kinds(discover('conventions.json', '{"repo":"robertblust/conventions","tag":"v1.0.0"}')), ['conventions robertblust/conventions']);
  assert.deepEqual(kinds(discover('service-conventions.json', '{"repo":"guestgraph/service-conventions","tag":"v0.10.1"}')), ['service-conventions guestgraph/service-conventions']);
  assert.deepEqual(kinds(discover('chat/package.json', '{"x":"github:companygraph/chat-server#v0.17.3","y":"github:robertblust/design#v0.87.0"}')), ['npm-tag companygraph/chat-server', 'npm-tag robertblust/design']);
  assert.deepEqual(kinds(discover('api-sources.json', `{"engine":{"repo":"guestgraph/engine","commit":"${A}"}}`)), ['source-commit guestgraph/engine']);
  assert.deepEqual(kinds(discover('src/main/resources/api/sources.json', `{"sources":["guestgraph/engine@${A}:x.yaml","guestgraph/engine@${B}:y.yaml"]}`)), ['contract-commit guestgraph/engine']);
  assert.deepEqual(kinds(discover('.companygraph/manifest.json', '{"core":{"version":"0.46.0"}}')), ['core-release companygraph/meta-model']);
  assert.deepEqual(discover('source.json', 'not json'), []);
  assert.deepEqual(discover('package.json', '{"name":"no pins"}'), []);
});

test('validatePins refuses what the run could not follow', () => {
  assert.throws(() => validatePins({}), /no "pins" list/);
  assert.throws(() => validatePins({ pins: [{ kind: 'svn', file: 'x', repo: 'a/b' }] }), /unknown kind/);
  assert.throws(() => validatePins({ pins: [{ kind: 'npm-tag', repo: 'a/b' }] }), /needs "file" and "repo"/);
  assert.throws(() => validatePins({ pins: [{ kind: 'core-release', file: '.companygraph/manifest.json', repo: 'companygraph/meta-model' }] }), /needs "move"/);
  assert.throws(() => validatePins({ pins: [{ kind: 'npm-tag', file: 'package.json', repo: 'a/b', after: 'npm run x' }] }), /"after" is a list/);
  assert.throws(() => validatePins({ pins: [], verify: 'npm test' }), /"verify" is a list/);
});

test('the example in PINS.md is a valid pins.json', () => {
  const md = readFileSync(new URL('../../conventions/PINS.md', import.meta.url), 'utf8');
  validatePins(JSON.parse(md.match(/```json\n([\s\S]*?)```/)[1]));
});

test('a pin key names the member, the kind, the file and the upstream', () => {
  assert.equal(pinKey({ taker: 'a/b', kind: 'npm-tag', file: 'package.json', upstream: 'c/d' }), 'a/b|npm-tag|package.json|c/d');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/family/pins.test.mjs`

Expected: FAIL, `Cannot find module …/family/pins.mjs`.

- [ ] **Step 3: Write `family/pins.mjs`**

```js
// The kinds of pin conventions/PINS.md defines: how each reads its line, how it writes a new
// value into it, and what runs after. `discover` finds the pins a member's files hold whether or
// not its pins.json declares them, so the report can name the ones it does not.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const uniq = (xs) => [...new Set(xs)];

function sourceObjects(obj) {
  if (obj && obj.repo && obj.commit) return [obj];
  return Object.values(obj ?? {}).filter((v) => v && typeof v === 'object' && v.repo && v.commit);
}

function setJsonString(text, key, value) {
  const re = new RegExp(`("${key}"\\s*:\\s*")[^"]*"`);
  if (!re.test(text)) throw new Error(`no "${key}" to set`);
  return text.replace(re, `$1${value}"`);
}

export const KINDS = {
  conventions: {
    byTag: true,
    read: (text) => [JSON.parse(text).tag],
    write: (text, repo, value) => setJsonString(text, 'tag', value),
    commands: ['sh conventions/conventions-sync sync'],
  },
  'service-conventions': {
    byTag: true,
    read: (text) => [JSON.parse(text).tag],
    write: (text, repo, value) => setJsonString(text, 'tag', value),
    commands: ['sh service-conventions/service-conventions-sync sync'],
  },
  'npm-tag': {
    byTag: true,
    read: (text, repo) => uniq([...text.matchAll(new RegExp(`"github:${esc(repo)}#([^"]+)"`, 'g'))].map((m) => m[1])),
    write: (text, repo, value) => text.replace(new RegExp(`("github:${esc(repo)}#)[^"]+"`, 'g'), `$1${value}"`),
    commands: ['npm install'],
  },
  'source-commit': {
    byTag: false,
    read: (text, repo) => uniq(sourceObjects(JSON.parse(text)).filter((o) => o.repo === repo).map((o) => o.commit)),
    write: (text, repo, value) => KINDS['source-commit'].read(text, repo).reduce((out, c) => out.split(c).join(value), text),
    commands: [],
  },
  'contract-commit': {
    byTag: false,
    read: (text, repo) => uniq([...text.matchAll(new RegExp(`${esc(repo)}@([0-9a-f]{7,40}):`, 'g'))].map((m) => m[1])),
    write: (text, repo, value) => text.replace(new RegExp(`(${esc(repo)}@)[0-9a-f]{7,40}:`, 'g'), `$1${value}:`),
    watch: (text, repo) => uniq([...text.matchAll(new RegExp(`${esc(repo)}@[0-9a-f]{7,40}:([^"\\s]+)`, 'g'))].map((m) => m[1])),
    commands: [],
  },
  'core-release': {
    byTag: true,
    read: (text) => [JSON.parse(text).core?.version].filter(Boolean),
    write: null,
    commands: [],
  },
};

// The files a member may hold a pin in, beside any its pins.json names.
export const SCANNED = [
  'conventions.json',
  'service-conventions.json',
  'package.json',
  'chat/package.json',
  'source.json',
  'api-sources.json',
  '.companygraph/manifest.json',
  'src/main/resources/api/sources.json',
];

export function discover(file, text) {
  const base = file.split('/').pop();
  const as = (kind, repos) => uniq(repos).map((repo) => ({ kind, file, repo }));
  try {
    if (file === 'conventions.json') return as('conventions', [JSON.parse(text).repo]);
    if (file === 'service-conventions.json') return as('service-conventions', [JSON.parse(text).repo]);
    if (file.endsWith('api/sources.json')) return as('contract-commit', [...text.matchAll(/"([\w.-]+\/[\w.-]+)@[0-9a-f]{7,40}:/g)].map((m) => m[1]));
    if (base === 'package.json') return as('npm-tag', [...text.matchAll(/"github:([\w.-]+\/[\w.-]+)#[^"]+"/g)].map((m) => m[1]));
    if (base === 'source.json' || base === 'api-sources.json') return as('source-commit', sourceObjects(JSON.parse(text)).map((o) => o.repo));
    if (file === '.companygraph/manifest.json') return JSON.parse(text).core?.version ? as('core-release', ['companygraph/meta-model']) : [];
  } catch {
    return [];
  }
  return [];
}

export const pinKey = (p) => `${p.taker}|${p.kind}|${p.file}|${p.upstream}`;

export function validatePins(obj) {
  if (!obj || !Array.isArray(obj.pins)) throw new Error('pins.json has no "pins" list');
  for (const [i, p] of obj.pins.entries()) {
    const at = `pins[${i}]`;
    if (!KINDS[p.kind]) throw new Error(`${at}: unknown kind "${p.kind}"`);
    if (typeof p.file !== 'string' || typeof p.repo !== 'string') throw new Error(`${at}: needs "file" and "repo"`);
    if (p.kind === 'core-release' && typeof p.move !== 'string') throw new Error(`${at}: a core-release pin needs "move"`);
    for (const k of ['after', 'watch']) if (p[k] !== undefined && !Array.isArray(p[k])) throw new Error(`${at}: "${k}" is a list`);
  }
  for (const k of ['verify', 'release']) if (obj[k] !== undefined && !Array.isArray(obj[k])) throw new Error(`"${k}" is a list`);
  return obj;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `node --test test/family/pins.test.mjs`

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add family test && git commit -qm "The family scripts know the six kinds of pin

Each kind reads its line, writes a new value into it and names what runs after,
as PINS.md says, and discover finds every pin a member's files hold so the report
can tell a declared pin from an unmanaged one. The example in PINS.md is held to
the same validation a member's pins.json gets.

Verified: node --test test/family and sh test/run.sh pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: GitHub, and a member's pins assessed against it

**Files:**

- Create: `family/gh.mjs`, `family/github.mjs`, `family/assess.mjs`, `test/family/fake-github.mjs`, `test/family/assess.test.mjs`

**Interfaces:**

- Consumes: `KINDS`, `SCANNED`, `discover`, `validatePins` from Task 4.
- Produces:
  - `gh(args: string[], { cwd }?) → string` (stdout), throwing `Error` with `.notFound` set on HTTP 404; `ghOrNull(args) → string | null`.
  - A GitHub object with `file(repo, path, ref = 'main') → string | null`, `latestRelease(repo) → { tag, url } | null`, `head(repo) → sha`, `compare(repo, base, head) → { aheadBy, shas: string[], files: string[] }`, `pullHeads(repo, sha) → string[]`. `realGithub()` returns one backed by `gh api`; `fakeGithub(fixtures)` one backed by objects.
  - `readMember(github, repo) → { repo, declared: object | null, invalid: string | null, texts: Record<path, string> }`.
  - `assessPins(github, member, family: Set<repo>, cache = new Map()) → Pin[]`, where `Pin = { taker, kind, file, upstream, pinned: string[], available?: string | null, url?: string | null, behindBy?: number, entry: object | null, status: 'current' | 'behind' | 'unmanaged' | 'drift' | 'outside' }`.
  - `releaseBlock(github, repo) → string | null`.

- [ ] **Step 1: Write the fixture GitHub**

`test/family/fake-github.mjs`:

```js
// GitHub for the tests: the same five questions realGithub answers, answered from objects a test
// builds and may change as a run goes on. A file at another ref is keyed "<path>@<ref>".
export function fakeGithub({ files = {}, releases = {}, heads = {}, compares = {}, pulls = {}, unreachable = [] } = {}) {
  const gate = (repo) => {
    if (unreachable.includes(repo)) throw new Error(`gh api repos/${repo}: HTTP 403`);
  };
  return {
    files, releases, heads, compares, pulls,
    file(repo, path, ref = 'main') { gate(repo); return files[repo]?.[ref === 'main' ? path : `${path}@${ref}`] ?? null; },
    latestRelease(repo) { gate(repo); return releases[repo] ?? null; },
    head(repo) { gate(repo); return heads[repo]; },
    compare(repo, base, head) { gate(repo); return compares[`${repo}:${base}...${head}`] ?? { aheadBy: 0, shas: [], files: [] }; },
    pullHeads(repo, sha) { gate(repo); return pulls[`${repo}:${sha}`] ?? []; },
  };
}
```

- [ ] **Step 2: Write the failing test**

`test/family/assess.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readMember, assessPins, releaseBlock } from '../../family/assess.mjs';
import { fakeGithub } from './fake-github.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const conv = (tag) => `{"repo":"robertblust/conventions","tag":"${tag}"}`;
const FAMILY = new Set(['robertblust/conventions', 'robertblust/design', 'robertblust/site', 'robertblust/model']);

function family(overrides = {}) {
  return fakeGithub({
    files: {
      'robertblust/conventions': { 'conventions.json': conv('v1.0.0') },
      'robertblust/site': {
        'conventions.json': conv('v0.9.0'),
        'package.json': '{"d":"github:robertblust/design#v2.0.0","x":"github:someone/else#v1"}',
        'source.json': `{"repo":"robertblust/model","commit":"${A}"}`,
        'pins.json': JSON.stringify({ pins: [
          { kind: 'conventions', file: 'conventions.json', repo: 'robertblust/conventions' },
          { kind: 'npm-tag', file: 'package.json', repo: 'robertblust/design' },
          { kind: 'source-commit', file: 'source.json', repo: 'robertblust/model', watch: ['model'] },
          { kind: 'npm-tag', file: 'chat/package.json', repo: 'robertblust/design' },
        ] }),
      },
      'robertblust/model': { 'conventions.json': conv('v1.0.0') },
    },
    releases: { 'robertblust/conventions': { tag: 'v1.0.0', url: 'u1' }, 'robertblust/design': { tag: 'v2.1.0', url: 'u2' } },
    heads: { 'robertblust/model': B },
    compares: { [`robertblust/model:${A}...${B}`]: { aheadBy: 3, shas: [], files: ['model/x.md'] } },
    ...overrides,
  });
}
const status = (pins) => Object.fromEntries(pins.map((p) => [`${p.kind} ${p.file} ${p.upstream}`, p.status]));

test('each pin of a member gets its status', () => {
  const gh = family();
  const pins = assessPins(gh, readMember(gh, 'robertblust/site'), FAMILY);
  assert.deepEqual(status(pins), {
    'conventions conventions.json robertblust/conventions': 'behind',
    'npm-tag package.json robertblust/design': 'behind',
    'npm-tag package.json someone/else': 'outside',
    'source-commit source.json robertblust/model': 'behind',
    'npm-tag chat/package.json robertblust/design': 'drift',
  });
  const model = pins.find((p) => p.upstream === 'robertblust/model');
  assert.equal(model.behindBy, 3);
  assert.equal(model.available, B);
});

test('a commit pin whose watched paths did not change is current', () => {
  const gh = family({ compares: { [`robertblust/model:${A}...${B}`]: { aheadBy: 3, shas: [], files: ['docs/y.md'] } } });
  const pins = assessPins(gh, readMember(gh, 'robertblust/site'), FAMILY);
  assert.equal(pins.find((p) => p.upstream === 'robertblust/model').status, 'current');
});

test('a member without pins.json has only unmanaged pins', () => {
  const gh = family();
  const pins = assessPins(gh, readMember(gh, 'robertblust/model'), FAMILY);
  assert.deepEqual(pins.map((p) => p.status), ['unmanaged']);
});

test('a member pinning itself is not a pin', () => {
  const gh = family();
  assert.deepEqual(assessPins(gh, readMember(gh, 'robertblust/conventions'), FAMILY), []);
});

test('an invalid pins.json is reported and its pins are unmanaged', () => {
  const gh = family();
  gh.files['robertblust/model']['pins.json'] = '{"pins": "no"}';
  const member = readMember(gh, 'robertblust/model');
  assert.match(member.invalid, /no "pins" list/);
  assert.deepEqual(assessPins(gh, member, FAMILY).map((p) => p.status), ['unmanaged']);
});

test('work on main since the last release blocks a release unless the run made it', () => {
  const gh = family({ compares: { 'robertblust/design:v2.1.0...main': { aheadBy: 1, shas: ['s1'], files: [] } } });
  assert.equal(releaseBlock(gh, 'robertblust/design'), 'unreleased work on main: 1 commit since v2.1.0');
  gh.pulls['robertblust/design:s1'] = ['resync-2026-09-28'];
  assert.equal(releaseBlock(gh, 'robertblust/design'), null);
  assert.equal(releaseBlock(gh, 'robertblust/model'), 'has no release to follow');
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `node --test test/family/assess.test.mjs`

Expected: FAIL, `Cannot find module …/family/assess.mjs`.

- [ ] **Step 4: Write `family/gh.mjs`**

```js
// Every call to GitHub goes through gh, and every call to gh goes through here, so a test puts
// its own gh first on the path and sees each call the scripts make.
import { execFileSync } from 'node:child_process';

export function gh(args, { cwd } = {}) {
  try {
    return execFileSync('gh', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    const err = new Error(`gh ${args.join(' ')}: ${String(e.stderr || e.message).trim()}`);
    err.notFound = /HTTP 404/.test(String(e.stderr));
    throw err;
  }
}

export function ghOrNull(args) {
  try {
    return gh(args);
  } catch (e) {
    if (e.notFound) return null;
    throw e;
  }
}
```

- [ ] **Step 5: Write `family/github.mjs`**

```js
// What the report and the run read from GitHub, as five questions. A test answers them from
// fixtures instead; the scripts ask nothing else.
import { ghOrNull } from './gh.mjs';

export function realGithub() {
  const json = (path) => {
    const out = ghOrNull(['api', path]);
    return out === null ? null : JSON.parse(out);
  };
  return {
    file(repo, path, ref = 'main') {
      return ghOrNull(['api', '-H', 'Accept: application/vnd.github.raw', `repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`]);
    },
    latestRelease(repo) {
      const r = json(`repos/${repo}/releases/latest`);
      return r && { tag: r.tag_name, url: r.html_url };
    },
    head(repo) {
      return json(`repos/${repo}/commits/main`).sha;
    },
    compare(repo, base, head) {
      const c = json(`repos/${repo}/compare/${base}...${head}`);
      return { aheadBy: c.ahead_by, shas: c.commits.map((x) => x.sha), files: (c.files ?? []).map((f) => f.filename) };
    },
    pullHeads(repo, sha) {
      return (json(`repos/${repo}/commits/${sha}/pulls`) ?? []).map((p) => p.head.ref);
    },
  };
}
```

- [ ] **Step 6: Write `family/assess.mjs`**

```js
// What each pin of a member is against what its upstream offers, and whether a member other
// members take by tag has work on main that no release describes.
import { KINDS, SCANNED, discover, validatePins } from './pins.mjs';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function readMember(github, repo) {
  const raw = github.file(repo, 'pins.json');
  let declared = null;
  let invalid = null;
  if (raw !== null) {
    try {
      declared = validatePins(JSON.parse(raw));
    } catch (e) {
      invalid = e.message;
    }
  }
  const paths = new Set([...SCANNED, ...(declared?.pins ?? []).map((p) => p.file)]);
  const texts = {};
  for (const path of paths) {
    const text = github.file(repo, path);
    if (text !== null) texts[path] = text;
  }
  return { repo, declared, invalid, texts };
}

function offered(github, cache, kind, repo) {
  const key = `${kind}|${repo}`;
  if (!cache.has(key)) {
    let value;
    if (kind === 'core-release') {
      const rel = github.latestRelease(repo);
      const manifest = rel && github.file(repo, 'core/manifest.json', rel.tag);
      value = { available: manifest ? JSON.parse(manifest).version : null, url: rel?.url ?? null };
    } else if (KINDS[kind].byTag) {
      const rel = github.latestRelease(repo);
      value = { available: rel?.tag ?? null, url: rel?.url ?? null };
    } else {
      value = { available: github.head(repo), url: `https://github.com/${repo}` };
    }
    cache.set(key, value);
  }
  return cache.get(key);
}

export function assessPins(github, member, family, cache = new Map()) {
  const found = Object.entries(member.texts).flatMap(([file, text]) => discover(file, text));
  const declared = member.declared?.pins ?? [];
  const pins = [];
  for (const f of found) {
    if (f.repo === member.repo) continue;
    const text = member.texts[f.file];
    const kind = KINDS[f.kind];
    const entry = declared.find((d) => d.kind === f.kind && d.file === f.file && d.repo === f.repo) ?? null;
    const pin = { taker: member.repo, kind: f.kind, file: f.file, upstream: f.repo, pinned: kind.read(text, f.repo), entry };
    if (!family.has(f.repo)) {
      pins.push({ ...pin, status: 'outside' });
      continue;
    }
    const { available, url } = offered(github, cache, f.kind, f.repo);
    Object.assign(pin, { available, url });
    let behind = false;
    if (kind.byTag) {
      behind = available !== null && pin.pinned.some((p) => p !== available);
    } else {
      const watch = entry?.watch ?? kind.watch?.(text, f.repo) ?? null;
      for (const p of pin.pinned.filter((c) => c !== available)) {
        const c = github.compare(f.repo, p, available);
        const touched = !watch || c.files.some((file) => watch.some((w) => file === w || file.startsWith(`${w}/`)));
        if (c.aheadBy > 0 && touched) {
          behind = true;
          pin.behindBy = Math.max(pin.behindBy ?? 0, c.aheadBy);
        }
      }
    }
    pin.status = entry ? (behind ? 'behind' : 'current') : 'unmanaged';
    pins.push(pin);
  }
  for (const d of declared) {
    let there = false;
    try {
      there = member.texts[d.file] !== undefined && KINDS[d.kind].read(member.texts[d.file], d.repo).length > 0;
    } catch {
      there = false;
    }
    if (!there) pins.push({ taker: member.repo, kind: d.kind, file: d.file, upstream: d.repo, pinned: [], entry: d, status: 'drift' });
  }
  return pins;
}

export function releaseBlock(github, repo) {
  const rel = github.latestRelease(repo);
  if (!rel) return 'has no release to follow';
  const c = github.compare(repo, rel.tag, 'main');
  if (c.aheadBy === 0) return null;
  const ours = c.shas.every((sha) => github.pullHeads(repo, sha).some((h) => h.startsWith('resync-')));
  return ours ? null : `unreleased work on main: ${plural(c.aheadBy, 'commit')} since ${rel.tag}`;
}
```

- [ ] **Step 7: Run it to see it pass**

Run: `node --test test/family/assess.test.mjs && sh test/run.sh | tail -1`

Expected: 6 tests pass, then `all pass`.

- [ ] **Step 8: Commit**

```bash
git add family test && git commit -qm "The family scripts assess a member's pins against GitHub

A member's pins are read from its main through gh, set against the latest release or
the head of main of each upstream, and given a status; a member other members take
by tag is blocked while main holds work no release describes. Every gh call goes
through one function, and the tests answer the same questions from fixtures.

Verified: node --test test/family and sh test/run.sh pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Levels and chains

**Files:**

- Create: `family/graph.mjs`, `test/family/graph.test.mjs`

**Interfaces:**

- Consumes: `KINDS` from Task 4; `Pin` from Task 5.
- Produces: `CONVENTIONS = 'robertblust/conventions'`; `TAG_KINDS: Set<kind>`; `edgesOf(pins) → { from, to, kinds: string[] }[]`; `levelsOf(repos, edges) → { level: Map<repo, number | null>, cycles: repo[][] }`; `downstreamOf(repo, edges) → Set<repo>`; `chainsOf(pins, edges, level) → Chain[]` with `Chain = { n, taker, kind, file, upstream, available, steps: repo[][] }`; `releasesIn(repo, closure: Set<repo>, edges) → boolean`.

- [ ] **Step 1: Write the failing test**

`test/family/graph.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edgesOf, levelsOf, downstreamOf, chainsOf, releasesIn } from '../../family/graph.mjs';

const pin = (taker, upstream, kind = 'npm-tag', status = 'current', available = 'v2') => ({ taker, upstream, kind, file: 'package.json', status, available, pinned: ['v1'] });
const pins = [
  pin('design', 'robertblust/conventions', 'conventions'),
  pin('meta', 'robertblust/conventions', 'conventions'),
  pin('server', 'meta', 'npm-tag', 'behind'),
  pin('chat', 'server'),
  pin('site', 'server'),
  pin('site', 'design'),
  pin('deploy', 'chat'),
  pin('deploy', 'model', 'source-commit'),
  pin('site', 'else', 'npm-tag', 'outside'),
];
const repos = ['robertblust/conventions', 'design', 'meta', 'server', 'chat', 'site', 'deploy', 'model'];

test('an edge joins a member and what it pins, outside pins aside', () => {
  const edges = edgesOf(pins);
  assert.ok(edges.some((e) => e.from === 'site' && e.to === 'design'));
  assert.ok(!edges.some((e) => e.to === 'else'));
});

test('a level is one above the highest level of what a member pins', () => {
  const { level, cycles } = levelsOf(repos, edgesOf(pins));
  assert.deepEqual(Object.fromEntries(level), { 'robertblust/conventions': 0, design: 1, meta: 1, server: 2, chat: 3, site: 3, deploy: 4, model: 0 });
  assert.deepEqual(cycles, []);
});

test('a cycle is named and its members have no level', () => {
  const { level, cycles } = levelsOf(['a', 'b', 'c'], edgesOf([pin('a', 'b'), pin('b', 'a'), pin('c', 'a')]));
  assert.equal(cycles.length, 1);
  assert.deepEqual([...cycles[0]].sort(), ['a', 'b']);
  assert.equal(level.get('a'), null);
  assert.equal(level.get('c'), null);
});

test('a chain carries a behind pin through everything downstream, level by level', () => {
  const edges = edgesOf(pins);
  const { level } = levelsOf(repos, edges);
  assert.deepEqual([...downstreamOf('server', edges)].sort(), ['chat', 'deploy', 'site']);
  const [chain] = chainsOf(pins, edges, level);
  assert.deepEqual(chain, { n: 1, taker: 'server', kind: 'npm-tag', file: 'package.json', upstream: 'meta', available: 'v2', steps: [['server'], ['chat', 'site'], ['deploy']] });
});

test('a member is released when a later member of the run takes it by tag', () => {
  const edges = edgesOf(pins);
  assert.equal(releasesIn('server', new Set(['server', 'chat']), edges), true);
  assert.equal(releasesIn('model', new Set(['model', 'deploy']), edges), false);
  assert.equal(releasesIn('server', new Set(['server']), edges), false);
  assert.equal(releasesIn('robertblust/conventions', new Set(['design']), edges), false);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/family/graph.test.mjs`

Expected: FAIL, `Cannot find module …/family/graph.mjs`.

- [ ] **Step 3: Write `family/graph.mjs`**

```js
// The family as a graph: an edge from each member to what it pins, a level for each member one
// above the highest level of what it pins, and the chains a behind pin starts.
import { KINDS } from './pins.mjs';

export const CONVENTIONS = 'robertblust/conventions';
export const TAG_KINDS = new Set(Object.keys(KINDS).filter((k) => KINDS[k].byTag));

export function edgesOf(pins) {
  const seen = new Map();
  for (const p of pins) {
    if (p.status === 'outside' || p.status === 'drift') continue;
    const key = `${p.taker}>${p.upstream}`;
    const e = seen.get(key) ?? { from: p.taker, to: p.upstream, kinds: [] };
    if (!e.kinds.includes(p.kind)) e.kinds.push(p.kind);
    seen.set(key, e);
  }
  return [...seen.values()];
}

export function levelsOf(repos, edges) {
  const ups = new Map(repos.map((r) => [r, []]));
  for (const e of edges) ups.get(e.from)?.push(e.to);
  const level = new Map();
  const open = new Set();
  const cycles = [];
  const visit = (r, stack) => {
    if (level.has(r)) return level.get(r);
    if (open.has(r)) {
      cycles.push(stack.slice(stack.indexOf(r)));
      return null;
    }
    open.add(r);
    let l = 0;
    for (const u of ups.get(r) ?? []) {
      const lu = visit(u, [...stack, r]);
      l = lu === null || l === null ? null : Math.max(l, lu + 1);
    }
    open.delete(r);
    level.set(r, l);
    return l;
  };
  for (const r of repos) visit(r, []);
  return { level, cycles };
}

export function downstreamOf(repo, edges) {
  const out = new Set();
  const walk = (r) => {
    for (const e of edges) {
      if (e.to === r && !out.has(e.from)) {
        out.add(e.from);
        walk(e.from);
      }
    }
  };
  walk(repo);
  return out;
}

export function chainsOf(pins, edges, level) {
  const rank = (p) => level.get(p.taker) ?? Infinity;
  return pins
    .filter((p) => p.status === 'behind')
    .sort((a, b) => rank(a) - rank(b) || a.taker.localeCompare(b.taker) || a.upstream.localeCompare(b.upstream))
    .map((p, i) => {
      const byLevel = new Map();
      for (const r of [p.taker, ...downstreamOf(p.taker, edges)]) {
        const l = level.get(r);
        if (l === null || l === undefined) continue;
        byLevel.set(l, [...(byLevel.get(l) ?? []), r]);
      }
      const steps = [...byLevel.keys()].sort((a, b) => a - b).map((l) => byLevel.get(l).sort());
      return { n: i + 1, taker: p.taker, kind: p.kind, file: p.file, upstream: p.upstream, available: p.available, steps };
    });
}

export function releasesIn(repo, closure, edges) {
  if (repo === CONVENTIONS) return false;
  return edges.some((e) => e.to === repo && closure.has(e.from) && e.kinds.some((k) => TAG_KINDS.has(k)));
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `node --test test/family/graph.test.mjs`

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add family test && git commit -qm "The family scripts compute levels and chains

A member's level is one above the highest level of what it pins, so the order a
resync moves in comes from the pins themselves; a cycle is named rather than
ordered. A chain carries a behind pin through every member downstream of it, and a
member is released only where a later member of the run takes it by tag.

Verified: node --test test/family and sh test/run.sh pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The report

**Files:**

- Create: `family/words.mjs`, `family/render.mjs`, `family/report.mjs`, `test/family/report.test.mjs`

**Interfaces:**

- Consumes: Tasks 3, 5 and 6.
- Produces:
  - `words.mjs`: `isSha(v) → boolean`, `shortV(v) → string`, `listed(xs: string[]) → string` (“a, b and c”), `plural(n, word) → string`, `longDate('2026-09-28') → 'Sep 28, 2026'`.
  - `assessFamily({ github, members, drawing, date }) → Report`, with `Report = { date, members: { repo, level, managed, blocked }[], pins: Pin[], edges, chains: Chain[], problems: { type, repo, text }[] }`.
  - `today() → 'YYYY-MM-DD'`.
  - `renderReport(report) → string`.

- [ ] **Step 1: Write the failing test**

`test/family/report.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessFamily } from '../../family/report.mjs';
import { renderReport } from '../../family/render.mjs';
import { longDate, listed } from '../../family/words.mjs';
import { fakeGithub } from './fake-github.mjs';

const conv = (tag) => `{"repo":"robertblust/conventions","tag":"${tag}"}`;
const declare = (...pins) => JSON.stringify({ pins });
const C = { kind: 'conventions', file: 'conventions.json', repo: 'robertblust/conventions' };

function world() {
  return fakeGithub({
    files: {
      'robertblust/conventions': { 'conventions.json': conv('v1.0.0') },
      'robertblust/design': { 'conventions.json': conv('v1.0.0'), 'pins.json': declare(C) },
      'robertblust/site': {
        'conventions.json': conv('v0.9.0'),
        'package.json': '{"d":"github:robertblust/design#v2.0.0","x":"github:someone/else#v1"}',
        'pins.json': declare(C, { kind: 'npm-tag', file: 'package.json', repo: 'robertblust/design' }),
      },
    },
    releases: { 'robertblust/conventions': { tag: 'v1.0.0', url: 'u1' }, 'robertblust/design': { tag: 'v2.1.0', url: 'u2' } },
    compares: { 'robertblust/design:v2.1.0...main': { aheadBy: 2, shas: ['s1', 's2'], files: [] } },
    unreachable: ['robertblust/gone'],
  });
}
const members = ['robertblust/conventions', 'robertblust/design', 'robertblust/site', 'robertblust/gone'].map((repo) => ({ repo }));

test('the report levels the family, blocks, chains and names what disagrees', () => {
  const r = assessFamily({ github: world(), members, drawing: new Set(['robertblust/site>robertblust/design']), date: '2026-09-28' });
  const m = Object.fromEntries(r.members.map((x) => [x.repo, x]));
  assert.equal(m['robertblust/conventions'].level, 0);
  assert.equal(m['robertblust/design'].level, 1);
  assert.equal(m['robertblust/site'].level, 2);
  assert.equal(m['robertblust/gone'].level, null);
  assert.equal(m['robertblust/design'].blocked, 'unreleased work on main: 2 commits since v2.1.0');
  assert.deepEqual(r.chains.map((c) => `${c.n} ${c.taker} ${c.upstream}`), ['1 robertblust/site robertblust/conventions', '2 robertblust/site robertblust/design']);
  assert.deepEqual(r.problems.map((p) => `${p.type} ${p.repo}`).sort(), ['outside robertblust/site', 'unreachable robertblust/gone']);
});

test('a pin the drawing does not show is named', () => {
  const r = assessFamily({ github: world(), members, drawing: new Set(), date: '2026-09-28' });
  assert.ok(r.problems.some((p) => p.type === 'undrawn' && p.repo === 'robertblust/site' && /robertblust\/design/.test(p.text)));
});

test('the Markdown opens with the counts and has one table per level', () => {
  const md = renderReport(assessFamily({ github: world(), members, drawing: new Set(['robertblust/site>robertblust/design']), date: '2026-09-28' }));
  assert.match(md, /^# Family resync report, Sep 28, 2026\n\n2 behind, 1 current, 0 unmanaged, 0 drift\.\n/);
  assert.match(md, /- robertblust\/design: unreleased work on main: 2 commits since v2\.1\.0/);
  assert.match(md, /## Level 2\n\n\| Member \| Pin \| Upstream \| Pinned \| Available \| Status \|\n\| --- \| --- \| --- \| --- \| --- \| --- \|\n/);
  assert.match(md, /\| robertblust\/site \| npm-tag `package.json` \| robertblust\/design \| v2\.0\.0 \| v2\.1\.0 \| behind \|/);
  assert.match(md, /## Chains\n\n1\. robertblust\/conventions v1\.0\.0 → robertblust\/site\n2\. robertblust\/design v2\.1\.0 → robertblust\/site\n/);
  assert.match(md, /## What disagrees\n\n/);
  assert.ok(md.endsWith('\n') && !md.endsWith('\n\n'));
});

test('dates and lists read as the family writes them', () => {
  assert.equal(longDate('2026-09-28'), 'Sep 28, 2026');
  assert.equal(listed(['a', 'b', 'c']), 'a, b and c');
  assert.equal(listed(['a']), 'a');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/family/report.test.mjs`

Expected: FAIL, `Cannot find module …/family/report.mjs`.

- [ ] **Step 3: Write `family/words.mjs`**

```js
// How the family's generated text writes a version, a list and a date, so the report, the
// commits and the release notes read as the rest of the family does.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const isSha = (v) => typeof v === 'string' && /^[0-9a-f]{40}$/.test(v);
export const shortV = (v) => (isSha(v) ? v.slice(0, 7) : v ?? '—');
export const listed = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const longDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};
```

- [ ] **Step 4: Write `family/render.mjs`**

```js
// The report as Markdown for a person: counts first, then one table per level, the chains a
// resync can choose from, and what disagrees.
import { shortV, longDate, plural } from './words.mjs';

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const statusText = (p) => (p.status === 'behind' && p.behindBy ? `behind, ${plural(p.behindBy, 'commit')}` : p.status);

export function renderReport(data) {
  const count = (s) => data.pins.filter((p) => p.status === s).length;
  const lines = [`# Family resync report, ${longDate(data.date)}`, ''];
  lines.push(`${count('behind')} behind, ${count('current')} current, ${count('unmanaged')} unmanaged, ${count('drift')} drift.`, '');
  const blocked = data.members.filter((m) => m.blocked);
  if (blocked.length) {
    lines.push('Blocked:', '');
    for (const m of blocked) lines.push(`- ${m.repo}: ${m.blocked}`);
    lines.push('');
  }
  const levels = [...new Set(data.members.map((m) => m.level).filter((l) => l !== null))].sort((a, b) => a - b);
  for (const l of levels) {
    const repos = data.members.filter((m) => m.level === l).map((m) => m.repo).sort();
    const rows = data.pins
      .filter((p) => repos.includes(p.taker) && p.status !== 'outside')
      .sort((a, b) => a.taker.localeCompare(b.taker) || a.upstream.localeCompare(b.upstream));
    lines.push(`## Level ${l}`, '');
    if (!rows.length) {
      lines.push(`Nothing in the family is pinned here: ${repos.join(', ')}.`, '');
      continue;
    }
    lines.push('| Member | Pin | Upstream | Pinned | Available | Status |', '| --- | --- | --- | --- | --- | --- |');
    for (const p of rows) {
      lines.push(`| ${p.taker} | ${p.kind} \`${p.file}\` | ${p.upstream} | ${p.pinned.map(shortV).join(', ') || '—'} | ${shortV(p.available)} | ${statusText(p)} |`);
    }
    lines.push('');
  }
  lines.push('## Chains', '');
  if (!data.chains.length) lines.push('Nothing is behind.');
  for (const c of data.chains) lines.push(`${c.n}. ${c.upstream} ${shortV(c.available)} → ${c.steps.map((s) => s.join(', ')).join(' → ')}`);
  lines.push('');
  if (data.problems.length) {
    lines.push('## What disagrees', '');
    for (const p of data.problems) lines.push(`- ${p.repo}: ${cell(p.text)}`);
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
```

- [ ] **Step 5: Write `family/report.mjs`**

```js
#!/usr/bin/env node
// The family report: every member's pins read from GitHub and set against what each upstream
// offers. `node family/report.mjs` writes dist/resync-<date>.md and .json and prints the path of
// the Markdown; it writes nothing else.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { parseMembers, parseDrawing } from './repositories.mjs';
import { readMember, assessPins, releaseBlock } from './assess.mjs';
import { edgesOf, levelsOf, chainsOf, CONVENTIONS, TAG_KINDS } from './graph.mjs';
import { renderReport } from './render.mjs';
import { realGithub } from './github.mjs';

export const HERE = dirname(dirname(fileURLToPath(import.meta.url)));
export const today = () => new Date().toLocaleDateString('en-CA');

export function assessFamily({ github, members, drawing, date }) {
  const repos = members.map((m) => m.repo);
  const family = new Set(repos);
  const cache = new Map();
  const pins = [];
  const managed = new Map();
  const problems = [];
  for (const repo of repos) {
    try {
      const member = readMember(github, repo);
      managed.set(repo, member.declared !== null);
      if (member.invalid) problems.push({ type: 'invalid', repo, text: `pins.json: ${member.invalid}` });
      pins.push(...assessPins(github, member, family, cache));
    } catch (e) {
      problems.push({ type: 'unreachable', repo, text: e.message });
    }
  }
  const edges = edgesOf(pins);
  const { level, cycles } = levelsOf(repos.filter((r) => managed.has(r)), edges);
  const blocked = new Map();
  for (const cycle of cycles) for (const r of cycle) blocked.set(r, `on a cycle: ${cycle.join(' → ')}`);
  const takenByTag = new Set(edges.filter((e) => e.to !== CONVENTIONS && e.kinds.some((k) => TAG_KINDS.has(k))).map((e) => e.to));
  for (const r of takenByTag) {
    if (blocked.has(r) || !managed.has(r)) continue;
    const reason = releaseBlock(github, r);
    if (reason) blocked.set(r, reason);
  }
  for (const e of edges) {
    if (e.to !== CONVENTIONS && !drawing.has(`${e.from}>${e.to}`)) problems.push({ type: 'undrawn', repo: e.from, text: `pins ${e.to}, which the drawing in REPOSITORIES.md does not show` });
  }
  for (const p of pins) if (p.status === 'outside') problems.push({ type: 'outside', repo: p.taker, text: `pins ${p.upstream} in ${p.file}, which is not in the family` });
  return {
    date,
    members: repos.map((repo) => ({ repo, level: level.get(repo) ?? null, managed: managed.get(repo) ?? false, blocked: blocked.get(repo) ?? null })),
    pins,
    edges,
    chains: chainsOf(pins, edges, level),
    problems,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const markdown = readFileSync(join(HERE, 'conventions/REPOSITORIES.md'), 'utf8');
  const date = today();
  const data = assessFamily({ github: realGithub(), members: parseMembers(markdown), drawing: parseDrawing(markdown), date });
  const out = join(HERE, 'dist');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, `resync-${date}.json`), `${JSON.stringify(data, null, 2)}\n`);
  writeFileSync(join(out, `resync-${date}.md`), renderReport(data));
  console.log(join(out, `resync-${date}.md`));
}
```

- [ ] **Step 6: Run it to see it pass**

Run: `node --test test/family/report.test.mjs && sh test/run.sh | tail -1`

Expected: 4 tests pass, then `all pass`.

- [ ] **Step 7: Run the report once against GitHub**

Run: `node family/report.mjs && sed -n '1,12p' dist/resync-$(date +%F).md`

Expected: the path of the report, then its title and counts. With no member yet carrying `pins.json`, every pin reads `unmanaged` and there are no chains; read “What disagrees” and confirm each line names a real mismatch. This step changes nothing on GitHub.

- [ ] **Step 8: Commit**

```bash
git add family test && git commit -qm "The family report reads every pin from GitHub

node family/report.mjs reads the members from REPOSITORIES.md and each member's pins
from its main, levels the family, blocks what cannot be released, numbers the chains
a resync can choose, and names what disagrees with the drawing. It writes dated
Markdown and JSON to dist/ and changes nothing else.

Verified: node --test test/family and sh test/run.sh pass, and the report ran
against GitHub.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: The run over the chosen chains

**Files:**

- Create: `family/orchestrate.mjs`, `test/family/orchestrate.test.mjs`
- Modify: `family/words.mjs` (add `commitMessage` and `releaseNotes`)

**Interfaces:**

- Consumes: `readMember`, `assessPins`, `releaseBlock` (Task 5); `releasesIn` (Task 6); `pinKey` (Task 4); `Report` (Task 7).
- Produces:
  - `words.mjs`: `commitMessage(pins: Pin[], ran: string[]) → { subject, body, full }`; `releaseNotes(pins: Pin[]) → string`.
  - `nextMinor(tag: string | undefined) → string`.
  - `orchestrate({ report, selection: 'all' | number[], github, member, date, log? }) → Record[]`, with `Record = { repo, status: 'done' | 'blocked' | 'held' | 'skipped', reason?, pr?, merge?, release?, note? }`.
  - The `member` it calls: `update(repo, pins: Pin[], { date, verify: string[] }) → { pr, merge, note? }` and `release(repo, tag, notes, commands: string[], { date }) → { tag }`, either throwing to block.

- [ ] **Step 1: Write the failing test**

`test/family/orchestrate.test.mjs`:

```js
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/family/orchestrate.test.mjs`

Expected: FAIL, `Cannot find module …/family/orchestrate.mjs`.

- [ ] **Step 3: Add `commitMessage` and `releaseNotes` to `family/words.mjs`**

Append:

```js
const moves = (pins) => listed(pins.map((p) => `${p.upstream} in \`${p.file}\` from ${p.pinned.map(shortV).join(', ')} to ${shortV(p.available)}`));

export function commitMessage(pins, ran) {
  const subject = `Takes ${listed([...new Set(pins.map((p) => `${p.upstream.split('/')[1]} ${shortV(p.available)}`))])}`;
  const notes = [...new Set(pins.map((p) => p.url).filter(Boolean))];
  const body = `The family resync moves ${moves(pins)}.${notes.length ? ` The upstream notes are at ${listed(notes)}.` : ''}`;
  const verified = ran.length ? `Verified: ${listed(ran.map((c) => `\`${c}\``))} passed.` : 'Verified: the move needed no command.';
  return { subject, body: `${body}\n\n${verified}`, full: `${subject}\n\n${body}\n\n${verified}\n` };
}

export function releaseNotes(pins) {
  const notes = [...new Set(pins.map((p) => p.url).filter(Boolean))];
  return `This release takes newer pins and changes nothing else: ${moves(pins)}.${notes.length ? ` Their notes are at ${listed(notes)}.` : ''}\n\nNothing breaks. A repository that takes this one re-pins it and changes nothing else.\n`;
}
```

- [ ] **Step 4: Write `family/orchestrate.mjs`**

```js
// The run over the chains the owner chose, level by level. It reads each member again before it
// moves it, so a release made at one level is there to take at the next, and it holds every
// member downstream of one it had to block.
import { readMember, assessPins, releaseBlock } from './assess.mjs';
import { releasesIn } from './graph.mjs';
import { pinKey } from './pins.mjs';
import { releaseNotes } from './words.mjs';

export const nextMinor = (tag) => {
  const m = tag?.match(/^v?(\d+)\.(\d+)\.\d+$/);
  return m ? `v${m[1]}.${Number(m[2]) + 1}.0` : 'v0.1.0';
};

export function orchestrate({ report, selection, github, member, date, log = () => {} }) {
  const chosen = selection === 'all' ? report.chains : report.chains.filter((c) => selection.includes(c.n));
  const starts = new Set(chosen.map((c) => pinKey(c)));
  const closure = new Set(chosen.flatMap((c) => c.steps.flat()));
  const levelOf = new Map(report.members.map((m) => [m.repo, m.level]));
  const family = new Set(report.members.map((m) => m.repo));
  const state = new Map();
  const record = [];
  const top = Math.max(0, ...[...closure].map((r) => levelOf.get(r) ?? 0));
  for (let l = 1; l <= top; l++) {
    const cache = new Map();
    for (const repo of [...closure].filter((r) => levelOf.get(r) === l).sort()) {
      const finish = (status, extra = {}) => {
        state.set(repo, status);
        record.push({ repo, status, ...extra });
        log(`${repo}: ${status}${extra.reason ? ` — ${extra.reason}` : ''}`);
      };
      const waits = report.edges.filter((e) => e.from === repo && ['blocked', 'held'].includes(state.get(e.to))).map((e) => e.to);
      if (waits.length) { finish('held', { reason: `waits on ${waits.join(', ')}` }); continue; }
      const current = readMember(github, repo);
      if (!current.declared) { finish('skipped', { reason: 'no pins.json' }); continue; }
      const pins = assessPins(github, current, family, cache).filter((p) => p.status === 'behind' && (starts.has(pinKey(p)) || closure.has(p.upstream)));
      if (!pins.length) { finish('skipped', { reason: 'nothing to move' }); continue; }
      const releasing = releasesIn(repo, closure, report.edges);
      const unreleased = releasing ? releaseBlock(github, repo) : null;
      if (unreleased) { finish('blocked', { reason: unreleased }); continue; }
      try {
        const landed = member.update(repo, pins, { date, verify: current.declared.verify ?? [] });
        const release = releasing
          ? member.release(repo, nextMinor(github.latestRelease(repo)?.tag), releaseNotes(pins), current.declared.release ?? [], { date }).tag
          : null;
        finish('done', { pr: landed.pr, merge: landed.merge, release, note: landed.note ?? null });
      } catch (e) {
        finish('blocked', { reason: e.message });
      }
    }
  }
  return record;
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `node --test test/family/orchestrate.test.mjs && sh test/run.sh | tail -1`

Expected: 6 tests pass, then `all pass`.

- [ ] **Step 6: Commit**

```bash
git add family test && git commit -qm "The family resync runs the chosen chains level by level

The run reads each member again before it moves it, so a release it made at one level
is taken at the next; it gives each member one update for every pin that moves, blocks
a member whose main holds unreleased work before touching it, and holds everything
downstream of a blocked member while the rest goes on.

Verified: node --test test/family and sh test/run.sh pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: One member through git and GitHub

**Files:**

- Create: `family/member.mjs`, `test/family/gh-stub.mjs`, `test/family/member.test.mjs`

**Interfaces:**

- Consumes: `gh` (Task 5), `KINDS` (Task 4), `commitMessage` (Task 8).
- Produces: `class Blocked extends Error`; `realMember({ root?, remote?, dryRun?, log?, checkWait?, checkTries? }) → { update, release }` with the signatures Task 8 names.

- [ ] **Step 1: Write the `gh` stub**

`test/family/gh-stub.mjs`:

```js
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
```

- [ ] **Step 2: Write the failing test**

`test/family/member.test.mjs`:

```js
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
    PATH: `${dirs.bin}:${process.env.PATH}`, GH_STUB_DIR: dirs.stub, GIT_CONFIG_GLOBAL: gitconfig, GIT_CONFIG_NOSYSTEM: '1',
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
```

- [ ] **Step 3: Run it to see it fail**

Run: `node --test test/family/member.test.mjs`

Expected: FAIL, `Cannot find module …/family/member.mjs`.

- [ ] **Step 4: Write `family/member.mjs`**

```js
// One member carried through a resync: a clone from the remote, a worktree on the day's branch,
// each pin moved and the member rebuilt as its pins.json says, a pull request merged once its
// check passes, and a release where the run needs one. Anything that needs a person's judgment
// throws Blocked, and the run holds what is downstream.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { gh } from './gh.mjs';
import { KINDS } from './pins.mjs';
import { commitMessage, listed } from './words.mjs';

export class Blocked extends Error {}

const CHECK_LINE = /(robertblust\/conventions\/\.github\/workflows\/check\.yml@)[^\s'"]+/g;

export function realMember({
  root = process.env.FAMILY_ROOT || join(homedir(), 'git'),
  remote = process.env.FAMILY_REMOTE || 'https://github.com',
  dryRun = false,
  log = console.log,
  checkWait = 10,
  checkTries = 30,
} = {}) {
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const sh = (cwd, cmd) => {
    try {
      execFileSync('sh', ['-c', cmd], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
    } catch (e) {
      const tail = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim().split('\n').slice(-5).join('\n');
      throw new Blocked(`\`${cmd}\` failed${tail ? `:\n${tail}` : ''}`);
    }
  };

  function clone(repo) {
    const dir = join(root, repo);
    if (!existsSync(dir)) {
      mkdirSync(dirname(dir), { recursive: true });
      git(root, 'clone', '-q', `${remote}/${repo}.git`, dir);
    }
    git(dir, 'fetch', '-q', 'origin');
    const branch = git(dir, 'rev-parse', '--abbrev-ref', 'HEAD');
    if (branch !== 'main') return { dir, note: `the clone was left alone on ${branch}` };
    if (git(dir, 'status', '--porcelain') !== '') return { dir, note: 'the clone was left alone with uncommitted changes' };
    try {
      git(dir, 'merge', '-q', '--ff-only', 'origin/main');
      return { dir, note: null };
    } catch {
      return { dir, note: 'the clone could not fast-forward main' };
    }
  }

  function worktree(repo, dir, branch) {
    const wt = join(root, `${repo}-${branch}`);
    if (existsSync(wt)) return wt;
    const onRemote = git(dir, 'ls-remote', '--heads', 'origin', branch) !== '';
    git(dir, 'worktree', 'add', '-q', '-B', branch, wt, onRemote ? `origin/${branch}` : 'origin/main');
    return wt;
  }

  function identity(wt) {
    try {
      if (git(wt, 'config', 'user.email')) return;
    } catch {
      // git config exits 1 when the key is unset
    }
    throw new Blocked('no user.email in this clone, so nothing is committed under an address nobody chose');
  }

  const existingPr = (repo, branch) => JSON.parse(gh(['pr', 'list', '--repo', repo, '--head', branch, '--state', 'all', '--json', 'number,state,url,mergeCommit']))[0] ?? null;

  function waitForChecks(repo, number) {
    for (let i = 0; ; i++) {
      try {
        gh(['pr', 'checks', String(number), '--repo', repo, '--watch', '--required']);
        return;
      } catch (e) {
        if (/no (required )?checks reported/i.test(e.message) && i < checkTries) {
          execFileSync('sleep', [String(checkWait)]);
          continue;
        }
        throw new Blocked(`the required check did not pass on pull request #${number} of ${repo}`);
      }
    }
  }

  function merge(repo, pr) {
    if (pr.state === 'MERGED') return { pr: pr.url, merge: pr.mergeCommit.oid };
    for (let i = 0; i < 3; i++) {
      waitForChecks(repo, pr.number);
      const { mergeStateStatus } = JSON.parse(gh(['pr', 'view', String(pr.number), '--repo', repo, '--json', 'mergeStateStatus']));
      if (mergeStateStatus === 'BEHIND') {
        gh(['pr', 'update-branch', String(pr.number), '--repo', repo]);
        continue;
      }
      gh(['pr', 'merge', String(pr.number), '--repo', repo, '--merge']);
      const done = JSON.parse(gh(['pr', 'view', String(pr.number), '--repo', repo, '--json', 'url,mergeCommit']));
      return { pr: done.url, merge: done.mergeCommit.oid };
    }
    throw new Blocked(`pull request #${pr.number} of ${repo} stayed behind main`);
  }

  function land(repo, dir, wt, branch, message) {
    git(wt, 'add', '-A');
    if (git(wt, 'diff', '--cached', '--name-only') !== '') git(wt, 'commit', '-q', '-m', message.full);
    else if (git(wt, 'rev-list', '--count', 'origin/main..HEAD') === '0') throw new Blocked('the move changed nothing');
    if (dryRun) {
      log(`dry run: ${repo}: committed in ${wt}; would push ${branch}, open “${message.subject}”, wait for its check and merge it`);
      return { pr: null, merge: null };
    }
    git(wt, 'push', '-q', '-u', 'origin', branch);
    let pr = existingPr(repo, branch);
    if (!pr) {
      gh(['pr', 'create', '--repo', repo, '--head', branch, '--base', 'main', '--title', message.subject, '--body', message.body]);
      pr = existingPr(repo, branch);
    }
    const landed = merge(repo, pr);
    git(dir, 'worktree', 'remove', '--force', wt);
    git(dir, 'branch', '-D', branch);
    try {
      git(dir, 'push', '-q', 'origin', '--delete', branch);
    } catch {
      // the repository may delete a merged branch by itself
    }
    return landed;
  }

  function move(wt, p, ran) {
    const kind = KINDS[p.kind];
    if (p.entry.move) {
      const cmd = p.entry.move.replaceAll('{version}', p.available);
      sh(wt, cmd);
      ran.push(cmd);
    } else {
      const path = join(wt, p.file);
      writeFileSync(path, kind.write(readFileSync(path, 'utf8'), p.upstream, p.available));
      if (p.kind === 'conventions') rewriteWorkflows(wt, p.available);
      for (const cmd of kind.commands) { sh(wt, cmd); ran.push(cmd); }
    }
    for (const cmd of p.entry.after ?? []) { sh(wt, cmd); ran.push(cmd); }
  }

  function rewriteWorkflows(wt, tag) {
    const dir = join(wt, '.github/workflows');
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
      const path = join(dir, f);
      const text = readFileSync(path, 'utf8');
      const next = text.replace(CHECK_LINE, `$1${tag}`);
      if (next !== text) writeFileSync(path, next);
    }
  }

  return {
    update(repo, pins, { date, verify = [] }) {
      const { dir, note } = clone(repo);
      const branch = `resync-${date}`;
      const prior = dryRun ? null : existingPr(repo, branch);
      if (prior?.state === 'MERGED') return { pr: prior.url, merge: prior.mergeCommit.oid, note };
      const wt = worktree(repo, dir, branch);
      identity(wt);
      const ran = [];
      if (git(wt, 'rev-list', '--count', 'origin/main..HEAD') === '0') {
        for (const p of pins) move(wt, p, ran);
        for (const cmd of verify) { sh(wt, cmd); ran.push(cmd); }
      }
      return { ...land(repo, dir, wt, branch, commitMessage(pins, ran)), note };
    },

    release(repo, tag, notes, commands, { date }) {
      if (!dryRun) {
        try {
          gh(['release', 'view', tag, '--repo', repo]);
          return { tag };
        } catch {
          // not released yet
        }
      }
      const version = tag.replace(/^v/, '');
      if (commands.length) {
        const { dir } = clone(repo);
        const branch = `resync-${date}-release`;
        const prior = dryRun ? null : existingPr(repo, branch);
        if (prior?.state !== 'MERGED') {
          const wt = worktree(repo, dir, branch);
          identity(wt);
          const ran = [];
          if (git(wt, 'rev-list', '--count', 'origin/main..HEAD') === '0') {
            for (const c of commands) { const cmd = c.replaceAll('{version}', version); sh(wt, cmd); ran.push(cmd); }
          }
          const subject = `The version reads ${version}`;
          const body = `The family resync releases ${tag} so that the repositories taking this one can re-pin it.\n\nVerified: ${ran.length ? `${listed(ran.map((c) => `\`${c}\``))} passed` : 'the bump was already committed'}.`;
          land(repo, dir, wt, branch, { subject, body, full: `${subject}\n\n${body}\n` });
        }
      }
      if (dryRun) {
        log(`dry run: ${repo}: would release ${tag}`);
        return { tag: null };
      }
      const target = JSON.parse(gh(['api', `repos/${repo}/commits/main`])).sha;
      gh(['release', 'create', tag, '--repo', repo, '--target', target, '--title', tag, '--notes', notes]);
      return { tag };
    },
  };
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `node --test test/family/member.test.mjs && sh test/run.sh | tail -1`

Expected: 8 tests pass, then `all pass`. If the dry-run test fails because `calls.log` exists, a GitHub call slipped past `dryRun`; find it in the log and guard it.

- [ ] **Step 6: Commit**

```bash
git add family test && git commit -qm "The family resync carries a member through git and GitHub

A member is cloned where it is missing, moved in a worktree on the day's branch,
rebuilt and verified as its pins.json says, and merged once its required check
passes; a release bumps through its own pull request and tags main. A second run the
same day finds what the first left, and anything that needs a person blocks the
member. The tests run against real repositories with a gh that records its calls.

Verified: node --test test/family and sh test/run.sh pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: `family/resync.mjs` and the run record

**Files:**

- Create: `family/resync.mjs`, `test/family/resync.test.mjs`
- Modify: `family/render.mjs` (add `renderRecord`)

**Interfaces:**

- Consumes: `orchestrate` (Task 8), `realMember` (Task 9), `realGithub`, `today`, `HERE` (Tasks 5, 7).
- Produces: `parseArgs(argv: string[]) → { file, selection, dryRun } | null`; `renderRecord(record, date, dryRun) → string`.

- [ ] **Step 1: Write the failing test**

`test/family/resync.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../../family/resync.mjs';
import { renderRecord } from '../../family/render.mjs';

test('the choice is all or chain numbers, with an optional dry run', () => {
  assert.deepEqual(parseArgs(['r.json', 'all']), { file: 'r.json', selection: 'all', dryRun: false });
  assert.deepEqual(parseArgs(['r.json', '3', '5', '--dry-run']), { file: 'r.json', selection: [3, 5], dryRun: true });
  assert.equal(parseArgs(['r.json']), null);
  assert.equal(parseArgs(['r.json', 'x']), null);
  assert.equal(parseArgs(['r.json', '0']), null);
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/family/resync.test.mjs`

Expected: FAIL, `Cannot find module …/family/resync.mjs`.

- [ ] **Step 3: Add `renderRecord` to `family/render.mjs`**

Append:

```js
export function renderRecord(record, date, dryRun) {
  const lines = [`# Family resync run, ${longDate(date)}${dryRun ? ' (dry run)' : ''}`, ''];
  if (!record.length) return `${lines[0]}\n\nThe choice moved nothing.\n`;
  lines.push('| Member | Status | Pull request | Merge | Release | Note |', '| --- | --- | --- | --- | --- | --- |');
  for (const r of record) {
    lines.push(`| ${r.repo} | ${r.status} | ${r.pr ?? ''} | ${r.merge ? shortV(r.merge) : ''} | ${r.release ?? ''} | ${cell(r.reason ?? r.note ?? '')} |`);
  }
  return `${lines.join('\n')}\n`;
}
```

- [ ] **Step 4: Write `family/resync.mjs`**

```js
#!/usr/bin/env node
// `node family/resync.mjs <report.json> <all | chain numbers…> [--dry-run]` runs the chains the
// owner chose from the report and writes dist/resync-run-<date>.md. It exits 1 when a member was
// blocked, so an Action that runs it fails where a person is needed.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { orchestrate } from './orchestrate.mjs';
import { realMember } from './member.mjs';
import { realGithub } from './github.mjs';
import { renderRecord } from './render.mjs';
import { HERE, today } from './report.mjs';

export function parseArgs(argv) {
  const [file, ...rest] = argv;
  const dryRun = rest.includes('--dry-run');
  const picks = rest.filter((a) => a !== '--dry-run');
  if (!file || !picks.length) return null;
  if (picks.length === 1 && picks[0] === 'all') return { file, selection: 'all', dryRun };
  const selection = picks.map(Number);
  if (selection.some((n) => !Number.isInteger(n) || n < 1)) return null;
  return { file, selection, dryRun };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error('usage: node family/resync.mjs <report.json> <all | chain numbers…> [--dry-run]');
    process.exit(2);
  }
  const report = JSON.parse(readFileSync(args.file, 'utf8'));
  const date = today();
  if (report.date !== date) console.log(`the report is from ${report.date}; the run reads every member again before it moves it`);
  const record = orchestrate({ report, selection: args.selection, github: realGithub(), member: realMember({ dryRun: args.dryRun }), date, log: console.log });
  mkdirSync(join(HERE, 'dist'), { recursive: true });
  const out = join(HERE, 'dist', `resync-run-${date}.md`);
  writeFileSync(out, renderRecord(record, date, args.dryRun));
  console.log(out);
  process.exit(record.some((r) => r.status === 'blocked') ? 1 : 0);
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `node --test test/family/resync.test.mjs && sh test/run.sh | tail -1`

Expected: 3 tests pass, then `all pass`.

- [ ] **Step 6: Commit**

```bash
git add family test && git commit -qm "node family/resync.mjs runs a choice from the report

The script takes the report's JSON and all or chain numbers, runs them, writes the
run record to dist/, and exits 1 when a member was blocked so an Action fails where a
person is needed. --dry-run stops every member at its local commit.

Verified: node --test test/family and sh test/run.sh pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: The skills, `WORKING.md` and the README

**Files:**

- Create: `.claude/skills/family-report/SKILL.md`, `.claude/skills/family-resync/SKILL.md`
- Modify: `conventions/WORKING.md` (“Pull requests”), `README.md` (a section before “Tests”), `AGENTS.md` (this repository's own part, the paragraph on tests)

- [ ] **Step 1: Write `.claude/skills/family-report/SKILL.md`**

```markdown
---
name: family-report
description: Use when the owner asks which members of the family are behind on a pin, what a resync would move, whether the family is in step, or for the family report. Reads every member's pins from GitHub and writes dist/resync-<date>.md in this repository.
---

# Family report

Run `node family/report.mjs` from the root of this repository. It needs `gh` with read access to robertblust, guestgraph and companygraph, and it changes nothing but `dist/`.

Read the Markdown it names and reply in the reply register of `conventions/WRITING.md`: the counts first, then the blocked members with their reasons, then the chains by number, then what disagrees. Link the report. Say what a disagreement means for the reader — a pin the drawing does not show is a change to `conventions/REPOSITORIES.md`, and a member with unmanaged pins needs its `pins.json` as `conventions/PINS.md` describes — and do not fix either without being asked.
```

- [ ] **Step 2: Write `.claude/skills/family-resync/SKILL.md`**

```markdown
---
name: family-resync
description: Use when the owner asks to resync the family, to bring members up to the latest releases or commits of what they pin, or to run chains from the family report. Runs the report, asks which chains to run, then merges, tags and releases through the chosen chains.
---

# Family resync

1. Run the `family-report` skill and show the owner the chains, numbered as the report numbers them, with the blocked members beside them.
2. Ask the owner which chains to run: all, or a list of numbers. Offer a dry run the first time a chain is run. The choice is the owner's word for every merge, release and deploy the run needs, as `conventions/WORKING.md` says, so never run a chain the owner did not choose, and never widen a choice.
3. Run `node family/resync.mjs dist/resync-<date>.json <all | numbers…>`, adding `--dry-run` when chosen, in the background with the longest timeout, because every member waits for its required check.
4. Report the run record it writes: what merged and released, and each blocked or held member with its reason. A blocked member is a decision for the owner; propose what would unblock it and do nothing further on it without being asked.

Merge, tag and release only through the script, never by hand in the same session, so the run record stays the whole account of what the run did.
```

- [ ] **Step 3: Add the paragraph to `conventions/WORKING.md`**

In “Pull requests”, after the paragraph that begins “Merging is a decision the owner makes.”, add:

```markdown
A family resync is the one run that merges on its own. When the owner chooses chains from the family report, that choice is their word for every merge, release and deploy the run needs to carry those pins through, and the run asks nothing more. It stops wherever a person's judgment is needed by blocking the member — a failed step or suite, a check that does not pass, a clone without an address, or work on the default branch that no release describes — and holds everything downstream of it. It never releases work whose notes a person has not written, and it never releases conventions.
```

- [ ] **Step 4: Add the README section**

Before `## Tests`, add:

```markdown
## Keeping the family in step

`node family/report.mjs` reads every member's pins from GitHub — the members from the table in `conventions/REPOSITORIES.md`, and from each member's `main` its `pins.json` and the files a pin can sit in — and sets each against what its upstream offers: the latest release for a tag, the head of `main` for a commit. It writes `dist/resync-<date>.md` for a reader and `dist/resync-<date>.json` for the run, overwrites both when it runs again the same day, and changes nothing else. It needs `gh` with read access to the three organizations.

`node family/resync.mjs dist/resync-<date>.json all`, or chain numbers from the report in place of `all`, moves the chosen chains level by level: one pull request per member, merged once its required check passes, and a minor release wherever a later level takes the member by tag. It blocks a member rather than guess, holds what is downstream of it, and writes `dist/resync-run-<date>.md`; `--dry-run` stops each member at its local commit. `conventions/WORKING.md` says why the run may merge on its own. The `family-report` and `family-resync` skills in `.claude/skills/` are how an agent runs the two.

A member joins by adding `pins.json`, as `conventions/PINS.md` describes. Until it does, the report shows its pins as unmanaged and the run leaves it alone.
```

- [ ] **Step 5: Name `family/` in this repository's part of `AGENTS.md`**

In the paragraph that begins “The tests are `sh test/run.sh`”, after its first sentence, add: `It also runs the tests of `family/`, the family report and resync, on Node's own runner.`

- [ ] **Step 6: Run the checks**

Run: `sh test/run.sh > /tmp/t 2>&1; echo $?; tail -1 /tmp/t; sh conventions/conventions-check; sh conventions/conventions-format`

Expected: `0`, `all pass`, and both `✓` lines.

- [ ] **Step 7: Commit, push and open the pull request**

```bash
git add -A && git commit -qm "The family resync has skills and a rule that lets it merge

Two skills give an agent the report and the run, and the run's authority is written
where the rule it relaxes lives: a chain the owner chose is the owner's word for every
merge, release and deploy it needs, and the run stops by blocking a member wherever a
person is needed. The README says how a member joins.

Verified: sh test/run.sh, conventions-check and conventions-format pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push -qu origin family-resync
gh pr create --title "The family resync" --body "Implements docs/superpowers/specs/2026-09-28-family-resync-design.md: PINS.md vendored, node family/report.mjs and node family/resync.mjs with their tests, two skills, the WORKING.md paragraph that lets a chosen resync merge, and a README section. The report ran against GitHub; the run is tested against temporary repositories and has not moved a real member yet, which waits for the pins.json wave.

Verified: sh test/run.sh, conventions-check and conventions-format pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Expected: the URL of the pull request. The release of conventions and the `pins.json` wave follow the spec's rollout once the owner merges it.
