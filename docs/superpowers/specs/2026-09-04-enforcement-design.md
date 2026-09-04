# Enforcement — design

> The shared files reach a member by a pinned fetch, and nothing runs when the copy drifts or
> the prose breaks the rules the copy states. A second vendored script holds the prose, a
> reusable workflow runs both scripts under one job name in every member, and mental-model is
> the first repository to carry it, so the recipe is proven once before it is applied eight
> more times.

Status: proposed. Adds `conventions/conventions-check` and `.github/workflows/check.yml` to
this repository, changes the block in `AGENTS.md` and two paragraphs of `WORKING.md`, and
lands as **v1.3.0**. Adopts the release in `robertblust/mental-model` as the proof. Follows
`2026-09-04-conventions-design.md`, which this file does not restate.

---

## 1. The finding

mental-model vendored v1.2.0 by hand and passes `check`. It has no CI: no workflow exists, so
the check runs only when someone types it, and `main` carries no ruleset. Its own prose holds
three British spellings — one in the README, two in a spec — and the vendored core holds two
more that core's untagged `main` has already fixed. Ten merged branches remain on the remote,
because nothing says a branch is deleted after its merge. None of this is visible to anything
but a reader, which is the state the conventions repository was created to end for the words
and has not yet ended for the members.

The two tripwires that hold this repository's own prose, `test/spelling.sh` and
`test/dashes.sh`, are not vendored, so a member has no way to hold its prose the same way
short of copying them, and a copy is what the family stopped doing for pixels and for words.

## 2. What was decided

**Enforcement lives in every member, as one job named `conventions`.** It holds the vendored
copy against the release and the member's own Markdown against `WRITING.md`, and a member's
ruleset requires it beside the job that runs the member's own suite, or alone where there is
no suite. A red `conventions` says what failed without a log.

**The steps live once, in a reusable workflow here.** A member's workflow is five lines that
call `robertblust/conventions/.github/workflows/check.yml` at a tag. Two pins for one thing
would drift, so the reusable workflow reads its own ref and fails when the tag does not match
the tag in `conventions.json`: the second pin is a check on the first, not a second source.

**The prose tripwires are one vendored script.** `conventions/conventions-check` runs the
British-stem and closed-em-dash scans over a member's Markdown, skipping fenced code and inline
code spans, honoring an `exclude` list in `conventions.json`. This repository runs the same
script on itself and drops its two private copies.

**Two rules join `WORKING.md`.** A branch is deleted once its pull request is merged. The
`conventions` job is required by every member's ruleset.

**mental-model is the proof.** It moves to v1.3.0, gains the workflow and a ruleset, fixes its
three spellings, excludes the vendored core, deletes its merged branches, and names its job id
in its agent file. The other eight members follow only after it is green.

**Not in this round.** Release propagation — a workflow that opens the re-sync pull requests
on a tag — waits until re-syncing by hand is what slows the family. The serial comma stays a
reading task. Core's two British words are core's, at 0.13.2.

## 3. The base in conventions

**`conventions/conventions-check`.** POSIX shell, beside `conventions-sync`, vendored by it.
It walks every `*.md` under the member's root except `.git/` and every path under `exclude`
in `conventions.json`; the vendored shared files are scanned like the rest and pass, which is
one more thing the scan proves on every run. For each file it drops
fenced code, from a line beginning with three backticks to the next, and inline code between
single backticks, then scans what remains for the stems `test/spelling.sh` carries today and
for an em-dash touching a non-space on either side. Each hit prints as `✗ file:line: word`;
the exit is 1 on any hit and 0 with one `✓` line otherwise. The stem list moves into the script
and exists nowhere else. It reads `exclude` with the same `sed` the sync script reads `repo`
and `tag` with, one path per entry, and treats an absent key as an empty list.

**`test/run.sh` gains the cases** that drove it: a probe with a British word fails; the same
word inside a fence or inside backticks passes; a closed em-dash fails and a spaced one passes;
a file under an excluded folder is not read; a member whose `conventions.json` has no `exclude`
runs over everything. `test/spelling.sh` and `test/dashes.sh` are deleted and CI runs the
vendored script over this checkout instead, with `docs/superpowers/` in this repository's own
`exclude` — this repository carries a `conventions.json` of its own from here, pinned to
itself, which also makes it the first member.

**`.github/workflows/check.yml`.** Declared `on: workflow_call`, one job with `runs-on:
ubuntu-latest`, id and name `conventions`, `timeout-minutes: 5`. Steps: checkout; a shell step
that reads the tag from `github.job_workflow_ref` — the part after `@refs/tags/` — and from
`conventions.json`, and exits 1 naming both when they differ; `sh conventions/conventions-sync
check`; `sh conventions/conventions-check`. Nothing is installed. The repository's own CI keeps
its `test` job for the script tests and shellcheck and gains a call to this workflow, so the
job that members require is also run here.

**The block.** The sentence naming `check` and `sync` becomes: `sh conventions/conventions-sync
check` says whether the copy matches the release, `sync` brings it to the release the pin
names, and `sh conventions/conventions-check` holds this repository's own Markdown to
`WRITING.md`. The block changes, so every member's copy is stale: v1.3.0.

**`WORKING.md`.** Under *Branches and commits*: a branch is deleted once its pull request is
merged; the merge commit is its record. Under *Checks*: every member's ruleset requires the
`conventions` job beside the job that runs its own suite, and a member without a suite requires
it alone.

**`README.md`.** The member's workflow file in full, the `exclude` key with its reason, and
the note that the ruleset requires `conventions`.

## 4. The recipe, the same in every member

1. `conventions.json` names the release and, where a folder is someone else's prose, lists it
   under `exclude`. `sync` runs once. Where the entry file is `CLAUDE.md`, it is renamed to
   `AGENTS.md` first and `CLAUDE.md` becomes the four-line adapter.
2. `.github/workflows/conventions.yml`: on push to `main` and on pull request, one job named
   `conventions` whose only line is `uses: robertblust/conventions/.github/workflows/check.yml@v1.3.0`.
3. The ruleset on `main` requires `conventions`, beside `verify` where a suite exists. Pull
   request required, merge commits only, no deletion, no force-push.
4. The member's agent file loses what `WORKING.md` owns and gains one paragraph: its job ids,
   its exclusions and why, and that everything else is in `conventions/`.
5. `sh conventions/conventions-check` runs once locally, and what it finds in the member's own
   prose is fixed in the same pull request, so the job is green on its first run.

## 5. mental-model, the proof

Step 1 and the adapter are done at v1.2.0; the proof moves the pin to v1.3.0 and does the
rest. `exclude` names `meta/`, the vendored core, whose two British words are core's to fix.
The three spellings in its own prose are fixed: “artefact” in `README.md`, “modelling” twice in
`docs/specs/2026-09-02-experience-kind.md`; the spec's `organisation` mentions are inline code
and are skipped by the scan. The workflow and the ruleset are created; today there is neither.
The ten merged remote branches are deleted. The agent file names `conventions` as its job id
and says why `meta/` is excluded. The proof holds when the `conventions` job is green on the
pull request and on `main` after the merge, and `check` and `conventions-check` pass locally
by exit code.

## 6. What this is not

Not a copy of the tripwires into nine repositories. Not a second pin: the workflow ref and the
`conventions.json` tag are checked against each other on every run. Not release propagation,
not the serial comma, not the other eight members, not core 0.13.2.
