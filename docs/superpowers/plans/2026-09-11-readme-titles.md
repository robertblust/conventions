# README titles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A member's README title is its row in `REPOSITORIES.md`, and `conventions-check` holds it there.

**Architecture:** Three files move in the conventions repository. `REPOSITORIES.md` gains a `Title` column that spells out all thirteen titles, `WRITING.md` gains the paragraph that says how a title is built, and `conventions-check` gains a third tripwire that runs once after the Markdown walk, learns the member's identity, finds its row and compares the first line of `README.md` to it. The data lands before the check so the repository is never red on its own rule. The six member README edits ride each member's re-sync pull request after the tag.

**Tech Stack:** POSIX `sh`, `awk`, `sed`, `grep`, `find`; `shellcheck` in CI; `test/run.sh` as the suite.

**Spec:** `docs/superpowers/specs/2026-09-11-readme-titles-design.md`

**Branch:** `readme-titles`, continuing from the spec commit `cb7e05d`. Spec and implementation land together in [#14](https://github.com/robertblust/conventions/pull/14); its body is updated at Task 3 to say so.

## Global Constraints

- Prose follows `conventions/WRITING.md`: American spelling, the spaced em-dash `—` and never a closed one, paragraphs over lists, no adjective that sells.
- Commit messages and the pull request body follow the git register of `WRITING.md`: a subject under seventy characters with no type prefix and no trailing period, one to three paragraphs of body, a final `Verified:` line, then the trailers.
- Every commit carries `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- The scripts are POSIX `sh` and pass `shellcheck conventions/conventions-sync conventions/conventions-check test/run.sh`, which CI runs as its first step.
- `conventions-check` may use `sh`, `awk`, `sed`, `grep` and `find`. `git` is consulted only when it is present and only when `$ROOT/.git` exists; its absence is a quiet pass, never a failure.
- The release is **v1.10.0**. Nothing in this plan tags it; the tag and the GitHub Release are the owner's act.
- Nothing in this plan merges a pull request.

---

### Task 1: The data — the Title column, the rule, and this repository's own title

The check in Task 2 reads `REPOSITORIES.md` and `README.md`. Both must already be right, or the commit that adds the check turns this repository's own CI red. So the data lands first and on its own.

**Files:**
- Modify: `conventions/REPOSITORIES.md` — the intro paragraph and the table
- Modify: `conventions/WRITING.md` — one paragraph in the prose register
- Modify: `README.md:1` — the title of this repository

- [ ] **Step 1: Add the `Title` column to the table**

In `conventions/REPOSITORIES.md`, replace the header, the separator and all thirteen rows. The column goes between `Repository` and `Purpose`: the title is what the repository calls itself and the purpose is the sentence about it, and a reader scans them in that order. The `Purpose`, `Default branch` and `Local path` cells are unchanged, copied verbatim from the current table.

```markdown
| Repository | Title | Purpose | Default branch | Local path |
|---|---|---|---|---|
| robertblust/conventions | Robert Blust — Conventions | how the family writes and works, vendored by every member | main | ~/git/robertblust/conventions |
| robertblust/design | Robert Blust — Design | the design system shared by the three sites: tokens, chrome, page checks | main | ~/git/robertblust/design |
| robertblust/robertblust.github.io | blust.ch | blust.ch, the profile page and two talks | main | ~/git/robertblust/robertblust.github.io |
| robertblust/mental-model | Robert Blust — Mental Model | Robert Blust described in CompanyGraph, the reference instance | main | ~/git/robertblust/mental-model |
| robertblust/field-notes | Robert Blust — Field Notes | problems that took real work to understand, one file each | main | ~/git/robertblust/field-notes |
| guestgraph/guestgraph.github.io | guestgraph.io | guestgraph.io, the landing page and the intro talk | main | ~/git/guestgraph/guestgraph.github.io |
| guestgraph/engine | GuestGraph — Engine | identity resolution, guest graph and REST API, the open core | main | ~/git/guestgraph/engine |
| guestgraph/connector-apaleo | GuestGraph — Apaleo Connector | the Apaleo connector: reservations and bookings into the guest graph, a client of the engine's API | main | ~/git/guestgraph/connector-apaleo |
| guestgraph/service-conventions | GuestGraph — Service Conventions | the code-level rules of the guestgraph services: one list, one directory per stack, vendored by every service at a pinned release | main | ~/git/guestgraph/service-conventions |
| guestgraph/.github | GuestGraph — Organization | the organization profile GitHub shows, and nothing else | main | ~/git/guestgraph/.github |
| companygraph/companygraph.github.io | companygraph.io | companygraph.io, the landing page, the model and example pages, the intro talk | main | ~/git/companygraph/companygraph.github.io |
| companygraph/meta-model | CompanyGraph — Meta Model | the meta-model: core vocabulary, packs and the conventions that make a graph of Markdown checkable | main | ~/git/companygraph/meta-model |
| companygraph/.github | CompanyGraph — Organization | the organization profile GitHub shows, and nothing else | main | ~/git/companygraph/.github |
```

- [ ] **Step 2: Say what the column is**

In the same file, the intro paragraph above the table currently ends `CLAUDE.md` is the same four-line vendor adapter everywhere.` Append one sentence to that paragraph:

```markdown
The `Title` column is the member's README title in full, the string its first line carries
after `# `, and a tripwire in `conventions-check` holds each member to its own row.
```

- [ ] **Step 3: Write the rule into the prose register**

In `conventions/WRITING.md`, in `## The prose register`, immediately after the paragraph beginning `Paragraphs by default.`, insert a blank line and this paragraph:

```markdown
A repository's `README.md` opens with an H1 of the brand, a spaced em-dash and the thing:
`CompanyGraph — Meta Model`. The brand is the organization as prose writes it, not as GitHub
spells the account; the thing is the repository in words, not in the hyphens a directory
needs. A reader arrives from a search result or a tab with no other context, and the brand is
the part they cannot recover from the path. A site repository is titled by its domain alone,
because the domain is already the brand and the thing, and `profile/README.md` in a `.github`
repository is the organization's front page rather than a repository's README and keeps its
own title. `REPOSITORIES.md` carries every member's title in full and a tripwire holds each
member to its row.
```

- [ ] **Step 4: Fix this repository's own title**

Replace line 1 of `README.md`:

```markdown
# Robert Blust — Conventions
```

- [ ] **Step 5: Run the prose tripwires and the suite**

The new prose must itself pass the spelling and em-dash tripwires, and nothing in the suite may move.

```bash
cd ~/git/robertblust/conventions
sh conventions/conventions-check; echo "check exit=$?"
sh test/run.sh; echo "suite exit=$?"
```

Expected: `✓ every Markdown file follows WRITING.md`, `check exit=0`, then `all pass` and `suite exit=0`. The exit code is read on its own because a pipe would hide it.

- [ ] **Step 6: Commit**

```bash
cd ~/git/robertblust/conventions
git add conventions/REPOSITORIES.md conventions/WRITING.md README.md
git commit -F- <<'MSG'
REPOSITORIES.md says what each member's README is titled

A title that is the directory name tells a reader what the path already told them and
withholds the one thing it did not, which of three organizations this belongs to. The
shape is the one four members already have: the brand, a spaced em-dash and the thing in
words, and a site keeps its domain alone because a domain is already both.

The Title column spells all thirteen out in full, so the exceptions need no clause
anywhere else: a site's row simply carries its domain. WRITING.md says how a title is
built for whoever writes the next one, and this repository's own title moves first
because the check that arrives next runs here too.

Verified: conventions-check and test/run.sh pass.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
```

---

### Task 2: The tripwire

**Files:**
- Modify: `test/run.sh` — a new section after the prose-tripwire section, before the `# the workflow's declared release` block at the end
- Modify: `conventions/conventions-check` — the header comment, and a block between the walk and the exit
- Modify: `docs/superpowers/specs/2026-09-11-readme-titles-design.md:§5` — the example failure line

**Interfaces:**
- Consumes: the `Title` column written in Task 1; `$ROOT` and the `hits` variable already in `conventions-check`.
- Produces: the environment variable `CONVENTIONS_REPO`, which overrides identity and is how any test drives the check from a tree that is not a clone. Failure lines are `✗ README.md:1: first line is "<first>", REPOSITORIES.md asks for "# <title>"` and `✗ README.md: <owner/repo> is in REPOSITORIES.md and has no README.md`. Quiet passes are `·` lines.

- [ ] **Step 1: Write the failing tests**

Append to `test/run.sh`, after the line `printf 'A generalist with realism, …' > "$P/docs/kept/a.md"` block that closes the prose section, and before the `# the workflow's declared release and the marker version cannot drift apart` comment:

```sh
# --- conventions-check: the README title -----------------------------------------------------
# A fixture, not a clone: CONVENTIONS_REPO is what a tree with no remote and no runner uses to
# say which row is its own. The table here is two rows of the real shape, one ordinary member
# and one site, because the site is the case that must need no clause in the check.
T=$TMP/title
mkdir -p "$T/conventions"
tcheck() { (cd "$T" && CONVENTIONS_REPO="$1" sh "$HERE/conventions/conventions-check"); }
printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0" }\n' > "$T/conventions.json"
cat > "$T/conventions/REPOSITORIES.md" <<'EOF'
# Repositories

| Repository | Title | Purpose | Default branch | Local path |
|---|---|---|---|---|
| robertblust/design | Robert Blust — Design | the design system | main | ~/git/robertblust/design |
| robertblust/robertblust.github.io | blust.ch | the profile page | main | ~/git/robertblust/robertblust.github.io |
EOF

printf '# Robert Blust — Design\n\nThe design system.\n' > "$T/README.md"
if tcheck robertblust/design > /dev/null
then ok "a README whose title is its row passes"
else bad "a matching title failed: $(tcheck robertblust/design 2>&1)"
fi

printf '# @robertblust/design\n\nThe design system.\n' > "$T/README.md"
out=$(tcheck robertblust/design 2>&1 || true)
if echo "$out" | grep -q 'README.md:1: first line is "# @robertblust/design", REPOSITORIES.md asks for "# Robert Blust — Design"'
then ok "a wrong title names what was found and what the row asks for"
else bad "a wrong title was not named: $out"
fi

printf 'Robert Blust — Design\n\nNo H1 at all.\n' > "$T/README.md"
out=$(tcheck robertblust/design 2>&1 || true)
if echo "$out" | grep -q 'first line is "Robert Blust — Design", REPOSITORIES.md asks for "# Robert Blust — Design"'
then ok "a first line that is not an H1 is told apart from the title it resembles"
else bad "a missing H1 was not distinguished: $out"
fi

printf '# blust.ch\n\nThe profile page.\n' > "$T/README.md"
if tcheck robertblust/robertblust.github.io > /dev/null
then ok "a site's row is its domain and needs no clause in the check"
else bad "a site row failed: $(tcheck robertblust/robertblust.github.io 2>&1)"
fi

printf '# Robert Blust — Design\n\nThe design system.\n' > "$T/README.md"
out=$(tcheck robertblust/somewhere-else 2>&1 || true)
if echo "$out" | grep -q 'robertblust/somewhere-else is not in REPOSITORIES.md'
then ok "a repository outside the family is not held to the list"
else bad "a repository outside the family was held to the list: $out"
fi

out=$( (cd "$T" && unset CONVENTIONS_REPO GITHUB_REPOSITORY; sh "$HERE/conventions/conventions-check") 2>&1 || true)
if echo "$out" | grep -q 'no repository identity here'
then ok "a tree with no identity passes with a line saying why"
else bad "a tree with no identity did not pass quietly: $out"
fi

mv "$T/conventions/REPOSITORIES.md" "$T/conventions/REPOSITORIES.md.away"
out=$(tcheck robertblust/design 2>&1 || true)
if echo "$out" | grep -q 'no conventions/REPOSITORIES.md here'
then ok "a tree that has not vendored the list passes with a line saying why"
else bad "a tree without the list did not pass quietly: $out"
fi
mv "$T/conventions/REPOSITORIES.md.away" "$T/conventions/REPOSITORIES.md"
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd ~/git/robertblust/conventions
sh test/run.sh; echo "exit=$?"
```

Expected: FAIL. Seven `✗` lines from the new section — a matching title "fails" because nothing checks it and nothing is reported, and every `grep -q` for a `·` or `✗` line finds nothing. The run ends `7 failing` and `exit=1`.

- [ ] **Step 3: Write the tripwire**

In `conventions/conventions-check`, replace the last two lines of the header comment block, which currently read:

```sh
# Needs sh, awk, sed, grep and find. Nothing else. CONVENTIONS_ROOT overrides the directory
# scanned, which is how the tests point it at a fixture.
```

with:

```sh
# Needs sh, awk, sed, grep and find. git is asked for the member's identity when it is there
# and skipped when it is not. CONVENTIONS_ROOT overrides the directory scanned and
# CONVENTIONS_REPO the identity read, which is how the tests point it at a fixture.
```

Then, between the `hits=$(…)` block and the `if [ -n "$hits" ]` block at the end of the file, insert:

```sh
# --- the README title ------------------------------------------------------------------------
# The two tripwires above are properties of a line; this one is a property of the repository, so
# it runs once, after the walk. The identity is not in conventions.json: the "repo" there names
# where the vendored files come from, robertblust/conventions, and reads the same in every
# member. So it is the runner's GITHUB_REPOSITORY, else the origin remote of a checkout whose
# own root is the tree being scanned — an ancestor's remote would answer for a repository the
# scan never opened — and CONVENTIONS_REPO overrides both. No identity, no row and no vendored
# list are each a quiet pass with its reason: a worktree, a fixture and a repository outside the
# family are not failures of the prose, and a tripwire that fails there fails for a reason that
# has nothing to do with the change under it.
LIST=$ROOT/conventions/REPOSITORIES.md
README=$ROOT/README.md
title_hit=""

self=${CONVENTIONS_REPO:-${GITHUB_REPOSITORY:-}}
if [ -z "$self" ] && [ -e "$ROOT/.git" ]; then
  self=$(git -C "$ROOT" remote get-url origin 2>/dev/null || true)
  self=$(printf '%s' "$self" | sed -e 's/\.git$//' -e 's#.*[:/]\([^/][^/]*/[^/][^/]*\)$#\1#')
fi

if [ -z "$self" ]; then
  echo "· conventions: no repository identity here, so the README title is not checked"
elif [ ! -f "$LIST" ]; then
  echo "· conventions: no conventions/REPOSITORIES.md here, so the README title is not checked"
else
  # The row is found on its first cell and the title is its second. A separator row and a
  # heading never carry an owner/repo in that cell, so neither can match.
  want=$(awk -F'|' -v repo="$self" '
    /^\|/ {
      name = $2; gsub(/^[ \t]+|[ \t]+$/, "", name)
      if (name == repo) { t = $3; gsub(/^[ \t]+|[ \t]+$/, "", t); print t; exit }
    }' "$LIST")
  if [ -z "$want" ]; then
    echo "· conventions: $self is not in REPOSITORIES.md, so the README title is not checked"
  elif [ ! -f "$README" ]; then
    title_hit="✗ README.md: $self is in REPOSITORIES.md and has no README.md"
  else
    # Whole lines are compared, the "# " included, so a first line that is not a heading is
    # told apart from the title it otherwise matches. Trailing whitespace and a CR are dropped
    # because neither is visible to the reader the title is for.
    first=$(sed -n '1p' "$README" | sed -e 's/\r$//' -e 's/[[:space:]]*$//')
    if [ "$first" != "# $want" ]; then
      title_hit="✗ README.md:1: first line is \"$first\", REPOSITORIES.md asks for \"# $want\""
    fi
  fi
fi
```

Then replace the final block:

```sh
if [ -n "$hits" ]; then
  echo "$hits"
  exit 1
fi
echo "✓ every Markdown file follows WRITING.md"
```

with:

```sh
if [ -n "$hits" ] || [ -n "$title_hit" ]; then
  if [ -n "$hits" ]; then echo "$hits"; fi
  if [ -n "$title_hit" ]; then echo "$title_hit"; fi
  exit 1
fi
echo "✓ every Markdown file follows WRITING.md"
```

The `if`/`fi` form is deliberate: `[ -n "$hits" ] && echo "$hits"` is an AND-list whose own status is 1 when the test is false, and `set -e` would exit on it.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd ~/git/robertblust/conventions
sh test/run.sh; echo "exit=$?"
shellcheck conventions/conventions-sync conventions/conventions-check test/run.sh; echo "shellcheck exit=$?"
sh conventions/conventions-check; echo "check exit=$?"
```

Expected: `all pass` and `exit=0`; `shellcheck exit=0` with no output; and the check on this repository itself printing `✓ every Markdown file follows WRITING.md` with `check exit=0`, because Task 1 gave it both the column and the title it now demands.

- [ ] **Step 5: Amend the spec's example line**

Drafting the message showed the spec's §5 example is wrong in the one case that matters. A first line that is not an H1 would print `title is "Robert Blust — Design", REPOSITORIES.md says "Robert Blust — Design"` — two identical strings and no way to see the difference. In `docs/superpowers/specs/2026-09-11-readme-titles-design.md`, replace the fenced example:

```
✗ README.md:1: first line is "# @robertblust/design", REPOSITORIES.md asks for "# Robert Blust — Design"
```

and in the paragraph above it, replace `compares it to `# ` and the row's title` with `compares it to the row's title with its `# `, whole line against whole line`. In the paragraph below it, replace `A first line that is not an H1 at all is the same failure as a wrong one, reported with what was found` with `A first line that is not an H1 at all is the same failure as a wrong one, and comparing whole lines is what lets the message show the difference`.

- [ ] **Step 6: Commit**

```bash
cd ~/git/robertblust/conventions
git add conventions/conventions-check test/run.sh docs/superpowers/specs/2026-09-11-readme-titles-design.md
git commit -F- <<'MSG'
conventions-check holds a README title against its row

The two tripwires here read a line at a time, and a title is a property of the repository
rather than of any line, so this one runs once after the walk. The member's identity is
not in conventions.json, whose "repo" names where the vendored files come from and reads
the same in every member, so it is GITHUB_REPOSITORY, else the origin remote of a
checkout whose own root is the tree being scanned, and CONVENTIONS_REPO overrides both.

No identity, no row and no vendored list each pass with a line saying why. A worktree, a
fixture and a repository outside the family are not failures of the prose, and a tripwire
that goes red there goes red for a reason that has nothing to do with the change under
it. Whole lines are compared so that a first line which is not a heading is told apart
from the title it otherwise matches, which the spec's first example could not do.

Verified: test/run.sh passes with seven new cases, shellcheck is clean, and
conventions-check passes on this repository.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
```

---

### Task 3: The release and the pull request

**Files:**
- Modify: `AGENTS.md:1` — the marker version
- Modify: `.github/workflows/check.yml:8` — `CONVENTIONS_RELEASE`

**Interfaces:**
- Consumes: nothing from Task 2 but a green suite.
- Produces: the string `v1.10.0` in both places `test/run.sh` compares at the end of its run.

- [ ] **Step 1: Move both version strings**

They are the only two occurrences outside `docs/`, and the suite fails if they disagree.

`AGENTS.md` line 1:

```markdown
<!-- conventions · v1.10.0 -->
```

`.github/workflows/check.yml` line 8:

```yaml
  CONVENTIONS_RELEASE: v1.10.0
```

- [ ] **Step 2: Run the whole suite**

```bash
cd ~/git/robertblust/conventions
shellcheck conventions/conventions-sync conventions/conventions-check test/run.sh; echo "shellcheck exit=$?"
python3 -c "import yaml; [yaml.safe_load(open(f)) for f in ('.github/workflows/check.yml', '.github/workflows/ci.yml')]"; echo "yaml exit=$?"
sh test/run.sh; echo "suite exit=$?"
sh conventions/conventions-check; echo "check exit=$?"
```

Expected: every exit code `0`, and the suite's last new assertion reading `✓ check.yml's release and AGENTS.md's marker agree on v1.10.0`. These four commands are exactly what CI runs, in CI's order.

- [ ] **Step 3: Commit**

```bash
cd ~/git/robertblust/conventions
git add AGENTS.md .github/workflows/check.yml
git commit -F- <<'MSG'
The release is v1.10.0

A change to what every member vendors makes every copy stale, which is a minor here. The
marker and the workflow's declared release move together because the suite compares them
and a member calls the workflow at the tag its conventions.json names.

Verified: test/run.sh passes, including the assertion that the two agree on v1.10.0.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
git push
```

- [ ] **Step 4: Update the pull request body**

[#14](https://github.com/robertblust/conventions/pull/14) was opened saying it was the spec alone, and it now carries the implementation. Replace its body with the same text minus that sentence, plus what landed:

```bash
cd ~/git/robertblust/conventions
gh pr edit 14 --body "$(cat <<'BODY'
A reader arrives at a member from a search result or a tab and reads its README title before anything else. Four members answer with the organization and the thing, GuestGraph — Engine; six answer with the directory name, which tells the reader what the path already told them and withholds whose it is. The rule is the shape those four have: brand, spaced em-dash, thing in words.

REPOSITORIES.md carries every member's title in full, so the sites keep their domains and the check compares a string to a string without learning what a site is. conventions-check reads the member's identity from GITHUB_REPOSITORY or the origin remote, finds its row, and holds README.md's first line against it; a checkout with no identity and a repository with no row pass with a line saying why.

This carries the spec, the Title column, the rule in WRITING.md, the tripwire with seven test cases, and the v1.10.0 version strings. The six members whose titles move do it in their own re-sync pull requests, in the order REPOSITORIES.md prescribes, after the tag.

Verified: shellcheck, test/run.sh and conventions-check pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

- [ ] **Step 5: Report the check and stop**

```bash
cd ~/git/robertblust/conventions
gh pr checks 14
```

Expected: `test` passing. Report the result and stop. Merging is the owner's decision and the word for it is theirs; the tag and the GitHub Release follow the merge and are not in this plan.

---

### Task 4: The wave — gated on the tag

This task does not start until the owner has merged #14 and tagged v1.10.0. It touches twelve other repositories, one pull request each, and each one is a re-sync that moves the pin, the vendored folder and the member workflow's `check.yml@tag` line. What is new here is only the README line, and only for six of them.

The order is the one `conventions/REPOSITORIES.md` prescribes and this plan does not repeat: design, then the three sites, then mental-model and meta-model, then service-conventions, then the engine, then the connector, then field-notes, then the two `.github` repositories.

**The six first lines, old and new.** Every other member's README line 1 is already its row and is not touched.

| Repository | `README.md:1` becomes |
| --- | --- |
| robertblust/design | `# Robert Blust — Design` |
| robertblust/mental-model | `# Robert Blust — Mental Model` |
| robertblust/field-notes | `# Robert Blust — Field Notes` |
| guestgraph/connector-apaleo | `# GuestGraph — Apaleo Connector` |
| guestgraph/service-conventions | `# GuestGraph — Service Conventions` |

`robertblust/conventions` is the sixth and was fixed in Task 1.

- [ ] **Step 1: Confirm the gate**

```bash
cd ~/git/robertblust/conventions
git fetch --tags && git tag --list v1.10.0
gh release view v1.10.0 --json tagName,name 2>/dev/null || echo "no release yet"
```

Expected: `v1.10.0` and a release. If either is missing, stop: the wave has nothing to pin to.

- [ ] **Step 2: For each member, in the prescribed order, re-sync and fix the line**

The per-member shape, shown for design and identical for the rest but for the path and the title:

```bash
cd ~/git/robertblust/design
git checkout main && git pull && git checkout -b conventions-v1-10-0
sed -i '' 's#"tag": "v[0-9.]*"#"tag": "v1.10.0"#' conventions.json
sh conventions/conventions-sync sync
sed -i '' 's#conventions/.github/workflows/check.yml@v[0-9.]*#conventions/.github/workflows/check.yml@v1.10.0#' .github/workflows/*.yml
sed -i '' '1s/.*/# Robert Blust — Design/' README.md
sh conventions/conventions-check; echo "check exit=$?"
```

Expected: `✓ every Markdown file follows WRITING.md` and `check exit=0`. A member whose title is already its row skips the README line and runs the check to confirm.

The pattern is anchored on `conventions/.github/workflows/` and not on `check.yml@` alone, because `check.yml@` is a substring of `instance-check.yml@`: mental-model calls meta-model's `instance-check.yml` beside the conventions workflow, and the loose pattern moved that pin to a tag meta-model has never published. Whatever the wave, read `grep -rn "yml@" .github/workflows/` afterward and see that only the intended line moved.

- [ ] **Step 3: Commit and open each pull request, then stop**

One pull request per member, body in the git register, `Verified:` naming the check that ran. Report each check. Do not merge any of them: "commit and open the pull request" is not approval to merge, and twelve pull requests are twelve separate decisions.
