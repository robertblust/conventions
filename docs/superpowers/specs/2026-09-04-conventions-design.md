# Conventions — design

> Three organizations, nine repositories, and the rules they share live in five hand-kept
> copies of one section, each drifting on its own. One repository that owns the words, one
> pinned line in every member that says which release it follows, and a check that turns red
> when the copy and the release disagree. The same shape the family already trusts for
> pixels, applied to how it writes and how it works.

Status: proposed. Creates `robertblust/conventions`. Changes the agent entry file of every
member repository, removes the sections they copy from one another, and adds one pinned line,
one vendored folder and one CI step to each. Companion: `robertblust/design`'s
`2026-09-03-writing-design.md`, which keeps the typography check and the page sweeps.

---

## 1. The finding

On 2026-09-03 three pull requests went into the family in a voice it had never used, and
nothing but the person reading them noticed. Looking for the rule they broke turned up the
shape of the problem rather than the rule. The instruction *merge with a merge commit, never
squash* — with its reason, that GitHub re-authors a squash to whoever pressed the button — is
written out in full in five `CLAUDE.md` files. The language section, *a page is en-US; a `-de`
attribute is de-CH*, is byte-identical in three, kept that way by hand. The house style for
prose is four bullets in mental-model, copied from a repository that has since left the
organization, and copied again into a spec in meta-model. Nothing anywhere describes the
paragraph voice the `CLAUDE.md` files are themselves written in. And every one of those files
is named for one vendor's agent, so a session of any other agent starts with nothing.

The family already solved this once, for pixels. `robertblust/design` owns the tokens, the
header and the deck chrome; each site pins a tag, `npm run design` writes the copies, and
`design:check` fails the build when a copy drifts. Before that mechanism there were five
different mobile behaviors and eight wordings of the same CSS across the sites, and nothing
failed anywhere. The words are in that state now.

## 2. What was decided

**One repository owns the shared rules: `robertblust/conventions`.** It is vendor-agnostic and
has no runtime dependency. It holds how the family writes, how it works with git and GitHub,
and a map of what belongs to it. It does not hold anything a single repository is the only one
to need; that stays in the member's own agent file.

**`AGENTS.md` is the entrypoint in every repository, and `CLAUDE.md` is the vendor adapter
that imports it.** meta-model and mental-model already have the entry-file shape. The sites and the engine
rename their `CLAUDE.md`. Every `AGENTS.md` opens with a fenced block the conventions sync
maintains: it names the vendored files and tells any agent, in plain words, to read them before
writing or committing. The block names no vendor. `CLAUDE.md` is the one vendor adapter: the
line `@AGENTS.md` and one import line per vendored file, so that a session of that agent has
them loaded before its first word; another vendor's adapter would do the same in its own syntax
and is added the day it is needed.

**The files reach members by a pinned fetch.** Each member carries `conventions.json` naming a
tag, and a POSIX shell script that pulls the files at that tag with `curl`, writes them under
`conventions/`, records a hash manifest, and rewrites the fenced block in `AGENTS.md`. The
script's `check` mode recomputes and fails on drift; CI runs it. No submodule — a bare SHA for
a pin, an empty folder on a plain clone and a link where GitHub should show files are three
silent failures in a family that has spent a year removing silent failures. No npm — the engine
is a Maven project, and reading a Markdown file must not require Node.

**The root points nowhere downstream.** The shared files state their rules; they cite no rule,
check or repository that lives in a member. Spelling is stated here in full, and core's R14 —
which said it first, for the model family — comes to cite this file rather than the reverse.
`REPOSITORIES.md` is the one shared file that names members, because naming them is its job.
Nothing in `conventions/` or in the block names an agent vendor. A commit's author is the
person; a tool that co-authored the change is credited in a `Co-Authored-By` trailer, whichever
tool it was — the shared files state the rule and name no tool as the example.

**Three registers, one voice.** Prose for pages, README files, agent files, specs and release
notes. Git for commit messages and pull request descriptions. Reply for what an agent says in
conversation, in review comments and in reports. The first two were decided on 2026-09-03 and
are recorded in the companion spec; the third is the family's own, not borrowed: outcome
first, short sentences, a list only for parallel items, no headers under a page.

**German is Swiss, English follows the house style.** Guillemets and the spaced en-dash in
German; no serial comma in English. Decided in the companion spec, stated in `WRITING.md`,
enforced on pages by design's `typography` check, and by reading everywhere else.

**Out of scope.** rob-cv is private, has no remote and is not part of the organization; it is
neither listed nor synced. An agent file from an earlier, closed-source context was inspiration for the shape of an
output-style section and a repository map, nothing more; no text is taken from it.

## 3. The repository

`robertblust/conventions`, public, Apache 2.0 like the rest of the family. Its files:

- **`WRITING.md`** — the three registers, the two typographies and two worked examples. Its
  content is specified in the companion spec, section 3, extended by the reply register above.
  It states the spelling rule itself. It names no British form, not even as a counter-example,
  because this repository's own tripwire scans it and a member's may too.
- **`WORKING.md`** — how the family acts with git and GitHub. What moves here is exactly what
  the members copy from one another today: a branch per change; commits when the owner asks,
  never on the agent's own initiative; a pull request merged with a merge commit and the
  re-authoring reason; the author identity keyed to the directory by `includeIf`, and the
  check of `git config user.email` in a fresh clone; the rule that a required status check
  names a job id, so renaming the job silently unprotects the branch; a release as a tag and a
  GitHub Release with notes, and the rule that a change to any vendored file is at least a
  minor; pins as visible lines — `source.json`, the design tag, the conventions tag — that are
  editorial, moved on purpose and never proposed by a bot; merging as something that needs an
  explicit go; verification by running the suite before anything is called done; and the rule
  that closed-source predecessor projects are never mentioned, in code, docs or commits. One
  short paragraph on reviews: a finding is an input, the human merges.
- **`REPOSITORIES.md`** — the map. One table: organization and repository, purpose, default
  branch, local path under `~/git`, what it pins and what pins it, and its agent entry. The
  two organization `.github` repositories are listed with their purpose, which is what GitHub
  reads from them; they cannot carry an agent file into members and do not try to.
- **`AGENTS.md`** — the conventions repository's own, which is also the fenced block every
  member's `AGENTS.md` opens with, so the source of the block is a file a reader can open. Plain
  words, no vendor syntax.
- **`CLAUDE.md`** — the vendor adapter, four lines: `@AGENTS.md` and the three vendored files.
  Members carry the same four lines; the sync does not write it, because it is one vendor's.
- **`bin/conventions-sync`** — the script. `sync` reads `conventions.json`, fetches
  `WRITING.md`, `WORKING.md`, `REPOSITORIES.md` and itself at the named tag from
  `raw.githubusercontent.com`, writes them under `conventions/`, writes
  `conventions/manifest.json` with the tag and a SHA-256 per file, and replaces the fenced
  block in `AGENTS.md`. `check` recomputes every hash and the block and exits non-zero naming
  the first thing that differs. It depends on `sh`, `curl` and `shasum` or `sha256sum`,
  whichever the machine has. It vendors itself, so a member updates the tool by moving the tag.
  First installation is one `curl` line in the README.
- **`README.md`** — what the repository is, the install line, and the release rule.
- **`docs/superpowers/specs/`** — this file.

The fenced block is delimited by `<!-- conventions · vN -->` and `<!-- end conventions -->`,
where N is the release, so a stale block is visible to a reader before any check runs — the
same reason design's fences carry a version in their first line.

**Releasing.** A tag and a GitHub Release with notes, nothing more. Any change to a vendored
file is a minor; a change to the block's shape or the script's interface is a major. The notes
say what changed and that every member re-syncs; there is no bot to open the pull requests,
and REPOSITORIES.md lists the members in the order to do it by hand. If that becomes the
family's slowest step, a workflow in this repository that opens the nine pull requests on
release is the next spec, not this one.

## 4. Adoption, per member

The same five steps in every repository, in the order REPOSITORIES.md lists them:

1. `AGENTS.md` becomes the entrypoint. Where the file is `CLAUDE.md` today — the three sites,
   the engine, meta-model — it is renamed, and `CLAUDE.md` becomes the one line `@AGENTS.md`.
   design has neither today and gets both.
2. The sections `WORKING.md` now owns are removed from the member's file: the *Process* section
   in the sites, the engine and meta-model, and the copied house-style bullets in mental-model.
   What is only that repository's stays — the CI job's name, the DNS zone, the narration
   secret, the deck conventions.
3. `conventions.json` is added naming the release, the script is installed by the README's
   line, and `sync` is run once. The fenced block appears at the top of `AGENTS.md`,
   `conventions/` appears beside it.
4. CI gains one step before anything installs: `sh conventions/conventions-sync check`.
5. The member's own agent file gets one paragraph, in the prose register, saying what is
   specific to it and that everything else is in `conventions/`.

Members: `robertblust/design`, `robertblust/robertblust.github.io`, `robertblust/mental-model`,
`robertblust/field-notes`, `guestgraph/guestgraph.github.io`, `guestgraph/engine`,
`companygraph/companygraph.github.io`, `companygraph/meta-model`, and the two organization
`.github` repositories, which take the block and the folder so that a session opened there
reads the same rules.

## 5. What stays where

- **Design** keeps what is about pages: the `typography` check that holds ß, quotes and dashes
  on rendered pages and in `data-de`, the `stage.js` range dash, the spelling tripwire over its
  own files, and the page sweeps. Its spec is cut to that and points here for the words. The
  `writing` sync group it was going to gain is not created; `WRITING.md` arrives by the
  conventions fetch instead, in every member, not only the sites.
- **Core's R14** stays the model family's rule and comes to cite `WRITING.md` for the words;
  the direction of citation is from member to root, never back.
- **The agent's memory** gains one feedback entry naming `conventions/WRITING.md` and
  `conventions/WORKING.md` as the voice and the process for everything written into a
  repository, with the two things that went wrong on 2026-09-03 spelled out.

## 6. What this is not

No pull request template: a template in `.github` pulls text toward sections, and the git
register is prose. No commit hook: nothing in CI reads a commit body, and the rule is held by
being read. No cross-organization automation on release, until re-syncing by hand is what
slows the family down. No rules for anything a single repository is alone in needing.
