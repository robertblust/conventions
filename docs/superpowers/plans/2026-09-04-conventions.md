# Conventions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first, complete, local version of `robertblust/conventions`: the three shared files, the agent entry block, the sync script with its tests, and CI — readable end to end and ready for a first push once its content is approved.

**Architecture:** The repository mirrors the layout it vendors: the shared files live under `conventions/` in the source exactly as they will in every member, and the root `AGENTS.md` carries the fenced block members receive. One POSIX shell script, `conventions/conventions-sync`, copies files at a pinned release and rewrites the block; its `check` mode recomputes hashes and fails on drift. Tests are plain `sh`, offline, against a temporary member directory.

**Tech Stack:** POSIX `sh`, `curl`, `awk`, `sed`, `shasum`/`sha256sum`. No Node, no npm. GitHub Actions for CI, `shellcheck` on the runner.

**Spec:** `docs/superpowers/specs/2026-09-04-conventions-design.md` (this repository) and, for the content of `WRITING.md`, `robertblust/design`'s `docs/superpowers/specs/2026-09-03-writing-design.md`, section 3.

## Global Constraints

- Every Markdown file is written in the prose register it describes: paragraphs by default, a list only for parallel items, a table only for data, bold at most one sentence per section, headers only where a reader jumps to.
- American English throughout. No British form appears anywhere in the repository, not even as a counter-example; `test/spelling.sh` fails on the first one.
- en-US typography in English text: closed em-dash, “…” quotes, no serial comma, sentence case in headings.
- de-CH typography in German text: «…» quotes, spaced en-dash, ss never ß.
- `sh` only, `#!/bin/sh`, `set -eu`, no bashisms; `shellcheck` clean.
- Commit messages in the git register: a sentence for a subject, one to three short paragraphs, a closing `Verified:` line, then a `Co-Authored-By` trailer for the tool that co-authored the change. The shared files name no tool as the example; the commits do name the one that wrote them.
- The root points nowhere downstream: nothing under `conventions/` or in `AGENTS.md` names a rule, check, package or repository that lives in a member — no “core's R14”, no “design”, no site. `REPOSITORIES.md` is the one file that names members, because that is its job.
- Agent-agnostic: no vendor is named in `conventions/` or `AGENTS.md`. `CLAUDE.md` is the one vendor adapter and the only place vendor syntax appears.
- Nothing is pushed, and no other repository is touched, until the owner has read the content and said so.
- No closed-source project is named anywhere, including the spec.

---

### Task 1: License, layout and the spec's one stray name

**Files:**
- Create: `LICENSE`
- Create: `conventions/.keep` (removed again in Task 2; it only makes the folder exist)
- Modify: `docs/superpowers/specs/2026-09-04-conventions-design.md`

**Interfaces:**
- Produces: the `conventions/` folder every later task writes into; the Apache 2.0 license every file is under.

- [ ] **Step 1: Copy the license the family already uses**

```bash
cp /Users/rob/git/robertblust/design/LICENSE LICENSE
head -3 LICENSE
```
Expected: the first lines read `Apache License`, `Version 2.0, January 2004`.

- [ ] **Step 2: Remove the one product name from the spec**

In `docs/superpowers/specs/2026-09-04-conventions-design.md`, section 2, replace the sentence in *Out of scope* that names the closed-source product with:

```
An agent file from an earlier, closed-source context was inspiration for the shape of an
output-style section and a repository map, nothing more; no text is taken from it.
```

Confirm nothing else names it:

```bash
grep -rn -i "<the product name>" . --exclude-dir=.git; echo "exit $?"
```
Expected: no lines, `exit 1`.

- [ ] **Step 3: Make the vendored layout exist**

```bash
mkdir -p conventions test .github/workflows && touch conventions/.keep
```

- [ ] **Step 4: Commit**

```bash
git add LICENSE conventions/.keep docs/superpowers/specs/2026-09-04-conventions-design.md
git commit -F - <<'EOF'
Apache 2.0, the vendored layout, and one name out of the spec

The license is the family's, byte for byte. The conventions/ folder exists from the
first commit because the repository mirrors what it vendors: the shared files sit here
under the same path a member will hold them at, so the block in AGENTS.md reads
identically in the source and in every copy.

Verified: grep finds no closed-source name in the tree.
EOF
```

---

### Task 2: `WRITING.md`

**Files:**
- Create: `conventions/WRITING.md`
- Delete: `conventions/.keep`

**Interfaces:**
- Produces: the file `conventions/WRITING.md`, vendored byte for byte by Task 6's script. Its headings are referenced from `AGENTS.md` (Task 5) and `README.md` (Task 8) by name: *What every register shares*, *The prose register*, *The git register*, *The reply register*, *English*, *German*.

- [ ] **Step 1: Write the file**

Create `conventions/WRITING.md` with exactly this content:

````markdown
# Writing

One voice, three registers, two languages. The voice is the one the family's texts already
have when they are at their best: it says why before how, it claims what it can show, and it
would rather be read twice than skimmed once. The registers differ in length and shape, not in
voice. The languages differ in more than words, and the second half of this file is about
that.

## What every register shares

Spelling is American English, in names and in prose: organization, modeling, license, color,
behavior. Proper nouns, quoted matter and names fixed by something outside the family — a
product, a standard, a file the ecosystem reads by name — stay as they are. A tripwire in this
repository holds the rule for what it ships, and every repository that vendors this file is
expected to hold it the same way for its own text.

Cause before mechanism. A reader learns why a thing is the way it is before learning how it
works, because the why is what lets them decide whether the how still applies. A sentence that
states a mechanism with no cause is a sentence the next person will undo.

Claim only what is measured or verifiable. A number is quoted after it was counted, not
estimated; a behavior is described after it was observed, not inferred from the source. Where
something was not checked, the text says so.

No adjective that sells. Nothing here is powerful, seamless, robust or elegant. If it is any of
those, the sentence that shows it is better than the word.

Closed-source predecessor projects are never mentioned, in code, in documentation, in commits
or in conversation.

## The prose register

For pages, README files, agent files, specs and release notes.

Paragraphs by default. A list only for items that are genuinely parallel, and never a
paragraph wearing a bullet. A table only for data with more than one dimension, never for
sentences. Bold at most one sentence per section, and that sentence is the rule. Headers only
where a reader would jump to, never to segment a text that fits on a screen.

Sentence case in headings and titles; a proper noun keeps its capitals. The first sentence of
a section carries the point; the rest is its support.

Release notes are this register aimed at a consumer: what changed for them, what breaks, and
how to take it, in that order.

## The git register

For commit messages and pull request descriptions.

The subject is a sentence in plain words, under seventy characters where it can be, with no
type prefix and no trailing period. It says what is now true that was not before.

The body is one to three short paragraphs, cause before mechanism. No headers, no bullets. A
table only for counts. It ends with one line beginning `Verified:` that names what ran and
passed, then the trailers.

A pull request description is the commit body reread for a reviewer who has not seen the
diff, plus links to the sibling pull requests when there are any.

One real example from the family's history, with the closing line this register adds:

```
deck runtime v5: data-notes is English, data-notes-de is German

The base attribute meant a different language depending on which pair you were
reading. On a page, the element's own content is English and `data-de` carries
the translation. For notes alone it was inverted: `data-notes` held German and
English was the suffixed one. Same file, same author, opposite conventions.

Notes now follow the page. `data-notes` is English, `data-notes-de` is the
translation, and the rule this leaves is one line with nothing to remember: a
page is en-US, and the values of any -de attribute are de-CH.

Breaking for a deck: a page still carrying `data-notes-en` shows German in the
notes panel and speaks it in English, because `data-notes` would now be read as
the English it no longer holds. The decks rename in the same round.

Verified: npm test, 295 pass; both decks re-synced and their suites green.
```

## The reply register

For what an agent says in conversation, in a review comment and in a report.

Outcome first, then what was found, then what is next. Short sentences with a verb. A list
only for parallel items, one or two sentences each. No headers under a page of text. A review
finding is one finding, with its severity and the line it sits on, and it is an input to the
person who merges, never a verdict.

## English

en-US, and the marks that go with it. A closed em-dash—like this—between clauses. Curly
quotes, “outside” and ‘inside’. No serial comma: vision, strategy and processes. Dates read
May 4, 2012, and months abbreviate to three letters without a period, Oct 2012. A range takes
a closed en-dash, May 2012–Oct 2016. Numbers group by comma, 16,000.

## German

de-CH, which is not the German of Germany. The reader is Sie, never du, except in a letter
that matches its recipient. ss, never ß: Strasse, Massstab, grösser. Guillemets, «aussen» and
‹innen›. The Gedankenstrich is a spaced en-dash – like this – and never an em-dash. Dates read
4. Mai 2012; abbreviated months carry their period where German abbreviates them, Jan., Febr.,
März, Apr., Mai, Juni, Juli, Aug., Sept., Okt., Nov., Dez. A range takes the spaced en-dash,
Mai 2012 – Okt. 2016. Numbers group by the typographic apostrophe, 16’000, the character that
cannot end a single-quoted attribute.

German is written as German, not as English syntax with German words: shorter sentences where
German would otherwise stack clauses, the verb where German puts it, and a noun where English
reached for a gerund.

Where each language lives in a page is one rule, stated once, in the agent file of every
repository that carries both: a page is en-US, and the value of any attribute whose name ends
in `-de` is de-CH.

## The same paragraph, twice

English, in the prose register:

> The rule is one line long because the attributes were built to obey it: a page's own text
> is English, and the translation is what an attribute carries—not the other way round.
> Anything that rewrites text in bulk masks those attributes first; otherwise correct German
> becomes wrong German and nothing here notices, because every check reads the rendered page,
> and the rendered page is only ever one language.

Deutsch, im selben Register:

> Die Regel ist eine Zeile lang, weil die Attribute so gebaut wurden, dass sie ihr folgen: Der
> eigene Text einer Seite ist Englisch, die Übersetzung steht im Attribut – nicht umgekehrt.
> Wer Text in grosser Menge umschreibt, maskiert zuerst diese Attribute. Sonst wird aus
> richtigem Deutsch falsches, und keine Prüfung bemerkt es, denn jede Prüfung liest die
> gerenderte Seite, und die ist immer nur in einer Sprache.
````

- [ ] **Step 2: Check it against the constraints by eye**

Read it once for: no British form (the words to look for are the ones `test/spelling.sh` will list in Task 7), no serial comma in English sentences, closed em-dashes in English, spaced en-dashes and guillemets in the German paragraph, no ß anywhere.

```bash
grep -n "ß" conventions/WRITING.md; grep -n -E ", and [a-z]+\.$" conventions/WRITING.md; echo "exit codes above should be 1"
```
Expected: no matching lines from either grep.

- [ ] **Step 3: Commit**

```bash
git rm -q conventions/.keep
git add conventions/WRITING.md
git commit -F - <<'EOF'
WRITING.md: one voice, three registers, two languages

The voice is the one the family's texts already have at their best; this file describes
it rather than inventing one. The prose and git registers are the decisions of
2026-09-03, the reply register is the family's own. English is en-US with its marks,
German is de-CH with guillemets and the spaced en-dash, and the file closes with the
same paragraph in both, because an example ends more arguments than a rule.

Verified: no ß and no serial comma in the file; the spelling tripwire of Task 7 will
hold the rest.
EOF
```

---

### Task 3: `WORKING.md`

**Files:**
- Create: `conventions/WORKING.md`

**Interfaces:**
- Produces: `conventions/WORKING.md`, vendored by Task 6. Section names referenced from `AGENTS.md`: *Branches and commits*, *Pull requests*, *Identity*, *Releases and pins*, *Checks*, *Reviews*.

- [ ] **Step 1: Write the file**

Create `conventions/WORKING.md` with exactly this content:

````markdown
# Working

How the family acts with git and GitHub. Every rule here was copied by hand between five
repositories before it lived here, and each carries the reason it exists, because a rule
without its reason is the first thing a fresh clone drops.

## Branches and commits

One branch per change, named for what it does, branched from the default branch. Nothing is
committed on the default branch directly; it is protected in every repository that has a
suite, and a ruleset that forbids a push is the only kind that survives a hurried afternoon.

An agent commits when the owner asks, and not on its own initiative. It proposes the message
in the git register of `WRITING.md`. The author of the commit is the person; no tool is named
as an author or a co-author, in a trailer or anywhere else. “Commit and open the pull request”
is a request to do exactly that; it is not approval to merge.

## Pull requests

Every change reaches the default branch through a pull request with one green status check.
The description is the commit body reread for a reviewer who has not seen the diff.

**A pull request is merged with a merge commit, `gh pr merge --merge`, never squashed.**
GitHub re-authors a squash commit to the account that pressed the button, so a commit made
locally under the wrong identity lands on the default branch looking correct. That is not
hypothetical: it was found in the family's own history, where a commit authored under an
unrelated address reached `main` reading as the owner's. A merge commit preserves the author
it was given, which is the point — a wrong identity surfaces instead of being laundered.

Merging is a decision the owner makes. An agent opens the pull request, reports the check, and
stops; it merges when told to, and the word for that is the owner's, not inferred from an
earlier one.

## Identity

The author of every commit in the three organizations is `robert.blust@flatland.ch`, and
nothing on GitHub enforces it: the ruleset rule that would, an author-email pattern, is not
available on the plan. So the identity comes from `~/.gitconfig`, where `includeIf` blocks key
it to the directories `~/git/robertblust/`, `~/git/guestgraph/` and `~/git/companygraph/`. A
clone made anywhere else takes the global default and no warning. Before the first commit in
a fresh clone, run `git config user.email` and read the answer.

## Releases and pins

A release is a tag and a GitHub Release with notes in the prose register: what changed for the
consumer, what breaks, how to take it. There is no publish step anywhere in the family.

Everything one repository takes from another is pinned by a visible line, whatever form the
member's tooling gives it — a tag in a package file, a commit in a source file, a release in a
vendoring manifest, the tag in `conventions.json` for these files. Pins are editorial. They move
when the owner decides they move, in a commit that says why, and no bot proposes them; a pin
that is behind is intent until the owner says it is drift.

A change to any file another repository vendors is at least a minor release, because it makes
every copy stale. A change that needs a member to do anything beyond re-syncing is a major.
The notes say which.

## Checks

Verification is running the suite, not reading the diff. Nothing is called done, fixed or
passing until the command that proves it has run and its output has been read; a pipe into
`tail` hides an exit code, so the exit code is checked on its own.

A branch ruleset requires a status check by its job id, not by the workflow's name. Renaming
the job leaves the ruleset requiring a name that will never report again: the branch looks
protected and is not. Each repository names its required job id in its own agent file; rename
one only together with its ruleset.

CI never writes what the repository commits. Rendered cards, exported PDFs and generated
pages are built locally and committed; CI checks that the committed copy matches what would
be built.

## Reviews

A review finding is an input to the person who merges, never a verdict. One finding per
comment, with a severity and the line it sits on. Silence is a valid answer to a finding.

## What is never written

Closed-source predecessor projects are not mentioned — in code, documentation, commits,
pull requests, issues or release notes. Secrets are never printed, not to check them and not
in a debug line; a value that reaches a transcript has to be rotated.
````

- [ ] **Step 2: Sanity checks**

```bash
grep -n "ß" conventions/WORKING.md; grep -n -i -E "organis|licence|behaviour|colour|centre|recognis" conventions/WORKING.md; echo "both greps should print nothing"
```

- [ ] **Step 3: Commit**

```bash
git add conventions/WORKING.md
git commit -F - <<'EOF'
WORKING.md: how the family acts with git and GitHub

Every rule here was copied by hand between five agent files before it lived here — the
merge commit and its re-authoring reason, the identity keyed to a directory, the job id a
ruleset requires, pins as visible editorial lines. Each keeps the reason it exists,
because a rule without its reason is the first thing a fresh clone drops. Nothing here
names a member: the root points nowhere downstream.

Verified: the greps for ß and the British stems print nothing.
EOF
```

---

### Task 4: `REPOSITORIES.md`

**Files:**
- Create: `conventions/REPOSITORIES.md`

**Interfaces:**
- Produces: `conventions/REPOSITORIES.md`, vendored by Task 6. Its member list is the order Task 8's README tells a releaser to re-sync in.

- [ ] **Step 1: Write the file**

Create `conventions/REPOSITORIES.md` with exactly this content:

````markdown
# Repositories

Three organizations, one family. `robertblust` holds the person and the shared machinery,
`guestgraph` the guest identity graph, `companygraph` the meta-model for operating a company.
Every repository below vendors this repository's `conventions/` at a pinned release and opens
its `AGENTS.md` with the same block; `CLAUDE.md` is the one line `@AGENTS.md` everywhere.

| Repository | Purpose | Default branch | Local path |
|---|---|---|---|
| robertblust/conventions | how the family writes and works, vendored by every member | main | ~/git/robertblust/conventions |
| robertblust/design | the design system shared by the three sites: tokens, chrome, page checks | main | ~/git/robertblust/design |
| robertblust/robertblust.github.io | blust.ch, the profile page and two talks | main | ~/git/robertblust/robertblust.github.io |
| robertblust/mental-model | Robert Blust described in CompanyGraph, the reference instance | main | ~/git/robertblust/mental-model |
| robertblust/field-notes | problems that took real work to understand, one file each | main | ~/git/robertblust/field-notes |
| guestgraph/guestgraph.github.io | guestgraph.io, the landing page and the intro talk | main | ~/git/guestgraph/guestgraph.github.io |
| guestgraph/engine | identity resolution, guest graph and REST API, the open core | main | ~/git/guestgraph/engine |
| guestgraph/.github | the organization profile GitHub shows, and nothing else | main | ~/git/guestgraph/.github |
| companygraph/companygraph.github.io | companygraph.io, the landing page, the model and example pages, the intro talk | main | ~/git/companygraph/companygraph.github.io |
| companygraph/meta-model | the meta-model: core vocabulary, packs and the conventions that make a graph of Markdown checkable | main | ~/git/companygraph/meta-model |
| companygraph/.github | the organization profile GitHub shows, and nothing else | main | ~/git/companygraph/.github |

## What pins what

The three sites pin `robertblust/design` by tag in `package.json`, and `npm run design`
writes the fenced copies. blust.ch pins `robertblust/mental-model` and companygraph.io pins
`companygraph/meta-model` by commit in `source.json`, and each builds its model pages from
that commit. blust.ch also depends on `companygraph/meta-model` by tag for the instance
parser. mental-model vendors meta-model's `core/` at a release named in its own manifest.
Every member pins this repository by tag in `conventions.json`.

A pin is an editorial line, moved on purpose. Which release each member is on is read from
the pin, never from this file, so this file does not repeat versions.

## Re-syncing after a release

In this order, one pull request each: design, then the three sites, then mental-model and
meta-model, then the engine, then field-notes, then the two `.github` repositories. Design
first because a site's suite runs design's checks; the models before the engine because the
sites' model pages are built from them. Nothing here opens those pull requests for you.
````

- [ ] **Step 2: Check the facts against the working tree**

```bash
for r in robertblust/design robertblust/robertblust.github.io robertblust/mental-model robertblust/field-notes guestgraph/guestgraph.github.io guestgraph/engine guestgraph/.github companygraph/companygraph.github.io companygraph/meta-model companygraph/.github; do [ -d ~/git/$r/.git ] && echo "ok $r" || echo "MISSING $r"; done
```
Expected: ten `ok` lines.

- [ ] **Step 3: Commit**

```bash
git add conventions/REPOSITORIES.md
git commit -F - <<'EOF'
REPOSITORIES.md: the family, and what pins what

Eleven repositories in three organizations, each with its purpose, default branch and
local path, and one paragraph on the pins between them. Versions are not repeated here
because the pin is the source and a copy of it would be the first thing to go stale.

Verified: all ten member paths exist under ~/git.
EOF
```

---

### Task 5: `AGENTS.md` and `CLAUDE.md`

**Files:**
- Create: `AGENTS.md`
- Create: `CLAUDE.md`

**Interfaces:**
- Produces: the fenced block between `<!-- conventions · v1.0.0 -->` and `<!-- end conventions -->` that Task 6's `block_of` extracts from root `AGENTS.md` and writes into every member. The markers are exact strings; the middle dot is U+00B7.

- [ ] **Step 1: Write `AGENTS.md`**

```markdown
<!-- conventions · v1.0.0 -->
Shared conventions of the robertblust, guestgraph and companygraph organizations live in
`conventions/`, vendored from robertblust/conventions at the release `conventions.json`
names. Read them before writing or committing anything here.

- `conventions/WRITING.md` — how we write: one voice, three registers, English and German.
- `conventions/WORKING.md` — how we work with git and GitHub.
- `conventions/REPOSITORIES.md` — the family: what each repository is and what pins what.

Everything below this block is this repository's own. `sh conventions/conventions-sync check`
says whether the copy matches the release; `sync` brings it to the release the pin names.
Edit a shared file in robertblust/conventions, never here.
<!-- end conventions -->

# robertblust/conventions — working conventions

This repository is the source of the block above. It mirrors the layout it vendors: the
shared files live under `conventions/` here exactly as they do in every member, so the block
reads the same in both. The block is plain words and names no agent vendor; `CLAUDE.md` is the
one vendor adapter, four lines that import the entry file and the three shared files in that
vendor's syntax, and a member carries the same four lines. The one file members receive that
does not sit under `conventions/` in the source is this `AGENTS.md`, which the script fetches
from the root and vendors as `conventions/AGENTS.md` so that `check` can compare a member's
block against the release without a network.

Releasing is a tag and a GitHub Release with notes. Before tagging, set the version in the
first line of this file to the new tag: the script rewrites it to the pin on sync, so a stale
number here misleads only a reader of the source, but that reader is the one deciding whether
to release.

The tests are `sh test/run.sh` and `sh test/spelling.sh`. The first runs the script against a
temporary member with this checkout as the source; the second fails on any British spelling in
a Markdown file, this one included and only `docs/superpowers/` excepted.
```

- [ ] **Step 2: Write `CLAUDE.md`, the vendor adapter**

```bash
printf '@AGENTS.md\n@conventions/WRITING.md\n@conventions/WORKING.md\n@conventions/REPOSITORIES.md\n' > CLAUDE.md
```

- [ ] **Step 3: Confirm the markers, and that the adapter's paths exist here**

```bash
grep -n -E "^<!-- conventions · v1\.0\.0 -->$|^<!-- end conventions -->$" AGENTS.md
for f in conventions/WRITING.md conventions/WORKING.md conventions/REPOSITORIES.md; do [ -f $f ] && echo "ok $f"; done
```
Expected: the two marker lines with their numbers, then three `ok`.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md CLAUDE.md
git commit -F - <<'EOF'
AGENTS.md is the block every member opens with, and CLAUDE.md is the one vendor adapter

The block names the three vendored files and tells any agent, in plain words, to read
them first. It names no vendor and reads the same here and in a member because the
source mirrors the vendored layout. CLAUDE.md is four import lines in one vendor's
syntax, the only place such syntax appears. The rest of AGENTS.md is this repository's
own: what the layout is for, how to release, how to test.

Verified: both markers present; the adapter's four paths exist in this checkout.
EOF
```

---

### Task 6: The sync script, test-first

**Files:**
- Create: `test/run.sh`
- Create: `conventions/conventions-sync`

**Interfaces:**
- Consumes: root `AGENTS.md` with the markers from Task 5; `conventions/WRITING.md`, `WORKING.md`, `REPOSITORIES.md` from Tasks 2–4.
- Produces: `sh conventions/conventions-sync sync|check`, run from a member's root. Reads `conventions.json` `{"repo": "...", "tag": "..."}`. Honors `CONVENTIONS_SOURCE` as either an `http(s)://` base or a local directory, overriding `https://raw.githubusercontent.com/<repo>/<tag>`. Writes `conventions/{WRITING.md,WORKING.md,REPOSITORIES.md,AGENTS.md,conventions-sync,manifest.json}` and the block in `AGENTS.md`. `check` exits 0 when everything matches, 1 otherwise, and prints one `✗` line per difference.

- [ ] **Step 1: Write the failing test**

Create `test/run.sh`:

```sh
#!/bin/sh
# Runs the sync script against a temporary member, with this checkout as the source, so the
# test needs no network and no tag. Every assertion prints one line; the run fails if any
# assertion failed.
set -eu
HERE=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
MEMBER=$TMP/member
mkdir -p "$MEMBER"
fails=0
ok()  { echo "✓ $1"; }
bad() { echo "✗ $1"; fails=$((fails + 1)); }
run() { (cd "$MEMBER" && CONVENTIONS_SOURCE="$HERE" sh "$HERE/conventions/conventions-sync" "$@"); }

printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0" }\n' > "$MEMBER/conventions.json"
printf '# member — working conventions\n\nIts own text.\n' > "$MEMBER/AGENTS.md"

# sync vendors the files and writes the block
run sync > /dev/null
for f in WRITING.md WORKING.md REPOSITORIES.md AGENTS.md conventions-sync manifest.json; do
  [ -f "$MEMBER/conventions/$f" ] || bad "sync did not write conventions/$f"
done
if grep -q '^<!-- conventions · v1.0.0 -->$' "$MEMBER/AGENTS.md" && grep -q '^<!-- end conventions -->$' "$MEMBER/AGENTS.md"
then ok "sync writes the block with the pinned tag"; else bad "block missing or unversioned"; fi
if head -1 "$MEMBER/AGENTS.md" | grep -q '^<!-- conventions'; then ok "the block is the first line"; else bad "the block is not first"; fi
if grep -q '^Its own text\.$' "$MEMBER/AGENTS.md"; then ok "the member's own text survives"; else bad "the member's own text was lost"; fi
if cmp -s "$MEMBER/conventions/WRITING.md" "$HERE/conventions/WRITING.md"; then ok "a vendored file is byte-identical"; else bad "a vendored file differs from the source"; fi
if [ -x "$MEMBER/conventions/conventions-sync" ]; then ok "the vendored script is executable"; else bad "the vendored script is not executable"; fi
if grep -q '"tag": "v1.0.0"' "$MEMBER/conventions/manifest.json" && grep -q '"conventions/WORKING.md": "sha256:' "$MEMBER/conventions/manifest.json"
then ok "the manifest records the tag and a hash per file"; else bad "the manifest is incomplete"; fi

# check passes on a fresh sync
if run check > /dev/null; then ok "check passes after sync"; else bad "check fails after sync"; fi

# a second sync changes nothing
cp "$MEMBER/AGENTS.md" "$TMP/agents.before"
run sync > /dev/null
if cmp -s "$MEMBER/AGENTS.md" "$TMP/agents.before"; then ok "a second sync leaves AGENTS.md unchanged"; else bad "a second sync rewrote AGENTS.md"; fi

# an edited vendored file is named
echo "edited here" >> "$MEMBER/conventions/WORKING.md"
out=$(run check 2>&1 || true)
if echo "$out" | grep -q 'conventions/WORKING.md differs'; then ok "check names an edited vendored file"; else bad "check missed an edited file: $out"; fi
run sync > /dev/null

# an edited block is caught, and sync repairs it
sed -i.bak 's/^- .conventions\/WRITING.md.*$/- gone/' "$MEMBER/AGENTS.md" && rm -f "$MEMBER/AGENTS.md.bak"
out=$(run check 2>&1 || true)
if echo "$out" | grep -q 'block in AGENTS.md'; then ok "check catches an edited block"; else bad "check missed an edited block: $out"; fi
run sync > /dev/null
if run check > /dev/null; then ok "sync repairs the block"; else bad "sync did not repair the block"; fi

# a member with no AGENTS.md gets one
rm "$MEMBER/AGENTS.md"
run sync > /dev/null
if [ -f "$MEMBER/AGENTS.md" ] && run check > /dev/null; then ok "sync creates AGENTS.md when there is none"; else bad "sync did not create AGENTS.md"; fi

# a moved pin is reported until sync runs
sed -i.bak 's/v1\.0\.0/v9.9.9/' "$MEMBER/conventions.json" && rm -f "$MEMBER/conventions.json.bak"
out=$(run check 2>&1 || true)
if echo "$out" | grep -q 'names v9.9.9'; then ok "check reports a pin the copy does not match"; else bad "check missed a moved pin: $out"; fi

# no pin is an error, not a default
rm "$MEMBER/conventions.json"
out=$(run check 2>&1 || true)
if echo "$out" | grep -q 'no conventions.json'; then ok "a member without a pin is an error"; else bad "a missing pin was not reported: $out"; fi

# a wrong command prints usage
out=$(run frobnicate 2>&1 || true)
if echo "$out" | grep -q '^usage:'; then ok "an unknown command prints usage"; else bad "no usage on an unknown command: $out"; fi

if [ "$fails" -eq 0 ]; then echo "all pass"; else echo "$fails failing"; exit 1; fi
```

- [ ] **Step 2: Run it and watch it fail for the right reason**

```bash
sh test/run.sh; echo "exit $?"
```
Expected: `sh: .../conventions/conventions-sync: No such file or directory` and a non-zero exit. Nothing else exists yet.

- [ ] **Step 3: Write the script**

Create `conventions/conventions-sync`:

```sh
#!/bin/sh
# conventions-sync — vendor the family's shared conventions at a pinned release, and say
# whether the copy still matches it.
#
#   sh conventions/conventions-sync sync    write conventions/ and the AGENTS.md block from the pin
#   sh conventions/conventions-sync check   exit 1 with one ✗ line per thing that differs
#
# The pin is conventions.json in the member's root: {"repo": "robertblust/conventions", "tag": "v1.0.0"}.
# Files come from https://raw.githubusercontent.com/<repo>/<tag>; CONVENTIONS_SOURCE overrides
# that with another base URL or a local directory, which is how the tests run offline.
# Needs sh, curl, awk, sed, and shasum or sha256sum. Nothing else.
set -eu

usage() { echo "usage: sh conventions/conventions-sync sync|check" >&2; exit 2; }
[ $# -eq 1 ] || usage
cmd=$1
case $cmd in sync|check) ;; *) usage ;; esac

PIN=conventions.json
DIR=conventions
FILES="WRITING.md WORKING.md REPOSITORIES.md AGENTS.md conventions-sync"
OPEN_RE='^<!-- conventions · v[^ ]* -->$'
CLOSE='<!-- end conventions -->'

[ -f "$PIN" ] || { echo "✗ conventions: no $PIN here — a member names the release it follows" >&2; exit 1; }
pin() { sed -n "s/.*\"$1\" *: *\"\([^\"]*\)\".*/\1/p" "$PIN" | head -1; }
REPO=$(pin repo)
TAG=$(pin tag)
[ -n "$REPO" ] && [ -n "$TAG" ] || { echo "✗ conventions: $PIN needs \"repo\" and \"tag\"" >&2; exit 1; }
SOURCE=${CONVENTIONS_SOURCE:-https://raw.githubusercontent.com/$REPO/$TAG}

sha() {
  if command -v sha256sum > /dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# fetch <path in source> <destination>
fetch() {
  case "$SOURCE" in
    http://*|https://*) curl -fsSL "$SOURCE/$1" -o "$2" || { echo "✗ conventions: could not fetch $SOURCE/$1" >&2; exit 1; } ;;
    *) cp "$SOURCE/$1" "$2" ;;
  esac
}

# block_of <file>: the fenced block, markers included, with its version rewritten to the pin.
# Comparing two blocks through this makes the version line irrelevant, which is what lets
# the source carry whatever release number it was last tagged at.
block_of() {
  awk -v tag="$TAG" -v open_re="$OPEN_RE" -v endm="$CLOSE" '
    !inblock && $0 ~ open_re { inblock = 1; print "<!-- conventions · " tag " -->"; next }
    inblock && $0 == endm  { print; exit }
    inblock                 { print }' "$1"
}

# write_block: replace the block in AGENTS.md, or put one at the top of a file that has none.
write_block() {
  new=$(block_of "$DIR/AGENTS.md")
  [ -n "$new" ] || { echo "✗ conventions: $DIR/AGENTS.md carries no conventions block" >&2; exit 1; }
  if [ -f AGENTS.md ] && grep -q "$OPEN_RE" AGENTS.md; then
    # Line numbers rather than an awk variable: a multi-line -v value is rejected by the awk
    # macOS ships, and the block is many lines.
    start=$(grep -n "$OPEN_RE" AGENTS.md | head -1 | cut -d: -f1)
    end=$(awk -v s="$start" -v endm="$CLOSE" 'NR > s && $0 == endm { print NR; exit }' AGENTS.md)
    [ -n "$end" ] || { echo "✗ conventions: AGENTS.md opens a conventions block and never closes it" >&2; exit 1; }
    { [ "$start" -gt 1 ] && head -n "$((start - 1))" AGENTS.md; printf '%s\n' "$new"; tail -n "+$((end + 1))" AGENTS.md; } > AGENTS.md.tmp
  else
    { printf '%s\n\n' "$new"; if [ -f AGENTS.md ]; then cat AGENTS.md; fi; } > AGENTS.md.tmp
  fi
  mv AGENTS.md.tmp AGENTS.md
}

sync() {
  mkdir -p "$DIR"
  for f in $FILES; do
    case $f in
      AGENTS.md) fetch "AGENTS.md" "$DIR/$f.new" ;;
      *)         fetch "$DIR/$f"   "$DIR/$f.new" ;;
    esac
    mv "$DIR/$f.new" "$DIR/$f"
  done
  chmod +x "$DIR/conventions-sync"
  write_block
  {
    printf '{\n  "repo": "%s",\n  "tag": "%s",\n  "files": {\n' "$REPO" "$TAG"
    first=1
    for f in $FILES; do
      [ "$first" -eq 1 ] || printf ',\n'
      first=0
      printf '    "%s/%s": "sha256:%s"' "$DIR" "$f" "$(sha "$DIR/$f")"
    done
    printf '\n  }\n}\n'
  } > "$DIR/manifest.json"
  echo "✓ conventions: $DIR/ and the AGENTS.md block are at $REPO@$TAG"
}

check() {
  fail=0
  [ -f "$DIR/manifest.json" ] || { echo "✗ conventions: no $DIR/manifest.json — run sync" >&2; exit 1; }
  mtag=$(sed -n 's/.*"tag" *: *"\([^"]*\)".*/\1/p' "$DIR/manifest.json" | head -1)
  if [ "$mtag" != "$TAG" ]; then
    echo "✗ conventions: $PIN names $TAG, the copy is $mtag — run sync"; fail=1
  fi
  for f in $FILES; do
    want=$(sed -n "s|.*\"$DIR/$f\" *: *\"sha256:\([0-9a-f]*\)\".*|\1|p" "$DIR/manifest.json")
    if [ ! -f "$DIR/$f" ]; then
      echo "✗ conventions: $DIR/$f is missing — run sync"; fail=1
    elif [ "$(sha "$DIR/$f")" != "$want" ]; then
      echo "✗ conventions: $DIR/$f differs from $REPO@$TAG — edit it there, not here, or run sync"; fail=1
    fi
  done
  have=""
  [ -f AGENTS.md ] && have=$(block_of AGENTS.md)
  want=$(block_of "$DIR/AGENTS.md")
  if [ "$have" != "$want" ]; then
    echo "✗ conventions: the block in AGENTS.md is not the release's — run sync"; fail=1
  fi
  [ "$fail" -eq 0 ] && echo "✓ conventions: $DIR/ and the AGENTS.md block match $REPO@$TAG"
  exit "$fail"
}

case $cmd in
  sync)  sync ;;
  check) check ;;
  *)     usage ;;
esac
```

```bash
chmod +x conventions/conventions-sync
```

- [ ] **Step 4: Run the tests until they pass**

```bash
sh test/run.sh; echo "exit $?"
```
Expected: every line begins with `✓`, then `all pass`, `exit 0`. If a line begins with `✗`, the message names what differs; fix the script, not the test.

- [ ] **Step 5: Run the script against this checkout as if it were a member**

The source is its own member: it has the block and the files, and only lacks a pin. Prove `check` would pass here once it has one, then remove the pin again — the source pins nothing.

```bash
printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0" }\n' > conventions.json
CONVENTIONS_SOURCE=. sh conventions/conventions-sync sync
sh conventions/conventions-sync check; echo "exit $?"
git status --short
rm conventions.json conventions/AGENTS.md conventions/manifest.json
git checkout -- AGENTS.md 2>/dev/null || true
git status --short
```
Expected: `✓ conventions: conventions/ and the AGENTS.md block match robertblust/conventions@v1.0.0`, `exit 0`; the second `git status` shows nothing but the new script and test.

- [ ] **Step 6: shellcheck**

```bash
command -v shellcheck > /dev/null && shellcheck conventions/conventions-sync test/run.sh || echo "no shellcheck here; CI runs it"
```
Expected: no findings, or the note. If `brew install shellcheck` is quick, do it and fix what it says.

- [ ] **Step 7: Commit**

```bash
git add conventions/conventions-sync test/run.sh
git commit -F - <<'EOF'
The sync script, and the tests that drove it

A member names a release in conventions.json; sync copies the three files, this script
and the block's source at that release, records a hash per file, and rewrites the block
at the top of AGENTS.md. check recomputes every hash and the block and prints one ✗ line
per thing that differs, so the failure names the file rather than the mechanism. POSIX
sh throughout, because one member is a Maven project and reading a Markdown file must
not require Node.

CONVENTIONS_SOURCE points the script at a directory instead of the release URL, which is
how the tests run against this checkout with no network and no tag.

Verified: sh test/run.sh, all pass; shellcheck clean.
EOF
```

---

### Task 7: The spelling tripwire

**Files:**
- Create: `test/spelling.sh`

**Interfaces:**
- Produces: `sh test/spelling.sh`, exit 0 when no Markdown file in the repository contains a British form from its list, exit 1 listing `file:line: word` otherwise.

- [ ] **Step 1: Write a failing probe first**

```bash
printf '# probe\n\nThe colour of the licence.\n' > probe.md
```

- [ ] **Step 2: Write the test**

Create `test/spelling.sh`:

```sh
#!/bin/sh
# Every Markdown file here is American English, WRITING.md included — it may not quote a
# British form even to forbid it, because this is the list, and the list lives here. Stems
# rather than words, so derived forms are caught; a stem is only on the list when no
# American word contains it. docs/superpowers/ is the one place left out: a spec or a plan
# that specifies this very list has to quote it.
set -eu
HERE=$(cd "$(dirname "$0")/.." && pwd)
cd "$HERE"
STEMS='organis|colour|behaviour|centre|licence|recognis|modelling|catalogue|\bgrey\b|judgement|artefact|whilst|amongst|favour|honour|analys(e|ed|ing)\b|optimis|normalis|serialis|initialis|visualis|minimis|prioritis|customis|summaris|categoris|parameteris|rasteris|unrecognis|cancelled|travelled|labelled|aluminium|instalment|neighbour|totalled|defence|offence|\bprogrammes?\b|\bfulfil\b|\benrol\b|skilful|ageing|\bcosy\b|focuss|\bcheque\b|\btyre\b|\bkerb\b|\bstorey\b|\bmould\b|\bplough\b|\bdraught\b|sceptic'
hits=$(grep -rn -i -E "$STEMS" --include='*.md' . --exclude-dir=.git --exclude-dir=superpowers || true)
if [ -n "$hits" ]; then
  echo "✗ British spellings:"
  echo "$hits"
  exit 1
fi
echo "✓ every Markdown file is American English"
```

- [ ] **Step 3: Run it against the probe, then without**

```bash
sh test/spelling.sh; echo "exit $?"
rm probe.md
sh test/spelling.sh; echo "exit $?"
```
Expected: first run prints `✗ British spellings:` with `./probe.md:3` and `exit 1`; second run prints the `✓` line and `exit 0`. If the second run lists a real file, fix the file.

- [ ] **Step 4: Commit**

```bash
git add test/spelling.sh
git commit -F - <<'EOF'
A spelling tripwire over every Markdown file, this repository's own included

The list is stems, not words, so derived forms are caught, and a stem is on it only when
no American word contains it. WRITING.md is scanned like everything else, which is why
it forbids British spelling without quoting one.

Verified: a probe file with two British words fails the run; without it, the run passes.
EOF
```

---

### Task 8: `README.md` and CI

**Files:**
- Create: `README.md`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the script's install path `conventions/conventions-sync` and the pin shape from Task 6; the test entry points from Tasks 6 and 7.
- Produces: the job id `test`, which the branch ruleset will require once the repository is on GitHub.

- [ ] **Step 1: Write `README.md`**

````markdown
# conventions

How the robertblust, guestgraph and companygraph organizations write and work, in three
files every repository of the family vendors at a pinned release:

- `conventions/WRITING.md` — one voice, three registers, English and German.
- `conventions/WORKING.md` — git and GitHub: branches, merge commits, identity, releases, pins.
- `conventions/REPOSITORIES.md` — the family, and what pins what.

A member's `AGENTS.md` opens with a block that names them and tells any agent to read them
first, in plain words and naming no vendor. `CLAUDE.md` is the vendor adapter — `@AGENTS.md`
and one import line per shared file — and another vendor's adapter would be added the same
way the day it is needed. The block and the files are written by a
script and checked in CI, so a copy that drifts from its release turns a build red rather than
quietly diverging.

## Taking it into a repository

Once, from the repository's root, naming the release to follow:

```sh
printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0" }\n' > conventions.json
curl -fsSL https://raw.githubusercontent.com/robertblust/conventions/v1.0.0/conventions/conventions-sync -o /tmp/conventions-sync
sh /tmp/conventions-sync sync
```

From then on the script is vendored with the rest, and the two commands are:

```sh
sh conventions/conventions-sync check   # exit 1 with one ✗ line per thing that differs
sh conventions/conventions-sync sync    # bring the copy to the release conventions.json names
```

Put `check` in CI before anything installs. Move the tag in `conventions.json` to take a new
release, run `sync`, and commit what changed.

## Layout

The repository mirrors what it vendors. The shared files sit under `conventions/` here
exactly as they will in a member, and the root `AGENTS.md` carries the block a member's
`AGENTS.md` opens with, so both read the same in the source and in every copy.

## Releasing

A tag and a GitHub Release with notes in the prose register: what changed, what breaks, how to
take it. Any change to a vendored file is at least a minor release, because it makes every copy
stale. A change to the block's shape or the script's commands is a major. Before tagging, set
the version in the first line of `AGENTS.md` to the new tag. `REPOSITORIES.md` lists the
members in the order to re-sync them.

## Tests

`sh test/run.sh` runs the script against a temporary member with this checkout as the source.
`sh test/spelling.sh` fails on any British spelling in a Markdown file outside
`docs/superpowers/`, where a spec or plan may have to quote the list. CI runs both, and
`shellcheck` over the shell.

Apache 2.0.
````

- [ ] **Step 2: Write the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  # The job id is what a branch ruleset requires. Rename it only together with the ruleset.
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - run: shellcheck conventions/conventions-sync test/run.sh test/spelling.sh
      - run: sh test/run.sh
      - run: sh test/spelling.sh
```

- [ ] **Step 3: Run everything once more from a clean tree**

```bash
git status --short
sh test/run.sh && sh test/spelling.sh; echo "exit $?"
```
Expected: `git status` shows only the two new files; both suites pass; `exit 0`.

- [ ] **Step 4: Commit**

```bash
git add README.md .github/workflows/ci.yml
git commit -F - <<'EOF'
README and CI

The README says what the repository is, how a member takes it in three lines, and how a
release is made. CI is one job named test — the id a ruleset requires — running
shellcheck and both suites.

Verified: sh test/run.sh all pass; sh test/spelling.sh passes.
EOF
```

---

### Task 9: Read-through, then stop

**Files:**
- None created. This task ends with the owner reading.

- [ ] **Step 1: Assemble a reading order for the owner**

```bash
wc -w conventions/WRITING.md conventions/WORKING.md conventions/REPOSITORIES.md AGENTS.md README.md
git log --oneline | cat
```

- [ ] **Step 2: Report and stop**

Report in the reply register: the five files to read in order (`AGENTS.md`, `conventions/WRITING.md`, `conventions/WORKING.md`, `conventions/REPOSITORIES.md`, `README.md`), that both suites pass, and that nothing has been pushed and no other repository has been touched. Do not create the GitHub repository, do not push, do not tag. The first push, its commit shape and `v1.0.0` are the owner's decision after reading.
