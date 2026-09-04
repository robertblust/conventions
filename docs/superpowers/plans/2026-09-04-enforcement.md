# Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** conventions v1.3.0 with a vendored prose check and a reusable workflow, and mental-model green under both as the first member.

**Architecture:** A second POSIX script, `conventions/conventions-check`, scans a member's Markdown for British stems and closed em-dashes after dropping fenced and inline code, honoring `exclude` in `conventions.json`. A reusable workflow, `.github/workflows/check.yml`, runs the sync check and the prose check under one job named `conventions` and refuses to run when its own tag differs from the member's pin. This repository runs the prose check on itself and drops its two private tripwires. mental-model takes v1.3.0, gains the workflow and a ruleset, and fixes its three spellings.

**Tech Stack:** POSIX `sh`, `awk`, `sed`, `grep`, `find`; GitHub Actions `workflow_call`; `gh` for the ruleset.

**Spec:** `docs/superpowers/specs/2026-09-04-enforcement-design.md`. One correction to it, made in Task 1: the source repository does not run `conventions-sync check` on itself, because its `conventions/` files are the source, not a copy, and a manifest of them would pin the source to a tag it is always ahead of on a branch. It runs `conventions-check` on itself, with its own `conventions.json` carrying only `exclude`, and the reusable workflow is proven by mental-model.

## Global Constraints

- Prose register in every Markdown file; git register in every commit; `Verified:` line and the co-author trailer on every commit.
- American English, spaced em-dash, no serial comma, curly quotes in prose; the German section of `WRITING.md` is untouched.
- `sh` only, `set -eu`, `shellcheck` clean; the local shellcheck is the scratch venv `…/scratchpad/sc/bin/shellcheck`, CI runs the runner's.
- Nothing under `conventions/` names a member, a check or a package elsewhere; `REPOSITORIES.md` excepted.
- Every exit code is read on its own, never through `| tail`.
- Merges and the tag wait for the owner's word.

---

### Task 1: `conventions-check`, test-first

**Files:**
- Modify: `test/run.sh` (append cases before the final line)
- Create: `conventions/conventions-check`
- Modify: `conventions/conventions-sync` (the `FILES` line)
- Modify: `docs/superpowers/specs/2026-09-04-enforcement-design.md` (section 3, one paragraph)

**Interfaces:**
- Produces: `sh conventions/conventions-check`, run from a member's root. Reads `exclude` from `conventions.json` as a JSON array of path prefixes relative to the root; an absent key is an empty list. Scans every `*.md` outside `.git/` and the excluded prefixes. Prints `✗ file:line: word` per hit, `✓ every Markdown file follows WRITING.md` and exit 0 when clean, exit 1 otherwise. Honors `CONVENTIONS_ROOT` as the directory to scan, default `.`.
- Produces: `conventions-check` in the sync script's `FILES`, so members receive it.

- [ ] **Step 1: Append the failing cases to `test/run.sh`**

Insert before the line `if [ "$fails" -eq 0 ]; then echo "all pass"; else echo "$fails failing"; exit 1; fi`:

```sh
# --- conventions-check: the prose tripwires, vendored ---------------------------------------
P=$TMP/prose
mkdir -p "$P/docs/kept" "$P/vendored"
pcheck() { (cd "$P" && sh "$HERE/conventions/conventions-check"); }

printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0" }\n' > "$P/conventions.json"
printf '# clean\n\nThe color of the license — like this — is fine.\n' > "$P/README.md"
if pcheck > /dev/null; then ok "conventions-check passes a clean tree"; else bad "conventions-check fails a clean tree: $(pcheck 2>&1)"; fi

printf 'The colour of it.\n' > "$P/docs/kept/a.md"
out=$(pcheck 2>&1 || true)
if echo "$out" | grep -q 'docs/kept/a.md:1: colour'; then ok "a British word is named with its file and line"; else bad "a British word was not named: $out"; fi

printf '```\ncolour inside a fence\n```\n\nand `colour` inline.\n' > "$P/docs/kept/a.md"
if pcheck > /dev/null; then ok "fenced and inline code are not prose"; else bad "code was scanned as prose: $(pcheck 2>&1)"; fi

printf 'A closed—dash.\n' > "$P/docs/kept/a.md"
out=$(pcheck 2>&1 || true)
if echo "$out" | grep -q 'docs/kept/a.md:1: closed em-dash'; then ok "a closed em-dash is named"; else bad "a closed em-dash was missed: $out"; fi
printf 'A spaced — dash.\n' > "$P/docs/kept/a.md"
if pcheck > /dev/null; then ok "a spaced em-dash passes"; else bad "a spaced em-dash failed: $(pcheck 2>&1)"; fi

printf 'The colour in a vendored file.\n' > "$P/vendored/v.md"
out=$(pcheck 2>&1 || true)
if echo "$out" | grep -q 'vendored/v.md'; then ok "without exclude, every folder is scanned"; else bad "a folder was skipped with no exclude: $out"; fi
printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0", "exclude": ["vendored", "docs/superpowers"] }\n' > "$P/conventions.json"
if pcheck > /dev/null; then ok "an excluded folder is not read"; else bad "an excluded folder was read: $(pcheck 2>&1)"; fi

if [ -x "$HERE/conventions/conventions-check" ]; then ok "conventions-check is executable"; else bad "conventions-check is not executable"; fi
if grep -q 'conventions-check' "$HERE/conventions/conventions-sync"; then ok "the sync script vendors conventions-check"; else bad "the sync script does not vendor conventions-check"; fi
```

- [ ] **Step 2: Run and watch it fail**

```bash
sh test/run.sh; echo "exit $?"
```
Expected: the earlier cases pass, then `sh: …/conventions-check: No such file or directory` lines and `✗` lines for the new cases, non-zero exit.

- [ ] **Step 3: Write the script**

Create `conventions/conventions-check`:

```sh
#!/bin/sh
# conventions-check — hold a member's own Markdown to WRITING.md: American English and the
# spaced em-dash. Fenced code and inline code are not prose and are dropped before the scan;
# folders under "exclude" in conventions.json are someone else's prose and are not read.
#
#   sh conventions/conventions-check     exit 1 with one ✗ line per hit, file:line: word
#
# Needs sh, awk, sed, grep and find. Nothing else. CONVENTIONS_ROOT overrides the directory
# scanned, which is how the tests point it at a fixture.
set -eu

ROOT=${CONVENTIONS_ROOT:-.}
PIN=$ROOT/conventions.json

# Stems, not words, so derived forms are caught; a stem is on the list only when no American
# word contains it. This is the list: WRITING.md forbids British spelling without quoting one.
# A stem that is also the start of an American word — fulfil in fulfill, enrol in enroll,
# grey in greyhound, analyse in analyses — ends with ([^a-z]|$) instead of \b, which BSD and
# GNU grep read alike; \b does not travel.
STEMS='organis|colour|behaviour|centre|licence|recognis|modelling|catalogue|grey([^a-z]|$)|judgement|artefact|whilst|amongst|favour|honour|analys(e|ed|ing)([^a-z]|$)|optimis|normalis|serialis|initialis|visualis|minimis|prioritis|customis|summaris|categoris|parameteris|rasteris|unrecognis|cancelled|travelled|labelled|aluminium|instalment|neighbour|totalled|defence|offence|programmes?([^a-z]|$)|fulfil([^a-z]|$)|enrol([^a-z]|$)|skilful|ageing|cosy([^a-z]|$)|focuss|cheque([^a-z]|$)|tyre([^a-z]|$)|kerb([^a-z]|$)|storey|mould|plough|draught|sceptic'
DASH='[^ ]—|—[^ ]'

# The exclude list: every quoted string inside the "exclude": [ ... ] array, one per line.
excludes=""
if [ -f "$PIN" ]; then
  excludes=$(tr -d '\n' < "$PIN" | sed -n 's/.*"exclude" *: *\[\([^]]*\)\].*/\1/p' | tr ',' '\n' | sed -n 's/^[^"]*"\([^"]*\)".*/\1/p')
fi

# find, with .git and every excluded prefix pruned. The prune list is built as arguments.
set -- "$ROOT" -path "$ROOT/.git" -prune -o
for e in $excludes; do
  set -- "$@" -path "$ROOT/${e%/}" -prune -o
done
set -- "$@" -name '*.md' -type f -print

hits=$(find "$@" | LC_ALL=C sort | while IFS= read -r f; do
  # Drop fenced code and inline code, then print "file:line: text" for what is left.
  awk '
    /^```/ { fence = !fence; next }
    fence  { next }
    { line = $0; gsub(/`[^`]*`/, "", line); print FILENAME ":" FNR ": " line }' "$f"
done | {
  # Two passes over the same stream: the words, then the dashes. Each hit is reduced to the
  # location and the thing found, so the report reads the same for both.
  tmp=$(mktemp); cat > "$tmp"
  grep -i -E "$STEMS" "$tmp" | while IFS= read -r l; do
    loc=${l%%: *}; word=$(printf '%s' "${l#*: }" | grep -i -o -E "$STEMS" | head -1)
    printf '✗ %s: %s\n' "${loc#"$ROOT"/}" "$word"
  done
  grep -E "$DASH" "$tmp" | while IFS= read -r l; do
    loc=${l%%: *}
    printf '✗ %s: closed em-dash\n' "${loc#"$ROOT"/}"
  done
  rm -f "$tmp"
})

if [ -n "$hits" ]; then
  echo "$hits"
  exit 1
fi
echo "✓ every Markdown file follows WRITING.md"
```

```bash
chmod +x conventions/conventions-check
```

Then in `conventions/conventions-sync`, change the `FILES` line to:

```sh
FILES="WRITING.md WORKING.md REPOSITORIES.md AGENTS.md conventions-sync conventions-check"
```

and after `chmod +x "$DIR/conventions-sync"` add:

```sh
  chmod +x "$DIR/conventions-check"
```

- [ ] **Step 4: Run the tests until they pass, then shellcheck**

```bash
sh test/run.sh; echo "exit $?"
/private/tmp/claude-501/-Users-rob-git-robertblust/6279a5a8-b92b-41ed-a06b-e2764800f1e2/scratchpad/sc/bin/shellcheck conventions/conventions-sync conventions/conventions-check test/run.sh; echo "shellcheck exit $?"
```
Expected: every line `✓`, `all pass`, exit 0; shellcheck exit 0. A `${loc#"$ROOT"/}` form is what keeps SC2295 quiet; if the runner's version still objects, quote as shellcheck suggests rather than disabling.

- [ ] **Step 5: Run it on this checkout**

```bash
printf '{ "exclude": ["docs/superpowers"] }\n' > conventions.json
sh conventions/conventions-check; echo "exit $?"
```
Expected: `✓ every Markdown file follows WRITING.md`, exit 0. If it names a file, fix the file; this is the script finding what the two private tripwires found, plus inline code now ignored. Keep `conventions.json`; it is committed in Task 3.

- [ ] **Step 6: Correct the spec's one paragraph**

In `docs/superpowers/specs/2026-09-04-enforcement-design.md`, section 3, replace the paragraph beginning "**`test/run.sh` gains the cases**" with:

```
**`test/run.sh` gains the cases** that drove it: a probe with a British word fails; the same
word inside a fence or inside backticks passes; a closed em-dash fails and a spaced one passes;
a file under an excluded folder is not read; a member whose `conventions.json` has no `exclude`
runs over everything. `test/spelling.sh` and `test/dashes.sh` are deleted and CI runs the
vendored script over this checkout instead, with `docs/superpowers/` in this repository's own
`conventions.json` under `exclude`. That file carries no `repo` and no `tag` here: the source
is not a copy of itself, and `conventions-sync check` is not run on it. The reusable workflow
is proven by its first member, not by the source.
```

- [ ] **Step 7: Commit**

```bash
git checkout -b enforcement
git add conventions/conventions-check conventions/conventions-sync test/run.sh conventions.json docs/superpowers/specs/2026-09-04-enforcement-design.md
git commit -F - <<'EOF'
conventions-check: a member's prose held to WRITING.md, vendored

The two tripwires that held this repository's own Markdown were not vendored, so a member
had no way to hold its prose the same way short of copying them. One script now does both
scans — British stems and closed em-dashes — after dropping fenced and inline code, because
a quoted identifier is not prose, and it skips the folders a member lists under exclude in
conventions.json, because a vendored core is someone else's prose. The sync script vendors
it beside itself.

The source runs it on its own tree with docs/superpowers excluded and no repo or tag in its
conventions.json: the source is not a copy of itself, and the spec now says so.

Verified: sh test/run.sh all pass, including the eight new cases; shellcheck clean;
sh conventions/conventions-check passes on this checkout.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: The reusable workflow, and this repository's CI

**Files:**
- Create: `.github/workflows/check.yml`
- Modify: `.github/workflows/ci.yml`
- Delete: `test/spelling.sh`, `test/dashes.sh`

**Interfaces:**
- Produces: `robertblust/conventions/.github/workflows/check.yml` callable with `uses:` at a tag; job id `conventions`. Fails when the caller's `conventions.json` tag differs from the tag the workflow was called at.

- [ ] **Step 1: Write the reusable workflow**

```yaml
# Called by every member at a tag: uses: robertblust/conventions/.github/workflows/check.yml@vX.Y.Z
# One job, named conventions, which is the id a member's ruleset requires. It holds the vendored
# copy against the release and the member's own Markdown against WRITING.md, and it refuses to
# run when the tag it was called at is not the tag the member pins, so the two cannot drift.
name: conventions
on:
  workflow_call:
jobs:
  conventions:
    name: conventions
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v5
      - name: the workflow's tag is the member's pin
        env:
          REF: ${{ github.job_workflow_ref }}
        run: |
          case "$REF" in
            *@refs/tags/*) tag=${REF##*@refs/tags/} ;;
            *) echo "✗ conventions: called at $REF, not at a tag — pin a release" >&2; exit 1 ;;
          esac
          pin=$(sed -n 's/.*"tag" *: *"\([^"]*\)".*/\1/p' conventions.json | head -1)
          if [ "$tag" != "$pin" ]; then
            echo "✗ conventions: the workflow is called at $tag, conventions.json names $pin — move one to the other" >&2
            exit 1
          fi
          echo "✓ conventions: workflow and pin agree on $tag"
      - run: sh conventions/conventions-sync check
      - run: sh conventions/conventions-check
```

- [ ] **Step 2: This repository's own CI**

Replace `.github/workflows/ci.yml` with:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  # The job id is what the branch ruleset requires. Rename it only together with the ruleset.
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v5
      - run: shellcheck conventions/conventions-sync conventions/conventions-check test/run.sh
      - run: sh test/run.sh
      - run: sh conventions/conventions-check
```

```bash
git rm -q test/spelling.sh test/dashes.sh
```

- [ ] **Step 3: Validate the YAML shape locally, as far as it can be**

```bash
python3 -c "import yaml,sys; [yaml.safe_load(open(f)) for f in ['.github/workflows/check.yml','.github/workflows/ci.yml']]; print('yaml ok')" 2>/dev/null || ruby -ryaml -e "YAML.load_file('.github/workflows/check.yml'); YAML.load_file('.github/workflows/ci.yml'); puts 'yaml ok'"
sh test/run.sh > /dev/null; echo "run exit $?"
```
Expected: `yaml ok`; `all pass`. The reusable workflow itself cannot run here; mental-model's pull request in Task 5 is its first run.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/check.yml .github/workflows/ci.yml
git commit -F - <<'EOF'
A reusable workflow every member calls at the tag it pins

One job named conventions, in this repository, called by a member's five-line workflow:
checkout, the sync check, the prose check. Before either runs it reads its own ref and
fails when the tag differs from the one in conventions.json, so the workflow ref and the
pin are one decision checked two ways rather than two pins that drift. Called at a branch
it refuses outright.

This repository's own CI keeps its test job, runs the vendored prose check instead of the
two private tripwires, which are deleted, and lints the new script.

Verified: both workflow files parse; sh test/run.sh all pass. The reusable workflow's
first run is mental-model's pull request.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: The block, `WORKING.md`, `README.md`, and the release marker

**Files:**
- Modify: `AGENTS.md` (block sentence and version marker)
- Modify: `conventions/WORKING.md` (two sentences)
- Modify: `README.md` (three places)

- [ ] **Step 1: The block**

In `AGENTS.md`, replace:

```
Everything below this block is this repository's own. `sh conventions/conventions-sync check`
says whether the copy matches the release; `sync` brings it to the release the pin names.
Edit a shared file in robertblust/conventions, never here.
```

with:

```
Everything below this block is this repository's own. `sh conventions/conventions-sync check`
says whether the copy matches the release, `sync` brings it to the release the pin names, and
`sh conventions/conventions-check` holds this repository's own Markdown to `WRITING.md`. Edit
a shared file in robertblust/conventions, never here.
```

and the first line to `<!-- conventions · v1.3.0 -->`. In the repository's own section below the block, replace the tests paragraph with:

```
The tests are `sh test/run.sh`, which runs both scripts against temporary members with this
checkout as the source, and `sh conventions/conventions-check` over this checkout itself, with
`docs/superpowers/` excluded because a spec or plan quotes the very list it scans for.
```

- [ ] **Step 2: `WORKING.md`**

Under *Branches and commits*, after the first paragraph, add:

```
A branch is deleted once its pull request is merged. The merge commit is its record; a branch
left standing is a question every reader of the branch list has to answer again.
```

Under *Checks*, after the paragraph on job ids, add:

```
Every repository's ruleset requires the `conventions` job beside the job that runs its own
suite; a repository without a suite requires it alone. That job holds the vendored copy against
its release and the repository's own Markdown against `WRITING.md`, and it is the same job
everywhere because it is called from one place.
```

- [ ] **Step 3: `README.md`**

Replace the two install lines' `v1.2.0` with `v1.3.0`. After the paragraph beginning "Put `check` in CI before anything installs", replace it and add the workflow:

````
Then add `.github/workflows/conventions.yml`, which calls the job every member runs:

```yaml
name: conventions
on:
  push:
    branches: [main]
  pull_request:
jobs:
  conventions:
    uses: robertblust/conventions/.github/workflows/check.yml@v1.3.0
```

The tag in `uses:` and the tag in `conventions.json` must agree; the job fails when they do
not. Require `conventions` in the branch ruleset beside the job that runs the repository's own
suite. To take a new release, move both tags, run `sync`, and commit what changed.

A folder that is someone else's prose — a vendored core, a copied specification — is listed
under `exclude` in `conventions.json` and is not scanned:

```json
{ "repo": "robertblust/conventions", "tag": "v1.3.0", "exclude": ["meta"] }
```
````

In *Tests*, replace the paragraph with:

```
`sh test/run.sh` runs both scripts against temporary members with this checkout as the source.
`sh conventions/conventions-check` runs over this checkout itself, `docs/superpowers/` excluded
because a spec or plan quotes the list it scans for. CI runs both, and `shellcheck` over the
shell.
```

- [ ] **Step 4: Verify and commit**

```bash
sh test/run.sh | tail -1
sh conventions/conventions-check; echo "check exit $?"
head -1 AGENTS.md; grep -c v1.3.0 README.md
git add AGENTS.md conventions/WORKING.md README.md
git commit -F - <<'EOF'
Release 1.3.0: the block names the prose check, and two rules join WORKING.md

The block now names conventions-check beside sync and check, which changes every
member's copy and makes this a minor release. WORKING.md says a branch is deleted once its
pull request is merged, and that every ruleset requires the conventions job. The README
carries the member's workflow file, the exclude key, and the install lines at the new tag.

Verified: sh test/run.sh all pass; sh conventions/conventions-check passes on this tree.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 4: Pull request, merge, tag

- [ ] **Step 1: Push and open the pull request**

```bash
git push -u origin enforcement
gh pr create --title "Enforcement: conventions-check, the reusable workflow, and release 1.3.0" --body "$(cat <<'EOF'
Three commits. `conventions-check` is the prose tripwire, vendored: British stems and closed em-dashes over a member's Markdown, fenced and inline code dropped, folders under `exclude` skipped. `.github/workflows/check.yml` is the one job named `conventions` every member calls at a tag, refusing to run when that tag is not the member's pin. The block names the new script, two rules join `WORKING.md`, and the README carries the member's five-line workflow and the `exclude` key.

The source runs the prose check on itself and drops its two private tripwires; it does not run the sync check on itself, because its `conventions/` is the source and not a copy, and the spec says so now.

After the merge: tag v1.3.0 and publish the notes. mental-model is the first member and the reusable workflow's first run.

Verified: `sh test/run.sh` all pass; `sh conventions/conventions-check` passes on this tree; shellcheck clean locally, CI runs the runner's.
EOF
)"
gh pr checks --watch
```
Expected: `test` pass.

- [ ] **Step 2: Stop for the owner's word, then merge with a merge commit and tag**

```bash
gh pr merge --merge
git checkout main && git pull && git branch -d enforcement
gh release create v1.3.0 --target main --title "v1.3.0" --notes "$(cat <<'EOF'
Enforcement reaches the members. `conventions/conventions-check` is vendored beside the sync script and holds a repository's own Markdown to `WRITING.md`: American English and the spaced em-dash, with fenced and inline code left alone and any folder under `exclude` in `conventions.json` unread. `.github/workflows/check.yml` is a reusable workflow: one job named `conventions` that runs the sync check and the prose check, and refuses to run when the tag it is called at differs from the tag the repository pins.

The block in `AGENTS.md` names the new script, so every copy is stale; re-sync in the order `REPOSITORIES.md` gives. Two rules join `WORKING.md`: a branch is deleted once its pull request is merged, and every ruleset requires the `conventions` job.

To take it, from a repository's root, then add the workflow the README shows and require `conventions` in the ruleset:

```sh
printf '{ "repo": "robertblust/conventions", "tag": "v1.3.0" }\n' > conventions.json
curl -fsSL https://raw.githubusercontent.com/robertblust/conventions/v1.3.0/conventions/conventions-sync -o /tmp/conventions-sync
sh /tmp/conventions-sync sync
```
EOF
)"
```

---

### Task 5: mental-model, the proof

**Files (in `~/git/robertblust/mental-model`):**
- Modify: `conventions.json`, `AGENTS.md`, `README.md`, `docs/specs/2026-09-02-experience-kind.md`
- Create: `.github/workflows/conventions.yml`
- Written by sync: `conventions/*`

- [ ] **Step 1: Branch, pin, exclude, sync**

```bash
cd ~/git/robertblust/mental-model && git checkout main && git pull && git checkout -b conventions-1-3-0
printf '{ "repo": "robertblust/conventions", "tag": "v1.3.0", "exclude": ["meta"] }\n' > conventions.json
sh conventions/conventions-sync sync
sh conventions/conventions-sync check; echo "check exit $?"
head -1 AGENTS.md
```
Expected: `✓ … match robertblust/conventions@v1.3.0`, exit 0, marker `v1.3.0`.

- [ ] **Step 2: Run the prose check and fix what is this repository's**

```bash
sh conventions/conventions-check; echo "exit $?"
```
Expected hits, and their fixes: `README.md:36: artefact` → `artifact`; `docs/specs/2026-09-02-experience-kind.md:176: modelling` and `:222: modelling` → `modeling`. Anything else it names is fixed the same way unless it sits inside the vendored core, which is excluded. Rerun until `✓`, exit 0.

- [ ] **Step 3: The workflow**

Create `.github/workflows/conventions.yml`:

```yaml
name: conventions
on:
  push:
    branches: [main]
  pull_request:
jobs:
  conventions:
    uses: robertblust/conventions/.github/workflows/check.yml@v1.3.0
```

- [ ] **Step 4: The agent file's own paragraph**

In `AGENTS.md`, below the block, after the `## What this is` section, add:

```
## Checks

The only job is `conventions`, called from robertblust/conventions at the pinned tag; the
ruleset on `main` requires it. `meta/` is excluded from the prose check because it is core,
vendored and never edited here; its words are core's to hold.
```

- [ ] **Step 5: Commit, push, open the pull request, watch the first run of the reusable workflow**

```bash
git add conventions.json conventions AGENTS.md README.md docs/specs/2026-09-02-experience-kind.md .github/workflows/conventions.yml
git commit -F - <<'EOF'
Conventions v1.3.0, a conventions job, and three spellings

The pin moves to v1.3.0, which brings conventions-check beside the sync script; meta/ is
excluded from it because the vendored core's words are core's to hold. A five-line workflow
calls the shared job at the pinned tag, the first CI this repository has. The prose check
named artefact in the README and modelling twice in a spec; all three are American now.

Verified: sh conventions/conventions-sync check and sh conventions/conventions-check pass
by exit code; the conventions job on the pull request is the reusable workflow's first run.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
git push -u origin conventions-1-3-0
gh pr create --title "Conventions v1.3.0, a conventions job, and three spellings" --body "$(cat <<'EOF'
The pin moves to v1.3.0, which brings `conventions-check` beside the sync script; `meta/` is excluded because the vendored core's words are core's to hold. A five-line workflow calls the shared job at the pinned tag, the first CI this repository has. The prose check named `artefact` in the README and `modelling` twice in a spec; all three are American now.

This is the reusable workflow's first run anywhere. A ruleset requiring `conventions` follows once it is green.

Verified: `sh conventions/conventions-sync check` and `sh conventions/conventions-check` pass by exit code.
EOF
)"
gh pr checks --watch
```
Expected: a check named `conventions` passes. If it fails on the tag step, the pin and the `uses:` tag disagree; if it fails on checkout or the scripts, read the log before touching anything.

- [ ] **Step 6: The ruleset**

```bash
gh api -X POST repos/robertblust/mental-model/rulesets --input - <<'EOF'
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["merge"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [ { "context": "conventions" } ] } }
  ],
  "bypass_actors": [ { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" } ]
}
EOF
```
Expected: JSON back with `"enforcement": "active"`.

- [ ] **Step 7: Stop for the owner's word, then merge and delete the merged branches**

```bash
gh pr merge --merge
git checkout main && git pull && git branch -d conventions-1-3-0
gh run list --branch main --limit 1
for b in conventions core-0-13-1 mastership-and-skills-cleanup ubs-division-scope cv-model-linkedin-sync date-precision experience-kind prose-urls references register-links conventions-1-3-0; do git push origin --delete "$b"; done
git fetch --prune && git branch -r
```
Expected: the `conventions` run on `main` succeeds; the remote branch list is `origin/main` and `origin/review-drafted-prose`, the one unmerged branch, which stays until its owner decides.

---

### Task 6: Read-through, memory, stop

- [ ] Report in the reply register: v1.3.0 released, mental-model green under `conventions` on `main`, the ruleset active, ten branches gone, what the prose check found and fixed. Update the project memory: `conventions-repo` to v1.3.0 and the proof done; the recipe is now the way the other eight members follow, one pull request each in REPOSITORIES.md order, each needing its own go.
