<!-- conventions · v1.2.0 -->
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

The tests are `sh test/run.sh`, `sh test/spelling.sh` and `sh test/dashes.sh`. The first runs
the script against a temporary member with this checkout as the source; the second fails on any
British spelling in a Markdown file, this one included and only `docs/superpowers/` excepted;
the third fails on any closed em-dash outside a code fence, in the same files.
