# Robert Blust — Conventions

How the robertblust, guestgraph and companygraph organizations write and work. Every repository of the family vendors this at a pinned release, and these are the files it reads first:

- `conventions/WRITING.md` — one voice, three registers, English and German, and how a text is made.
- `conventions/WORKING.md` — git and GitHub: branches, merge commits, identity, releases, pins.
- `conventions/REPOSITORIES.md` — the family, and what pins what.
- `conventions/WRITER.md`, `conventions/TRANSLATOR.md`, `conventions/EDITOR.md` and `conventions/BACKREADER.md` — the four roles that make a text: what each takes, produces and never does.
- `conventions/GLOSSARY.md` — every family term in its fixed English and German form.
- `conventions/GERMAN.md` — what Swiss Standard German asks beyond its marks: the Swiss words, the habits to avoid, the forms a check refuses and the owner's choices.

A member's `AGENTS.md` opens with a block that names them and tells any agent to read them first, in plain words and naming no vendor. `CLAUDE.md` is the vendor adapter, `@AGENTS.md` and an import line for each of `WRITING.md`, `WORKING.md` and `REPOSITORIES.md`; the four briefs, the glossary and `GERMAN.md` are read by the agent adapters below, not by every session. Another vendor's adapter would be added the same way the day it is needed. The block and the files are written by a script and checked in CI, so a copy that drifts from its release turns a build red rather than quietly diverging.

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

The tag in `uses:` and the tag in `conventions.json` must agree; the job fails when they do not. GitHub names a check from a reusable workflow after the caller and the called job, so the context to require in the branch ruleset is `conventions / conventions`, beside the job that runs the repository's own suite. To take a new release, move both tags, run `sync` and commit what changed. A member still on v1.2.0 runs `sync` twice the first time, because the v1.2.0 script does not know about the files later releases add; from v1.3.0 on, the script fetches its own new version first and one `sync` is enough.

Then four agent adapters, written once beside `CLAUDE.md` and kept as they are. They are a vendor's syntax, which is why they are not vendored with the shared files; another vendor's adapters would go in that vendor's place the same way. `.claude/agents/writer.md`:

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

None has a shell or git, because a role edits or reports and the session that invoked it commits when the owner asks. The editor and the back-reader cannot edit either: what they return is written by the session that holds the English, since the one thing each of them must not do is read it.

A folder that is someone else's prose — a vendored core, a copied specification — is listed under `exclude` in `conventions.json` and is not scanned. A folder of German prose is listed there too, because the scan reads no language and a German word such as `Organisation` would be a hit:

```json
{ "repo": "robertblust/conventions", "tag": "v1.6.0", "exclude": ["meta"] }
```

The same job holds every member's Markdown to the one form `WRITING.md` gives it, with the rules in `.markdownlint-cli2.jsonc` and `conventions/markdown-rules.cjs`, so a table an editor reformatted fails until it is back in the family's form. `sh conventions/conventions-format` names each file and line that differs and `sh conventions/conventions-format fix` rewrites them. It needs Node 22 or later, since the rules are markdownlint's and npx fetches the version the script pins. What git ignores is left out, so a scratch folder a member keeps untracked does not fail a run here that the job, which checks out tracked files only, never sees.

One file a member receives sits at its root rather than under `conventions/`, because something other than this family reads it there: `.markdownlint-cli2.jsonc` is the rule set under the name markdownlint-cli2 and every editor plugin built on it discovers on its own. It is vendored and hashed like everything else, so an editor and the shared job read the same rules and a member that edits them locally is named by `check`.

`.vscode/settings.json` and `.vscode/extensions.json` ask VS Code to format Markdown on save with that same library, and neither is in git. Every member ignores `.vscode/`, because VS Code reads one settings file per repository and merges nothing, so that file has to hold every tool and language a member uses and is nobody else's to own. `sync` writes each from the copy under `conventions/` where a member has none and never over one that is there, so a fresh clone formats on save without anyone setting it up, and nothing checks what a member then does with it. The extension reads `customRules` from the rule set the same way the script does, so the delimiter-row rule runs in the editor too — but it is JavaScript, and VS Code runs no JavaScript from a workspace that has not been trusted, so the first open of a fresh clone answers that prompt before the form is whole.

The form has its own list of what it leaves alone, `format-exclude`, because the two checks skip a folder for different reasons. The prose check skips a spec that quotes the words it scans for, and nothing about that spec's tables is anyone else's; the form skips what another repository formats, a vendored copy or a fixture. A member that names no `format-exclude` is formatted as its `exclude` says:

```json
{ "repo": "robertblust/conventions", "tag": "v1.20.0", "exclude": ["meta", "docs/superpowers"], "format-exclude": ["meta"] }
```

## Layout

The repository mirrors what it vendors. The shared files sit under `conventions/` here exactly as they will in a member, and the root `AGENTS.md` carries the block a member's `AGENTS.md` opens with, so both read the same in the source and in every copy.

## Releasing

A tag and a GitHub Release with notes in the prose register: what changed, what breaks, how to take it. Any change to a vendored file is at least a minor release, because it makes every copy stale. A change to the block's shape or the script's commands is a major. Before tagging, set the version in the first line of `AGENTS.md` to the new tag, and set `CONVENTIONS_RELEASE` in `.github/workflows/check.yml` to the same tag; a test fails when the two disagree. `REPOSITORIES.md` lists the members in the order to re-sync them.

## Tests

`sh test/run.sh` runs the scripts against temporary members with this checkout as the source. `sh conventions/conventions-check` and `sh conventions/conventions-format` run over this checkout itself. The prose check leaves out `docs/superpowers/`, because a spec or plan quotes the list it scans for, and the form does not; both leave out `.superpowers/`, tooling scratch that is not prose. CI runs all three, and `shellcheck` over the shell.

Apache 2.0.
