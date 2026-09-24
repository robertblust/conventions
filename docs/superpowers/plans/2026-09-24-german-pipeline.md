# German pipeline, conventions — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship conventions v1.29.0: the four roles that make the German, `GERMAN.md`, the owner's glossary rows, and `WRITING.md`, `WORKING.md`, `AGENTS.md` and the README saying the process as it now runs.

**Architecture:** Three new vendored files join `FILES` in `conventions/conventions-sync`, one is rewritten, four shared files change in place, and the README recipe gains two adapters. A second pull request moves the release marker, and a tag and a Release follow on the owner's word. The member wave and the design and site work are separate plans, written after this one merges.

**Tech Stack:** POSIX sh (`conventions-sync`, `test/run.sh`), Markdown held by `conventions-check` and `conventions-format` (markdownlint-cli2 on Node), git and `gh`.

**Spec:** `docs/superpowers/specs/2026-09-24-german-pipeline-design.md` — its appendix holds three of the new files in full; this plan quotes every file it writes in full as well, so a task never has to be read beside another.

## Global Constraints

- Work in the worktree `~/git/robertblust/conventions-german-pipeline` on branch `german-pipeline`; the clone stays on `main`.
- `export PATH=/opt/homebrew/bin:$PATH` before any `node`, `npx` or `gh` command.
- A paragraph is one line; a list item may wrap. Emphasis `*`, strong `**`, list items `-`, compact tables `| --- |`.
- en-US in English prose; German only inside «», in code spans, in the `banned` fence, or in a quoted German example; no British stem outside code.
- The shared files name no agent vendor. Only the README's adapter recipe does.
- German marks: Sie, ss never ß, «» and ‹›, spaced en-dash, 16’000. English marks: spaced em-dash, 16,000.
- No number that still moves: no count of pages, values or findings in a shared file.
- Every commit is authored by the owner with a `Co-Authored-By` trailer, in the git register of `WRITING.md`, ending `Verified:`; commit only when the owner has asked for the plan to be executed.
- Nothing is merged, tagged or released without the owner's explicit word.

## Review Focus

- A member that syncs v1.29.0 must receive `GERMAN.md`, `EDITOR.md` and `BACKREADER.md`; a file added to the source but not to `FILES` vendors nothing and no check says so. Task 1's test pins it.
- The `banned` fence must stay machine-readable: one `form → replacement` a line, the arrow U+2192 with a space either side, no blank line, no comment. The design check parses it. Task 1 adds a test that reads it the way the check will.
- A German word in a shared file that happens to contain a British stem fails `conventions-check` in every member at once. Every task that writes German runs the check.
- The root `AGENTS.md` is the block every member's `check` compares its own against after `sync`; a block that no longer syncs cleanly fails every member. Task 5 runs `sh test/run.sh`, which syncs a member and checks it.
- The README's translator adapter still says it "hands back a back-translation per element"; a member copying the old recipe keeps the retired step. Task 5 replaces it and the wave plan carries it.

---

### Task 1: Vendor `GERMAN.md`, `EDITOR.md` and `BACKREADER.md`

**Files:**

- Create: `conventions/GERMAN.md`
- Create: `conventions/EDITOR.md`
- Create: `conventions/BACKREADER.md`
- Modify: `conventions/conventions-sync:22` (the `FILES=` line)
- Test: `test/run.sh:21` (the list sync must write) and a new assertion on the `banned` fence

**Interfaces:**

- Produces: `conventions/GERMAN.md` with a fence opened by exactly ```` ```banned ```` and closed by ```` ``` ````, one `form → replacement` per line. The design plan's check reads this block from a site's vendored `conventions/GERMAN.md`.

- [ ] **Step 1: Write the failing test**

In `test/run.sh`, line 21, add the three names to the list after `GLOSSARY.md`:

```sh
for f in WRITING.md WORKING.md REPOSITORIES.md WRITER.md TRANSLATOR.md GLOSSARY.md GERMAN.md EDITOR.md BACKREADER.md AGENTS.md conventions-sync conventions-check conventions-format markdown-rules.cjs vscode-settings.json vscode-extensions.json manifest.json; do
```

and, directly after that loop's `done`, add:

```sh
# The design check reads the refused forms from this block, one "form → replacement" a line.
banned=$(awk '/^```banned$/{f=1;next} /^```$/{f=0} f' "$MEMBER/conventions/GERMAN.md" 2>/dev/null || true)
if [ -n "$banned" ] && ! printf '%s\n' "$banned" | grep -qv '^[^→]\{1,\} → [^→]\{1,\}$'
then ok "GERMAN.md's banned block is one form → replacement a line"
else bad "GERMAN.md's banned block is missing or has a line that is not form → replacement"
fi
```

- [ ] **Step 2: Run the test to see it fail**

Run: `sh test/run.sh` Expected: exit 1, with `✗ sync did not write conventions/GERMAN.md`, the same for `EDITOR.md` and `BACKREADER.md`, and `✗ GERMAN.md's banned block is missing…`.

- [ ] **Step 3: Add the names to `FILES`**

`conventions/conventions-sync` line 22 becomes:

```sh
FILES="WRITING.md WORKING.md REPOSITORIES.md WRITER.md TRANSLATOR.md GLOSSARY.md GERMAN.md EDITOR.md BACKREADER.md AGENTS.md conventions-sync conventions-check conventions-format markdown-rules.cjs vscode-settings.json vscode-extensions.json"
```

- [ ] **Step 4: Write `conventions/GERMAN.md`**

Copy it byte for byte from the spec's appendix section "`conventions/GERMAN.md`": everything between the line ````` ````markdown ````` and the closing ````` ```` ````` below it, without those two fence lines. The file begins `# German` and ends with the row `| «Menschen richten sich schneller aus» | «Menschen finden schneller eine gemeinsame Linie» | *Align* word for word. |` and one newline.

- [ ] **Step 5: Write `conventions/EDITOR.md` and `conventions/BACKREADER.md`**

Copy each byte for byte from the spec's appendix sections "`conventions/EDITOR.md`" and "`conventions/BACKREADER.md`", the same way as Step 4. `EDITOR.md` begins `# Editor`; `BACKREADER.md` begins `# Back-reader`.

- [ ] **Step 6: Run the tests and the checks**

Run: `sh test/run.sh; echo exit=$?` Expected: `exit=0`, with `✓ GERMAN.md's banned block is one form → replacement a line`.

Run: `sh conventions/conventions-check; echo exit=$?` and `sh conventions/conventions-format; echo exit=$?` Expected: `✓ every Markdown file follows WRITING.md`, `exit=0`; `✓ every Markdown file is in the family's form`, `exit=0`. If the form check fails, run `sh conventions/conventions-format fix`, read the diff, and run it again.

- [ ] **Step 7: Commit**

```bash
git add conventions/GERMAN.md conventions/EDITOR.md conventions/BACKREADER.md conventions/conventions-sync test/run.sh
git commit -m "$(cat <<'EOF'
The German has an editor, a back-reader and a file of its own

A back-translation by the translator checks meaning and cannot see a calque, a stiff sentence or a word from Germany, and a translator reads back what it meant. The German now has an editor that reads it without the English and a back-reader that renders it literally without having seen the original, and GERMAN.md holds the Swiss words, the translator's habits, the forms a check refuses and the owner's choices. All three are vendored.

Verified: sh test/run.sh, conventions-check and conventions-format pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Rewrite `TRANSLATOR.md`

**Files:**

- Modify: `conventions/TRANSLATOR.md` (whole file)

**Interfaces:**

- Consumes: `GERMAN.md` and `BACKREADER.md` from Task 1, which the new text names.

- [ ] **Step 1: Replace the file**

Replace `conventions/TRANSLATOR.md` with the spec's appendix section "`conventions/TRANSLATOR.md`", byte for byte, without the fence lines. It begins `# Translator` and its last section is `## Before it reports`.

- [ ] **Step 2: Confirm the retired step is gone**

Run: `grep -n 'back-translation' conventions/TRANSLATOR.md` Expected: exactly one line, the sentence saying it writes no back-translation because the back-reader does. As a positive control, `git show main:conventions/TRANSLATOR.md | grep -c 'back-translation'` prints at least `2`.

- [ ] **Step 3: Run the checks**

Run: `sh test/run.sh; echo exit=$?`, `sh conventions/conventions-check; echo exit=$?`, `sh conventions/conventions-format; echo exit=$?` Expected: all three `exit=0`.

- [ ] **Step 4: Commit**

```bash
git add conventions/TRANSLATOR.md
git commit -m "$(cat <<'EOF'
The translator makes a page's German, not an element's

A sentence translated alone loses what it refers to and blurs page and site, so the translator now takes a whole page, keeps the German already there where it is right, may restructure but never drop a word that carries meaning, and lists its doubts. It writes no back-translation of its own; the back-reader does, without the English.

Verified: sh test/run.sh, conventions-check and conventions-format pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The owner's terms in `GLOSSARY.md`

**Files:**

- Modify: `conventions/GLOSSARY.md` (the table's last row, and the line under the table)

- [ ] **Step 1: Append the rows**

Directly after the table's last row, the `Swiss Standard German` row, and before the blank line that ends the table, insert:

```markdown
| site | site | `Website` | A site of several pages. `Seite` is one page of it, and a sentence about the whole site that says `Seite` contradicts itself on a page whose own text is English. |
| page | page | `Seite` | One page of a site. |
| company | company | `Firma` | The owner's choice over `Unternehmen`, feminine, `die Firma`. `Unternehmensführung` stays, a fixed term for the discipline rather than a word for one company. |
| company of one | company of one | `Ein-Personen-Firma` | One compound, as German writes it, not the phrase `Firma aus einer Person`. |
| decision | decision | `Entscheid` | A decision taken, the Swiss form. `Entscheidung` stays for the act of deciding, as in `Entscheidungshilfe`. |
| release | release | `Release` | A tagged release. Kept English like `Build` and `Commit`, and neuter, `das Release`; `Freigabe` is a gate's approval and is not meant. |
| deck | deck | `Präsentation` | The file a talk is given from. Feminine, `die Präsentation`; the talk itself is `Vortrag`. |
| meter | meter | `Abrechnungsgrösse` | The one unit a bill is computed from. Not `Zähler`, which reads as a device. |
| career break | career break | `Auszeit` | Alone, not `berufliche Auszeit`; the sentence around it says it is from work. |
| role | role | `Rolle` | A position held, as the Role kind is. Never `Stelle`, which is the employment itself. |
| independent period | independent period | `Phase der Selbständigkeit` | The prose around the Independent kind, whose name stays English in both views. |
| standard | standard | `Massstab` | A yardstick. Not `Anspruch`, which is this table's claim. |
| takeaway | takeaway | `Fazit` | The label that closes a talk's argument. |
| Software Engineer & Architect | Software Engineer & Architect | `Software Engineer & Architect` | The owner's title, English in both views, as Swiss IT titles usually are; in a sentence, `Software Engineer und Architect`. |
```

- [ ] **Step 2: Drop `deck` from the unchosen list**

The line under the table becomes:

```markdown
English forms fixed here whose German no page carries yet, to be chosen the first time a text needs them: pack, design system.
```

- [ ] **Step 3: Run the checks**

Run: `sh conventions/conventions-check; echo exit=$?`, `sh conventions/conventions-format; echo exit=$?` Expected: both `exit=0`. The German cells are in code spans, so the prose check reads none of them.

- [ ] **Step 4: Commit**

```bash
git add conventions/GLOSSARY.md
git commit -m "$(cat <<'EOF'
Fourteen terms have one German form, chosen by the owner

The review of the three sites found the same thing said two ways across pages — Firma and Unternehmen, Seite for a whole site, Stelle and Rolle — and the owner chose one form for each, with deck at last. Each row says what it is not, because the form it replaces is the one the next translator reaches for.

Verified: conventions-check and conventions-format pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `WRITING.md` and `WORKING.md` say the process as it runs

**Files:**

- Modify: `conventions/WRITING.md` (Languages, second paragraph; How a text is made, third and fourth paragraphs; German, last paragraph)
- Modify: `conventions/WORKING.md` (Branches and commits, fourth paragraph)

- [ ] **Step 1: The Languages paragraph**

In the Languages section's second paragraph, replace the two sentences from `The German is a translation of the English, made after the owner has reviewed the English and never before,` through `and the family has one reader for it.` with:

```markdown
The German is a translation of the English, made after the owner has reviewed the English and never before, in the forms Switzerland uses and the words `GERMAN.md` keeps. It is made by roles that never check their own work, because the German's faults are the kind its own author cannot see: a translator writes it, an editor reads it without the English, and a back-reader renders it into literal English for a comparison with the original. The owner reads only the sentences the editor could not settle, in German, and picks from the alternatives it offers; a back-translation alone checks meaning and is blind to whether the text reads as German, which is where the pages' faults were.
```

The paragraph's first two sentences and its last three, from `It appears only where a page carries it` on, stay as they are.

- [ ] **Step 2: How a text is made**

Replace the section's third paragraph, the one beginning `The translator of \`TRANSLATOR.md\` makes the German`, with:

```markdown
The translator of `TRANSLATOR.md` makes the German of a whole page from its reviewed English, with `GLOSSARY.md` and `GERMAN.md` open. The editor of `EDITOR.md` reads that German without the English, corrects what a rule decides and flags what is a choice. The back-reader of `BACKREADER.md` renders the German into literal English without having seen the original, and the session that dispatched them sets the English against that rendering and sends back every value whose meaning moved. The owner then reads the flags and picks; a term choice becomes a row of `GLOSSARY.md`, and a sentence choice that generalizes becomes a row of `GERMAN.md`. German made from a draft is German that has to be made again, and an English edit re-runs the roles on the values it touched.
```

and the fourth paragraph, `Both roles edit files and neither commits. \`WORKING.md\` says who does.`, with:

```markdown
The writer and the translator edit files, the editor and the back-reader only report, and none of them commits. `WORKING.md` says who does.
```

- [ ] **Step 3: The German section**

Append to the German section's last paragraph, after `and a noun where English reached for a gerund.`:

```markdown
 The words are `GERMAN.md`'s: the Swiss word where Switzerland and Germany write different ones, the habits that make German read translated, and the forms a check refuses.
```

(one space, then the sentence, on the same line as the paragraph.)

- [ ] **Step 4: `WORKING.md`**

In Branches and commits, fourth paragraph, replace the sentence `A role invoked as a subagent, the writer of \`WRITER.md\` or the translator of \`TRANSLATOR.md\`, edits files and reports; it never commits, and the session that invoked it proposes the message.` with:

```markdown
A role invoked as a subagent — the writer of `WRITER.md`, the translator of `TRANSLATOR.md`, the editor of `EDITOR.md` or the back-reader of `BACKREADER.md` — edits files or only reports, as its own file says; it never commits, and the session that invoked it proposes the message.
```

- [ ] **Step 5: Check the retired rule is gone and the checks pass**

Run: `grep -n "back-translation beside each element\|one element at a time\|reading the translator's back-translation" conventions/WRITING.md` Expected: no output. Positive control: `git show main:conventions/WRITING.md | grep -c "back-translation beside each element\|one element at a time\|reading the translator's back-translation"` prints `2`.

Run: `sh test/run.sh; echo exit=$?`, `sh conventions/conventions-check; echo exit=$?`, `sh conventions/conventions-format; echo exit=$?` Expected: all three `exit=0`.

- [ ] **Step 6: Commit**

```bash
git add conventions/WRITING.md conventions/WORKING.md
git commit -m "$(cat <<'EOF'
The owner reads the German the editor could not settle

WRITING.md said the German is reviewed by the translator's back-translation, a minute's read. A German-only review of the sites showed that read catches a small share of what is wrong, because a calque reads back as the English it came from. The Languages section and How a text is made now describe the four roles and the owner's pick, the German section points to GERMAN.md for words, and WORKING.md names all four roles that run as subagents.

Verified: sh test/run.sh, conventions-check and conventions-format pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The block and the README recipe

**Files:**

- Modify: `AGENTS.md:7-8` (the block's roles line)
- Modify: `README.md:8-9` (the file list) and the adapter recipe from `Then two agent adapters` to the paragraph after the translator adapter

- [ ] **Step 1: The block**

In `AGENTS.md`, replace the list item

```markdown
- `conventions/WRITER.md`, `conventions/TRANSLATOR.md`, `conventions/GLOSSARY.md` — the two roles that
  make a text, and the terms they keep.
```

with

```markdown
- `conventions/WRITER.md`, `conventions/TRANSLATOR.md`, `conventions/EDITOR.md`,
  `conventions/BACKREADER.md`, `conventions/GLOSSARY.md`, `conventions/GERMAN.md` — the four roles
  that make a text, the terms they keep and the German they write.
```

The root `AGENTS.md` is the only copy in this repository; a member's `conventions/AGENTS.md` is written from it by `sync` at the member's end, which is what `sh test/run.sh` exercises in Step 5.

- [ ] **Step 2: The README file list**

Replace README lines 8 and 9 with:

```markdown
- `conventions/WRITER.md`, `conventions/TRANSLATOR.md`, `conventions/EDITOR.md` and `conventions/BACKREADER.md` — the four roles that make a text: what each takes, produces and never does.
- `conventions/GLOSSARY.md` — every family term in its fixed English and German form.
- `conventions/GERMAN.md` — what Swiss Standard German asks beyond its marks: the Swiss words, the habits to avoid, the forms a check refuses and the owner's choices.
```

- [ ] **Step 3: The adapter recipe**

Replace `Then two agent adapters, written once beside` with `Then four agent adapters, written once beside`. Replace the whole `.claude/agents/translator.md` block and its lead-in with:

````markdown
And `.claude/agents/translator.md`:

```markdown
---
name: translator
description: Makes the Swiss Standard German of a page whose English the owner has reviewed, from the English and against the German already there, and reports each value it changed with a reason. Use it only after the English review, never on a draft; the editor and the back-reader follow it.
tools: Read, Grep, Glob, Edit
---
Read `conventions/WRITING.md`, `conventions/GLOSSARY.md`, `conventions/GERMAN.md` and `conventions/TRANSLATOR.md` before anything else, and follow them. Report in the reply register of `WRITING.md`: per value you changed, the German and one line of why; then your doubts with the options you weighed; and any element you left because its English is not reviewed.
```

`.claude/agents/editor.md`:

```markdown
---
name: editor
description: Reads a page's Swiss Standard German without the English, corrects it by rule and flags what the owner should choose. Use it after the translator, never with the English in its input.
tools: Read, Grep, Glob
---
Read `conventions/WRITING.md`, `conventions/GLOSSARY.md`, `conventions/GERMAN.md` and `conventions/EDITOR.md` before anything else, and follow them. Read only the German you are given; never open a file that holds the page's English.
```

And `.claude/agents/backreader.md`:

```markdown
---
name: backreader
description: Renders a page's Swiss Standard German into literal English without having seen the English, so the dispatching session can see what the German actually says. Use it after the editor.
tools: Read
---
Read `conventions/BACKREADER.md` before anything else, and follow it. Read only the German you are given; never open a file that holds the page's English.
```
````

and replace the paragraph after it, `Both read and edit files and nothing else: no shell and no git, because a role edits and reports and the session that invoked it commits when the owner asks.`, with:

```markdown
None has a shell or git, because a role edits or reports and the session that invoked it commits when the owner asks. The editor and the back-reader cannot edit either: what they return is written by the session that holds the English, since the one thing each of them must not do is read it.
```

- [ ] **Step 4: Confirm nothing still offers the retired step**

Run: `grep -rn 'back-translation per element\|two agent adapters\|the two roles' README.md AGENTS.md conventions/` Expected: no output. Positive control: `git show main:README.md | grep -c 'back-translation per element'` prints `1`.

- [ ] **Step 5: Run everything**

Run: `sh test/run.sh; echo exit=$?`, `sh conventions/conventions-check; echo exit=$?`, `sh conventions/conventions-format; echo exit=$?` Expected: all three `exit=0`.

- [ ] **Step 6: Commit and open the pull request**

```bash
git add AGENTS.md README.md
git commit -m "$(cat <<'EOF'
Members are told of four roles and given four adapters

The block names the editor, the back-reader and GERMAN.md beside the writer, the translator and the glossary, and the README recipe gives a member the two new adapters and a translator adapter that no longer asks for a back-translation. The editor and the back-reader get no Edit tool, because the session that writes their values is the one that holds the English they must not read.

Verified: sh test/run.sh, conventions-check and conventions-format pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
git -c credential.helper= -c credential.helper='!gh auth git-credential' push https://github.com/robertblust/conventions.git german-pipeline
git fetch -q origin && git branch -u origin/german-pipeline
gh pr create --repo robertblust/conventions --base main --head german-pipeline --title "The German is made by four roles and read by the owner where it matters" --body-file <(cat <<'EOF'
A German-only review of blust.ch, guestgraph.io and companygraph.io found the pages' German correct in its marks and weak as German, and found that the translator's own back-translation — the only review the German had — catches a small share of it, because a calque reads back as the English it came from and a translator reads back what it meant. The design is `docs/superpowers/specs/2026-09-24-german-pipeline-design.md`, piloted on blust.ch before it was written down; this pull request is its conventions part.

The German is now made by a translator working a whole page, an editor that reads the German without the English, and a back-reader that renders it literally without having seen the original; the owner reads only the sentences the editor flags and picks. `GERMAN.md` holds the Swiss words, the translator's habits, the forms the design check will refuse and the owner's choices; fourteen glossary rows record the owner's terms. `WRITING.md`, `WORKING.md`, the block and the README recipe say the process as it runs, and the recipe gives members an editor and a back-reader adapter. The release marker, the member wave, the design check and the site passes follow separately.

Verified: sh test/run.sh, conventions-check and conventions-format pass on the branch.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)
```

Then stop: report the pull request's number and its check, and merge only on the owner's word.

---

### Task 6: The release marker moves to v1.29.0

Runs only after the pull request of Task 5 is merged, on the owner's word.

**Files:**

- Modify: `AGENTS.md:1` (the version marker)
- Modify: `.github/workflows/check.yml:8` (`CONVENTIONS_RELEASE`)

- [ ] **Step 1: Branch from the merged main**

```bash
cd ~/git/robertblust/conventions && git pull -q --ff-only
git worktree add -q -b the-release-marker-moves-to-v1-29-0 ../conventions-the-release-marker-moves-to-v1-29-0 main
cd ../conventions-the-release-marker-moves-to-v1-29-0
```

- [ ] **Step 2: Move the marker in all three places**

```bash
sed -i '' 's/<!-- conventions · v1.28.0 -->/<!-- conventions · v1.29.0 -->/' AGENTS.md
sed -i '' 's/CONVENTIONS_RELEASE: v1.28.0/CONVENTIONS_RELEASE: v1.29.0/' .github/workflows/check.yml
grep -n 'v1.2[89].0' AGENTS.md .github/workflows/check.yml
```

Expected: two lines, each `v1.29.0`, none `v1.28.0`.

- [ ] **Step 3: Run the tests**

Run: `sh test/run.sh; echo exit=$?` Expected: `exit=0`; the test that holds the declared release to the marker passes.

- [ ] **Step 4: Commit, push and open the pull request**

```bash
git add AGENTS.md .github/workflows/check.yml
git commit -m "$(cat <<'EOF'
The release marker moves to v1.29.0

v1.29.0 is the German pipeline: an editor and a back-reader beside the translator, GERMAN.md, fourteen glossary rows, and a translator that works a page and writes no back-translation. A member takes it with one sync and the usual pin and workflow line; the two new adapters are its own files, from the README recipe.

Verified: sh test/run.sh passes.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
git -c credential.helper= -c credential.helper='!gh auth git-credential' push https://github.com/robertblust/conventions.git the-release-marker-moves-to-v1-29-0
gh pr create --repo robertblust/conventions --base main --head the-release-marker-moves-to-v1-29-0 --title "The release marker moves to v1.29.0" --body "The marker for the German pipeline release, in AGENTS.md's first line and check.yml's CONVENTIONS_RELEASE. Verified: sh test/run.sh passes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Then stop for the owner's word to merge.

- [ ] **Step 5: Tag and release, on the owner's word**

After the marker pull request is merged:

```bash
cd ~/git/robertblust/conventions && git pull -q --ff-only
git tag -a v1.29.0 -m "v1.29.0 — the German pipeline" "$(git rev-parse HEAD)"
git -c credential.helper= -c credential.helper='!gh auth git-credential' push https://github.com/robertblust/conventions.git v1.29.0
```

and, as a separate command:

```bash
gh release create v1.29.0 --repo robertblust/conventions --title "v1.29.0" --notes "$(cat <<'EOF'
The German of the pages is made by four roles and read by the owner where it matters.

What changed for a member: three new vendored files, GERMAN.md, EDITOR.md and BACKREADER.md; TRANSLATOR.md rewritten to work a whole page and write no back-translation; fourteen glossary rows; WRITING.md, WORKING.md and the block describing the process. Nothing breaks.

How to take it: set the tag in conventions.json and the check.yml@ line to v1.29.0 and run sh conventions/conventions-sync sync once. Where the member has .claude/agents/translator.md, replace it with the README's new translator adapter and add editor.md and backreader.md from the same recipe.
EOF
)"
```

Remove the marker worktree and branch by name after the merge: `git worktree remove ../conventions-the-release-marker-moves-to-v1-29-0 && git branch -d the-release-marker-moves-to-v1-29-0`, and the pipeline worktree the same way with `german-pipeline`.

---

## After this plan

Three plans follow, each written once the one before it is merged:

1. **The member wave to v1.29.0**, in `REPOSITORIES.md` order, one pull request each, with the three adapters where a member carries `translator.md`.
2. **Design**: the three `typography` rules, `german-stale`, the `translates` element form, `design german` and the generated note, one release.
3. **blust.ch from the pilot**: the German in the worktree `robertblust.github.io-german-pilot`, the design re-pin, `npm run pages`, `npm run og`, the narration on the owner's word; then the guestgraph.io and companygraph.io passes.
