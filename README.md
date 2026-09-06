# conventions

How the robertblust, guestgraph and companygraph organizations write and work, in six
files every repository of the family vendors at a pinned release:

- `conventions/WRITING.md` — one voice, three registers, English and German, and how a text is made.
- `conventions/WORKING.md` — git and GitHub: branches, merge commits, identity, releases, pins.
- `conventions/REPOSITORIES.md` — the family, and what pins what.
- `conventions/WRITER.md` and `conventions/TRANSLATOR.md` — the two roles that make a text: what each takes, produces and never does.
- `conventions/GLOSSARY.md` — every family term in its fixed English and German form.

A member's `AGENTS.md` opens with a block that names them and tells any agent to read them
first, in plain words and naming no vendor. `CLAUDE.md` is the vendor adapter, `@AGENTS.md` and
an import line for each of `WRITING.md`, `WORKING.md` and `REPOSITORIES.md`; the two briefs and
the glossary are read by the agent adapters below, not by every session. Another vendor's
adapter would be added the same way the day it is needed. The block and the files are written
by a script and checked in CI, so a copy that drifts from its release turns a build red rather
than quietly diverging.

## Taking it into a repository

Once, from the repository's root, naming the release to follow:

```sh
printf '{ "repo": "robertblust/conventions", "tag": "v1.6.0" }\n' > conventions.json
curl -fsSL https://raw.githubusercontent.com/robertblust/conventions/v1.6.0/conventions/conventions-sync -o /tmp/conventions-sync
sh /tmp/conventions-sync sync
```

From then on the script is vendored with the rest, and the two commands are:

```sh
sh conventions/conventions-sync check   # exit 1 with one ✗ line per thing that differs
sh conventions/conventions-sync sync    # bring the copy to the release conventions.json names
```

Then add `.github/workflows/conventions.yml`, which calls the job every member runs:

```yaml
name: conventions
on:
  push:
    branches: [main]
  pull_request:
jobs:
  conventions:
    uses: robertblust/conventions/.github/workflows/check.yml@v1.6.0
```

The tag in `uses:` and the tag in `conventions.json` must agree; the job fails when they do
not. GitHub names a check from a reusable workflow after the caller and the called job, so the
context to require in the branch ruleset is `conventions / conventions`, beside the job that
runs the repository's own suite. To take a new release, move both tags, run `sync` and commit
what changed. A member still on v1.2.0 runs `sync` twice the first time, because the v1.2.0
script does not know about the files later releases add; from v1.3.0 on, the script fetches its
own new version first and one `sync` is enough.

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

A folder that is someone else's prose — a vendored core, a copied specification — is listed
under `exclude` in `conventions.json` and is not scanned. A folder of German prose is listed
there too, because the scan reads no language and a German word such as `Organisation` would
be a hit:

```json
{ "repo": "robertblust/conventions", "tag": "v1.6.0", "exclude": ["meta"] }
```

## Layout

The repository mirrors what it vendors. The shared files sit under `conventions/` here
exactly as they will in a member, and the root `AGENTS.md` carries the block a member's
`AGENTS.md` opens with, so both read the same in the source and in every copy.

## Releasing

A tag and a GitHub Release with notes in the prose register: what changed, what breaks, how to
take it. Any change to a vendored file is at least a minor release, because it makes every copy
stale. A change to the block's shape or the script's commands is a major. Before tagging, set
the version in the first line of `AGENTS.md` to the new tag, and set `CONVENTIONS_RELEASE` in
`.github/workflows/check.yml` to the same tag; a test fails when the two disagree.
`REPOSITORIES.md` lists the members in the order to re-sync them.

## Tests

`sh test/run.sh` runs both scripts against temporary members with this checkout as the source.
`sh conventions/conventions-check` runs over this checkout itself, `docs/superpowers/` excluded
because a spec or plan quotes the list it scans for, and `.superpowers/` excluded beside it as
tooling scratch, not prose. CI runs both, and `shellcheck` over the shell.

Apache 2.0.
