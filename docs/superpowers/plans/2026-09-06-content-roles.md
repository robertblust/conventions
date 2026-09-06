# Content Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** conventions v1.5.0 with a writer brief, a translator brief and a glossary vendored to every member, the writing process written into `WRITING.md`, and two thin agent adapters in every member's `.claude/agents/`.

**Architecture:** Three Markdown files join `conventions/` flat beside the three already there, so `conventions-sync` changes by three names in its `FILES` line and the release's script self-updates into a member on one `sync`. `WRITING.md` gains a section on how a text is made and a page paragraph in the prose register, and its Languages section is rewritten to say the German is translated from reviewed English. The vendor adapters are not vendored: they are two files per member, written once from the README recipe like `CLAUDE.md`, and the re-sync wave adds them.

**Tech Stack:** Markdown; POSIX `sh` for `conventions-sync` and `test/run.sh`; `gh` for pull requests and the release.

**Spec:** `docs/superpowers/specs/2026-09-06-content-roles-design.md`. The plan argues from it; read both.

## Global Constraints

- Prose register in every Markdown file; git register in every commit; a `Verified:` line and the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` on every commit.
- American English, spaced em-dash, no serial comma, curly quotes in prose. German appears in the shared files only inside inline code in `GLOSSARY.md` and in the paragraph `WRITING.md` already carries.
- No vendor, model or tool product name in any file under `conventions/`. The adapters under `.claude/agents/` are the only place a vendor's syntax appears.
- The role briefs never name a member, a check or a package elsewhere.
- Every exit code is read on its own, never through `| tail`.
- Work on the branch `content-roles`, which already carries the spec. Nothing is committed on `main`. Merges, the tag and every member's merge wait for the owner's word.
- Where the plan quotes a paragraph for a file, the paragraph is copied as it stands; wording is not improved in flight.

---

### Task 1: `WRITING.md` says how a text is made

**Files:**
- Modify: `conventions/WRITING.md:14-20` (the German paragraph of *Languages*)
- Modify: `conventions/WRITING.md:21` (insert the new section *How a text is made* before `## What every register shares`)
- Modify: `conventions/WRITING.md:61-62` (insert the page paragraph after the release-notes paragraph)

**Interfaces:**
- Produces: the section title `## How a text is made`, which `WRITER.md` and `TRANSLATOR.md` refer to by name in Task 3.

- [ ] **Step 1: Replace the German paragraph of *Languages***

Replace lines 14–20, from `The pages carry a second language` to `with its own reason.`, with this paragraph:

```markdown
The pages carry a second language, Swiss German, de-CH. It is there because the person behind
the family is Swiss, and a reader in Zürich or Bern is a reader the pages are written for. The
German is a translation of the English, made after the owner has reviewed the English and never
before, by the translator role of `TRANSLATOR.md`, in the forms Switzerland uses. It is reviewed
by reading the translator's back-translation, an English rendering of what the German says,
because that takes a minute where reading German prose takes an evening and the family has one
reader for it. It appears only where a page carries it, in the value of an attribute whose name
ends in `-de`, and nowhere else: not in code, not in git, not in a reply. A third language is
not planned; adding one would mean writing this paragraph again with its own reason.
```

- [ ] **Step 2: Insert the section *How a text is made***

Insert before the line `## What every register shares`, leaving one blank line on each side:

```markdown
## How a text is made

A text starts from a brief that names the audience, the one point, the facts it may claim and
where each is shown, and the file and place it lands. A draft without a brief is a draft the
reviewer has to reverse-engineer, and the reviewer is the person whose time is shortest.

The writer of `WRITER.md` drafts the English on the branch, in the register the place calls
for, and reports what it wrote and which claims it could not trace to the brief or the
repository. The owner reviews on the branch, in the diff and on the rendered page, because that
is the review a pull request gets anyway and a second channel would be a second place to lose a
correction.

The translator of `TRANSLATOR.md` makes the German from the reviewed English only, one element
at a time, with `GLOSSARY.md` open, and hands back a back-translation beside each element.
German made from a draft is German that has to be made again. An English edit to an element
re-runs the translator on that element alone; nothing marks an element stale, so the rule is
kept by whoever edits the English.

Both roles edit files and neither commits. `WORKING.md` says who does.
```

- [ ] **Step 3: Insert the page paragraph in the prose register**

Insert after the paragraph `Release notes are this register aimed at a consumer: … in that order.` and before `## The git register`, with one blank line on each side:

```markdown
A page is this register aimed at a visitor who has not decided to stay. The first line is the
one point, in the words the visitor would use for it, and every later screen earns its place or
goes. Sentences run shorter than in a README because a page is read on a phone. A claim the
page opens with is a claim the page then shows. Nothing else changes: cause before mechanism
holds wherever a page explains, and no adjective sells.
```

- [ ] **Step 4: Verify the old sentences are gone and the new section is present**

Run, from the repository root:

```sh
grep -c 'second original' conventions/WRITING.md; grep -c 'left unread' conventions/WRITING.md; grep -c '^## How a text is made$' conventions/WRITING.md; grep -c 'aimed at a visitor' conventions/WRITING.md
```

Expected: `0`, `0`, `1`, `1`, each on its own line. `grep -c` exits 1 when the count is 0, so read the numbers, not the exit codes.

- [ ] **Step 5: Run the prose check**

Run: `sh conventions/conventions-check; echo "exit $?"`
Expected: `✓ every Markdown file follows WRITING.md` and `exit 0`.

- [ ] **Step 6: Commit**

```sh
git add conventions/WRITING.md
git commit -F - <<'EOF'
WRITING.md says how a text is made

The file fixed what a finished text looks like and nothing about the order it is made in,
so every session drafted its own process. Now it says: a brief, an English draft on the
branch, the owner's review there, and German translated from the reviewed English one
element at a time and reviewed by back-translation. The Languages paragraph says the same
instead of a second original nobody was writing, and the prose register says what
separates a page from a README.

Verified: sh conventions/conventions-check passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: `WORKING.md` says a role never commits

**Files:**
- Modify: `conventions/WORKING.md:15-19` (the paragraph beginning `An agent commits when the owner asks`)

- [ ] **Step 1: Add two sentences to the paragraph**

After the sentence `“Commit and open the pull request” is a request to do exactly that; it is not approval to merge.`, still inside the same paragraph, add:

```markdown
A role invoked as a subagent, the writer or the translator of `WRITING.md`, edits files and
reports; it never commits, and the session that invoked it proposes the message.
```

The paragraph then reads, in full:

```markdown
An agent commits when the owner asks, and not on its own initiative. It proposes the message
in the git register of `WRITING.md`. The author of the commit is the person. A tool that
co-authored the change is named in a `Co-Authored-By` trailer, whichever tool it was, so the
history says who and what wrote it. “Commit and open the pull request” is a request to do
exactly that; it is not approval to merge. A role invoked as a subagent, the writer or the
translator of `WRITING.md`, edits files and reports; it never commits, and the session that
invoked it proposes the message.
```

- [ ] **Step 2: Run the prose check**

Run: `sh conventions/conventions-check; echo "exit $?"`
Expected: `✓ every Markdown file follows WRITING.md` and `exit 0`.

- [ ] **Step 3: Commit**

```sh
git add conventions/WORKING.md
git commit -F - <<'EOF'
A role edits and reports, and the session commits

The writer and translator briefs create a case the commit rule did not name: a subagent
that changes files on the branch. The rule that an agent commits only when asked already
covers it, and the paragraph now says so once more for that case, so the brief and the
rule cannot be read as disagreeing.

Verified: sh conventions/conventions-check passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: The two briefs

**Files:**
- Create: `conventions/WRITER.md`
- Create: `conventions/TRANSLATOR.md`

**Interfaces:**
- Consumes: `## How a text is made` in `WRITING.md` (Task 1); `GLOSSARY.md` (Task 4) by name.
- Produces: the two files the adapters in Task 6 and Task 9 point at by path.

- [ ] **Step 1: Write `conventions/WRITER.md`**

```markdown
# Writer

The role that drafts English in the family voice: a page, a README, release notes, an agent
file. It exists so that the voice is the same on the third site as on the first, and so that
the owner reviews a draft instead of writing one. `WRITING.md` is its rulebook, the section
*How a text is made* its place in the order, and `GLOSSARY.md` the form of every family term.

## What it takes

A brief. The brief names the audience, the one point the text makes, the facts the text may
claim and where each is shown, and the file and the place in it where the text lands. Where
the brief lacks the audience, the point or a fact's source, the writer asks for it and writes
nothing until it has it; a guessed audience produces a text for nobody, and a guessed fact is
the sentence the next reviewer has to unpick.

## What it produces

The text, in the file, on the current branch, in the register the place calls for: the prose
register for a page or a README, its page paragraph for a landing page, release notes shaped
as `WRITING.md` says. And a reply in the reply register: what it wrote, what it changed, and
which claims it could not trace to the brief or to the repository, each named so the reviewer
can strike or source it.

## What it never does

It never writes a fact or a number the brief or the repository does not show. It never writes
into a `-de` attribute, a `de:` branch or a `translates` spec; the German is the translator's,
made after the English is reviewed. It never commits and never runs the build; the session that
invoked it does both when the owner asks. It never uses an adjective that sells.

## Before it reports

The first sentence of every section carries the point. Each sentence carries one idea. Every
claim has a source in the brief or the repository, or is named in the reply as unsourced. The
marks are the English section's: spaced em-dash, curly quotes, no serial comma, May 4, 2012.
Every family term is in the form `GLOSSARY.md` gives it.
```

- [ ] **Step 2: Write `conventions/TRANSLATOR.md`**

```markdown
# Translator

The role that makes the German of an element whose English the owner has reviewed. It exists
because the German of the pages is a translation made by an agent and read by nobody as
German, so the discipline has to sit in the role: reviewed English in, German and its
back-translation out, and the same word for the same thing on every site. `WRITING.md` is
its rulebook, its German section above all, and `GLOSSARY.md` fixes every family term.

## What it takes

The reviewed English of the elements named in the task, and `GLOSSARY.md`. Reviewed means the
owner has said the English is done; a draft is not reviewed, and the translator asks rather
than assumes. Where the task names no elements, the elements are every one in the branch's
diff whose English changed. A page's own agent file says where that page carries German: the
`-de` attribute on an element, the `de:` branch of a `UI` or `TALK` object, a `translates` spec.

## What it produces

The German in the element's own place, with the markup inside the attribute kept and only its
text replaced, in the quote character the attribute already uses. And a reply in the reply
register with one row per element: the English, the German, and the German read back into
plain English by the translator, so the owner reads meaning in a minute without reading
German. Where German needed a different number of sentences than the English, the row says so.

## What it never does

It never changes an English word. It never translates an element whose English is not
reviewed. It never renders a glossary term in any form but the glossary's. It never writes a
`-de` on a page whose note says the model's own words stay English in both views. It never
commits.

## How the German is written

As the German section of `WRITING.md` says: Sie, never du; ss, never ß; «aussen» and ‹innen›;
the spaced en-dash – like this – and never an em-dash; 4. Mai 2012, Jan., Febr., März, Apr.,
Mai, Juni, Juli, Aug., Sept., Okt., Nov., Dez.; 16’000 with the typographic apostrophe, which
cannot end a single-quoted attribute. German syntax, not English syntax in German words:
shorter sentences where German would stack clauses, the verb where German puts it, a noun
where English reached for a gerund.

## Before it reports

The back-translation of each row means what the English means. Every glossary term is in its
form. The marks are the German section's. The attribute's quote character does not appear in
its value. No English word changed.
```

- [ ] **Step 3: Run the prose check**

Run: `sh conventions/conventions-check; echo "exit $?"`
Expected: `✓ every Markdown file follows WRITING.md` and `exit 0`. The German words in `TRANSLATOR.md` are the marks section repeated from `WRITING.md`, which already passes; if the check names one of them, the word is not in `WRITING.md`'s paragraph and has to be quoted in inline code instead.

- [ ] **Step 4: Commit**

```sh
git add conventions/WRITER.md conventions/TRANSLATOR.md
git commit -F - <<'EOF'
The writer and the translator have a brief each

Every session invented the writer again, and nothing said what the translator may take or
must hand back. Each brief says what the role is for, what it takes, what it produces,
what it never does and what it checks before it reports, naming no vendor and no model,
so any tool that reads Markdown can play the role the same way.

Verified: sh conventions/conventions-check passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 4: The glossary, harvested from the sites

**Files:**
- Create: `conventions/GLOSSARY.md`

**Interfaces:**
- Consumes: the three sites' `data-de` attributes and `verify/check.mjs`, read once for the harvest. This is the one reach outside the repository the spec names, for the one purpose of reading forms already in use.
- Produces: the table the translator reads.

- [ ] **Step 1: Harvest the German forms the sites already carry**

Run from `~/git`, and read the counts and contexts:

```sh
for t in 'Meta-Modell' 'Metamodell' 'Identitätsgraph' 'Identitätsauflösung' 'mentale[sn]? Modell' 'Mentale[sn]? Modell' 'Referenzinstanz' 'Designsystem' 'Design-System' 'Vortrag' 'Foliensatz' 'Open Core' 'Open-Core' 'quelloffen' 'Open-Source' 'Paket' 'Pack\b'; do
  n=$(grep -rhoE "$t" --include='*.html' --include='*.mjs' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=conventions --exclude-dir=docs robertblust/robertblust.github.io guestgraph/guestgraph.github.io companygraph/companygraph.github.io | wc -l | tr -d ' ')
  echo "$n  $t"
done
grep -rnoE ".{30}(Identitätsgraph|Identitätsauflösung|mentale[sn]? Modell|Open Core|quelloffen|Open-Source).{25}" --include='*.html' --include='*.mjs' --exclude-dir=node_modules robertblust/robertblust.github.io guestgraph/guestgraph.github.io companygraph/companygraph.github.io
```

Expected, as counted on 2026-09-06: `Meta-Modell` on all three sites and no `Metamodell`; `Identitätsgraph` on guestgraph.io in the phrase `Open-Source-Identitätsgraph für Gäste`; `Identitätsauflösung` on guestgraph.io; `Das mentale Modell` as a talk title on blust.ch; `Open Core` kept in English on blust.ch; `quelloffen` as the adjective on companygraph.io; `Vortrag` everywhere; nothing for `Referenzinstanz`, `Designsystem`, `Foliensatz` or `Paket` as a family term. If a count differs, the table below follows what is found, not what is written here.

- [ ] **Step 2: Write `conventions/GLOSSARY.md`**

```markdown
# Glossary

Every family term in its fixed English and German form. The writer uses the English column
so the third site says what the first says; the translator uses the German column so one
word has one rendering across the sites. A term joins the table the first time a text needs
it and the translator has to choose, and the owner's choice is recorded here rather than in
the attribute where it was first made.

The German cells are inline code because the prose check reads no language and a German word
such as `Organisation` would be a hit. This table and the German paragraph of `WRITING.md`
are the only places the shared files carry German on purpose.

| Term | English | German | Note |
|---|---|---|---|
| CompanyGraph | CompanyGraph | `CompanyGraph` | A name; one word, two capitals, in both languages. |
| GuestGraph | GuestGraph | `GuestGraph` | A name, as above. |
| meta-model | meta-model | `Meta-Modell` | Hyphen and lower case in English; hyphen and two capitals in German. Every site carries this form. |
| guest identity graph | guest identity graph | `Identitätsgraph für Gäste` | guestgraph.io's own phrase; `Open-Source-Identitätsgraph` where the sentence says open source. |
| identity resolution | identity resolution | `Identitätsauflösung` | guestgraph.io, the billing page and the intro talk. |
| mental model | mental model | `das mentale Modell` | blust.ch's talk; the adjective declines with case. |
| open core | open core | `Open Core` | Kept in English on blust.ch; a term of the trade. |
| open source | open source | `quelloffen` | The adjective; in a compound, `Open-Source-`, as guestgraph.io writes it. |
| talk | talk | `Vortrag` | A talk on a site; the deck is the file that carries it. |

English forms fixed here whose German no page carries yet, to be chosen the first time a text
needs them: reference instance, pack, design system, deck.
```

Where Step 1 found a different form for a term, the row carries what was found; where two sites disagree, the row carries both forms and the note says which site carries which, and the owner picks in the pull request review.

- [ ] **Step 3: Run the prose check**

Run: `sh conventions/conventions-check; echo "exit $?"`
Expected: `✓ every Markdown file follows WRITING.md` and `exit 0`. This is the check that the German cells are skipped; a `✗ conventions/GLOSSARY.md:…` line means a German word sits outside inline code.

- [ ] **Step 4: Commit**

```sh
git add conventions/GLOSSARY.md
git commit -F - <<'EOF'
The glossary fixes every family term in both languages

The German form of a family term lived in whichever data-de last needed it, so three sites
could carry three renderings of one word and nothing named the family's. The table is
harvested from the forms the sites already carry, in inline code because the prose check
reads no language, and a term whose German no page has yet is listed for the day a text
needs it.

Verified: sh conventions/conventions-check passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 5: The sync script vendors the three files, test-first

**Files:**
- Modify: `test/run.sh:21` (the list of files a sync writes)
- Modify: `conventions/conventions-sync:21` (the `FILES` line)

**Interfaces:**
- Produces: `FILES="WRITING.md WORKING.md REPOSITORIES.md WRITER.md TRANSLATOR.md GLOSSARY.md AGENTS.md conventions-sync conventions-check"`, the list every later release inherits.

- [ ] **Step 1: Add the three names to the test's list**

In `test/run.sh`, change line 21 from

```sh
for f in WRITING.md WORKING.md REPOSITORIES.md AGENTS.md conventions-sync conventions-check manifest.json; do
```

to

```sh
for f in WRITING.md WORKING.md REPOSITORIES.md WRITER.md TRANSLATOR.md GLOSSARY.md AGENTS.md conventions-sync conventions-check manifest.json; do
```

- [ ] **Step 2: Run the tests and see the three failures**

Run: `sh test/run.sh; echo "exit $?"`
Expected: three lines `✗ sync did not write conventions/WRITER.md`, `… TRANSLATOR.md`, `… GLOSSARY.md`, then `3 failing` and `exit 1`.

- [ ] **Step 3: Add the three names to `FILES`**

In `conventions/conventions-sync`, change line 21 from

```sh
FILES="WRITING.md WORKING.md REPOSITORIES.md AGENTS.md conventions-sync conventions-check"
```

to

```sh
FILES="WRITING.md WORKING.md REPOSITORIES.md WRITER.md TRANSLATOR.md GLOSSARY.md AGENTS.md conventions-sync conventions-check"
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `sh test/run.sh; echo "exit $?"`
Expected: every line begins `✓`, then `all pass` and `exit 0`. The self-update case still trims `conventions-check` from a copy's `FILES` and proves the re-exec; it is untouched by the longer list.

- [ ] **Step 5: Run shellcheck**

Run: `shellcheck conventions/conventions-sync test/run.sh; echo "exit $?"`. `shellcheck` is not installed on this machine; put it in a venv under the session's scratchpad directory first, `python3 -m venv "$SCRATCHPAD/sc" && "$SCRATCHPAD/sc/bin/pip" install shellcheck-py`, and run `"$SCRATCHPAD/sc/bin/shellcheck"` in place of the bare name. CI runs the runner's.
Expected: no output and `exit 0`.

- [ ] **Step 6: Commit**

```sh
git add test/run.sh conventions/conventions-sync
git commit -F - <<'EOF'
sync vendors the two briefs and the glossary

Three files join conventions/ flat beside the three already there, so the script changes
by three names in one line and nothing in how it fetches. A member on v1.3.0 or later
fetches this release's script first and re-runs under its list, so one sync brings all
six files.

Verified: sh test/run.sh passes; shellcheck is clean.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 6: The block, the README, the version, the workflow's release

**Files:**
- Modify: `AGENTS.md:1-8` (the marker and the list in the block)
- Modify: `.github/workflows/check.yml` (the `CONVENTIONS_RELEASE` line)
- Modify: `README.md:3-8` (the file list), `README.md:16-24` (the recipe), and the `exclude` example and workflow example that name `v1.4.0`

**Interfaces:**
- Consumes: the files of Tasks 3 and 4 by name.
- Produces: the block members receive at v1.5.0; the adapter texts members copy in Task 9.

- [ ] **Step 1: Move the marker and extend the block in `AGENTS.md`**

Line 1 becomes `<!-- conventions · v1.5.0 -->`. After line 8, `- `conventions/REPOSITORIES.md` — the family: what each repository is and what pins what.`, add one line:

```markdown
- `conventions/WRITER.md`, `conventions/TRANSLATOR.md`, `conventions/GLOSSARY.md` — the two roles that make a text, and the terms they keep.
```

- [ ] **Step 2: Move the workflow's declared release**

In `.github/workflows/check.yml`, change `CONVENTIONS_RELEASE: v1.4.0` to `CONVENTIONS_RELEASE: v1.5.0`.

- [ ] **Step 3: Run the tests for the marker agreement**

Run: `sh test/run.sh; echo "exit $?"`
Expected: the line `✓ check.yml's release and AGENTS.md's marker agree on v1.5.0`, then `all pass` and `exit 0`.

- [ ] **Step 4: Update the README's file list**

Replace lines 3–8 with:

```markdown
How the robertblust, guestgraph and companygraph organizations write and work, in six
files every repository of the family vendors at a pinned release:

- `conventions/WRITING.md` — one voice, three registers, English and German, and how a text is made.
- `conventions/WORKING.md` — git and GitHub: branches, merge commits, identity, releases, pins.
- `conventions/REPOSITORIES.md` — the family, and what pins what.
- `conventions/WRITER.md` and `conventions/TRANSLATOR.md` — the two roles that make a text: what each takes, produces and never does.
- `conventions/GLOSSARY.md` — every family term in its fixed English and German form.
```

- [ ] **Step 5: Move every `v1.4.0` in the README to `v1.5.0`**

Run: `grep -n 'v1.4.0' README.md` and change each hit: the `printf` line, the `curl` line, the `uses:` line and the `exclude` example. Then `grep -c 'v1.4.0' README.md` reads `0`.

- [ ] **Step 6: Add the adapters to the recipe**

After the paragraph that ends `from v1.3.0 on, the script fetches its own new version first and one `sync` is enough.` and before the paragraph beginning `A folder that is someone else's prose`, insert:

````markdown
Then two agent adapters, written once beside `CLAUDE.md` and kept as they are. They are a
vendor's syntax, which is why they are not vendored with the shared files; another vendor's
adapters would go in that vendor's place the same way. `.claude/agents/writer.md`:

```markdown
---
name: writer
description: Drafts or revises English text in the family voice from a brief — a page, a README, release notes, an agent file. Use it whenever a task is to write or rewrite prose rather than code.
tools: Read, Grep, Glob, Edit
---
Read `conventions/WRITING.md`, `conventions/GLOSSARY.md` and `conventions/WRITER.md` before anything else, and follow them. Report in the reply register of `WRITING.md`: what you wrote, what you changed and which claims you could not trace to the brief or the repository.
```

And `.claude/agents/translator.md`:

```markdown
---
name: translator
description: Makes the Swiss German of elements whose English the owner has reviewed, in the -de attribute or the de branch the page uses, and hands back a back-translation per element. Use it only after the English review, never on a draft.
tools: Read, Grep, Glob, Edit
---
Read `conventions/WRITING.md`, `conventions/GLOSSARY.md` and `conventions/TRANSLATOR.md` before anything else, and follow them. Report in the reply register of `WRITING.md`: one row per element with the English, the German and the German read back into plain English, and any element you left because its English is not reviewed.
```

Both read and edit files and nothing else: no shell and no git, because a role edits and
reports and the session that invoked it commits when the owner asks.
````

- [ ] **Step 7: Run the prose check and the tests**

Run: `sh conventions/conventions-check; echo "exit $?"` then `sh test/run.sh; echo "exit $?"`
Expected: `✓ every Markdown file follows WRITING.md`, `exit 0`; `all pass`, `exit 0`.

- [ ] **Step 8: Commit**

```sh
git add AGENTS.md .github/workflows/check.yml README.md
git commit -F - <<'EOF'
Release 1.5.0: the two roles, the glossary, and the adapters in the recipe

The block names the three new files so a member's agent finds them where it finds the
other three, the workflow declares the release it is, and the README's recipe gains the
two agent adapters in full, written once beside CLAUDE.md because they are a vendor's
syntax and the shared files name none.

Verified: sh test/run.sh passes; sh conventions/conventions-check passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 7: The pull request

**Files:** none changed.

- [ ] **Step 1: Run everything once more from a clean tree**

Run: `git status --short` (expected: empty), then `sh test/run.sh; echo "exit $?"` and `sh conventions/conventions-check; echo "exit $?"`.
Expected: `all pass`, `exit 0`; `✓ every Markdown file follows WRITING.md`, `exit 0`.

- [ ] **Step 2: Push and open the pull request**

```sh
git push -u origin content-roles
gh pr create --title "Release 1.5.0: the content roles and the glossary" --body-file - <<'EOF'
WRITING.md fixed what a finished text looks like and nothing about how it is made, so every
session invented the writer again and the German was described as a second original nobody
was writing. This release writes the order down: a brief, an English draft on the branch,
the owner's review there, German translated from the reviewed English one element at a
time and reviewed by back-translation. Two briefs and a glossary join the vendored files;
two thin agent adapters join the README recipe, written once per member like CLAUDE.md.

The block changes, so every member's copy is stale at v1.5.0. Re-syncing is one sync from
v1.3.0 on, plus the two adapter files. The spec is
docs/superpowers/specs/2026-09-06-content-roles-design.md, the plan beside it.

Verified: sh test/run.sh passes; sh conventions/conventions-check passes.
EOF
gh pr checks --watch
```

Expected: the `test` job green. Report the pull request URL and the check and stop; merging is the owner's word.

---

### Task 8: The tag and the release, on the owner's word

**Files:** none changed. Runs only after the owner has merged the pull request and said to release.

- [ ] **Step 1: Tag the merge commit**

```sh
git checkout main && git pull --ff-only
git tag -a v1.5.0 -m "conventions v1.5.0"
git push origin v1.5.0
```

- [ ] **Step 2: Create the GitHub Release**

```sh
gh release create v1.5.0 --title "v1.5.0" --notes-file - <<'EOF'
WRITING.md now says how a text is made: a brief, an English draft on the branch, the owner's
review in the diff and on the rendered page, and German translated from the reviewed English
one element at a time, reviewed by reading the translator's back-translation. The Languages
paragraph says the German is that translation, made for a reader in Zürich or Bern and Swiss
in its forms. The prose register says what separates a page from a README.

Three files join conventions/: WRITER.md and TRANSLATOR.md, the two roles that make a text,
and GLOSSARY.md, every family term in its fixed English and German form. WORKING.md says a
role invoked as a subagent edits and reports and never commits.

Nothing breaks. To take it, move both tags to v1.5.0, run sh conventions/conventions-sync
sync once, and add .claude/agents/writer.md and .claude/agents/translator.md from the README
recipe.
EOF
```

- [ ] **Step 3: Delete the merged branch**

```sh
git push origin --delete content-roles
git branch -d content-roles
```

---

### Task 9: The re-sync wave, one pull request per member

**Files, per member:**
- Modify: `conventions.json` (the tag)
- Modify: `.github/workflows/conventions.yml` (the `uses:` tag)
- Modify: `conventions/` and the block in `AGENTS.md` (written by `sync`)
- Create: `.claude/agents/writer.md`, `.claude/agents/translator.md`

**Interfaces:**
- Consumes: the tag `v1.5.0` from Task 8.

Order, from `REPOSITORIES.md`: `robertblust/design`, `robertblust/robertblust.github.io`, `guestgraph/guestgraph.github.io`, `companygraph/companygraph.github.io`, `robertblust/mental-model`, `companygraph/meta-model`, `guestgraph/engine`, `robertblust/field-notes`, `guestgraph/.github`, `companygraph/.github`. Each is one pull request, opened and reported, merged only on the owner's word; the owner has said that a mechanical re-sync wave may be merged together with a pause wherever words change, and the adapters are new files, not changed words, so ask once for the wave and stop for any member whose `conventions-check` turns up a word to fix.

For each member, from its local path in `REPOSITORIES.md`:

- [ ] **Step 1: Confirm the identity and the base**

Run: `git config user.email` (expected: `robert.blust@flatland.ch`), `git checkout main && git pull --ff-only`, `git checkout -b conventions-1.5.0`.

- [ ] **Step 2: Move both tags**

```sh
sed -i.bak 's/"tag": "v1.4.0"/"tag": "v1.5.0"/' conventions.json && rm conventions.json.bak
sed -i.bak 's#check.yml@v1.4.0#check.yml@v1.5.0#' .github/workflows/conventions.yml && rm .github/workflows/conventions.yml.bak
grep -c 'v1.5.0' conventions.json .github/workflows/conventions.yml
```

Expected: `1` for each file.

- [ ] **Step 3: Sync and check**

```sh
sh conventions/conventions-sync sync; echo "exit $?"
sh conventions/conventions-sync check; echo "exit $?"
sh conventions/conventions-check; echo "exit $?"
ls conventions/WRITER.md conventions/TRANSLATOR.md conventions/GLOSSARY.md
```

Expected: `✓ conventions: conventions/ and the AGENTS.md block are at robertblust/conventions@v1.5.0`, `exit 0`; the check line and `exit 0`; `✓ every Markdown file follows WRITING.md`, `exit 0`; the three files listed. If the prose check names a word in the member's own prose, stop and report it before fixing; that is a word change, which the owner reviews.

- [ ] **Step 4: Write the two adapters**

```sh
mkdir -p .claude/agents
cat > .claude/agents/writer.md <<'EOF'
---
name: writer
description: Drafts or revises English text in the family voice from a brief — a page, a README, release notes, an agent file. Use it whenever a task is to write or rewrite prose rather than code.
tools: Read, Grep, Glob, Edit
---
Read `conventions/WRITING.md`, `conventions/GLOSSARY.md` and `conventions/WRITER.md` before anything else, and follow them. Report in the reply register of `WRITING.md`: what you wrote, what you changed and which claims you could not trace to the brief or the repository.
EOF
cat > .claude/agents/translator.md <<'EOF'
---
name: translator
description: Makes the Swiss German of elements whose English the owner has reviewed, in the -de attribute or the de branch the page uses, and hands back a back-translation per element. Use it only after the English review, never on a draft.
tools: Read, Grep, Glob, Edit
---
Read `conventions/WRITING.md`, `conventions/GLOSSARY.md` and `conventions/TRANSLATOR.md` before anything else, and follow them. Report in the reply register of `WRITING.md`: one row per element with the English, the German and the German read back into plain English, and any element you left because its English is not reviewed.
EOF
sh conventions/conventions-check; echo "exit $?"
```

Expected: `✓ every Markdown file follows WRITING.md` and `exit 0`; the adapters are English Markdown and the check reads them. Where the member's `.gitignore` or `conventions.json` `exclude` names `.claude`, as `guestgraph/engine` does, the files are still created and the exclusion is left as it is: the member's own agent file says why it excludes the folder.

- [ ] **Step 5: Run the member's own suite where it has one**

Run what the member's `AGENTS.md` names under its build-and-verify section, and read the exit code on its own. Expected: green. A member with no suite, the two `.github` repositories, skips this step.

- [ ] **Step 6: Commit, push, open the pull request**

```sh
git add conventions.json .github/workflows/conventions.yml conventions AGENTS.md .claude/agents
git commit -F - <<'EOF'
Conventions v1.5.0, with the writer and translator adapters

The release adds the two role briefs and the glossary to the vendored files and writes
the writing process into WRITING.md. Both tags move, sync brings the six files and the
block, and the two agent adapters from the README recipe join .claude/agents/, written
once like CLAUDE.md.

Verified: sh conventions/conventions-sync check and sh conventions/conventions-check pass; the repository's own suite passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
git push -u origin conventions-1.5.0
gh pr create --title "Conventions v1.5.0, with the writer and translator adapters" --body-file - <<'EOF'
Re-sync to conventions v1.5.0: the two role briefs and the glossary join conventions/, the
block names them, and .claude/agents/ gains the writer and translator adapters from the
README recipe. No word of this repository's own prose changes.

Verified: sh conventions/conventions-sync check and sh conventions/conventions-check pass; the repository's own suite passes.
EOF
gh pr checks --watch
```

For a member whose `Verified:` line would claim a suite it does not have, drop the clause about the suite. Expected: `conventions / conventions` green, and the member's own job green where it has one. Report the URL, then the next member.

- [ ] **Step 7: After the owner's word, merge and delete the branch**

```sh
gh pr merge --merge --delete-branch
git checkout main && git pull --ff-only
```

Never squash; `WORKING.md` says why.
