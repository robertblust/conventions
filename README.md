# conventions

How the robertblust, guestgraph and companygraph organizations write and work, in three
files every repository of the family vendors at a pinned release:

- `conventions/WRITING.md` — one voice, three registers, English and German.
- `conventions/WORKING.md` — git and GitHub: branches, merge commits, identity, releases, pins.
- `conventions/REPOSITORIES.md` — the family, and what pins what.

A member's `AGENTS.md` opens with a block that names them and tells any agent to read them
first, in plain words and naming no vendor. `CLAUDE.md` is the vendor adapter — `@AGENTS.md`
and one import line per shared file — and another vendor's adapter would be added the same
way the day it is needed. The block and the files are written by a script and checked in CI,
so a copy that drifts from its release turns a build red rather than quietly diverging.

## Taking it into a repository

Once, from the repository's root, naming the release to follow:

```sh
printf '{ "repo": "robertblust/conventions", "tag": "v1.3.0" }\n' > conventions.json
curl -fsSL https://raw.githubusercontent.com/robertblust/conventions/v1.3.0/conventions/conventions-sync -o /tmp/conventions-sync
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

`sh test/run.sh` runs both scripts against temporary members with this checkout as the source.
`sh conventions/conventions-check` runs over this checkout itself, `docs/superpowers/` excluded
because a spec or plan quotes the list it scans for. CI runs both, and `shellcheck` over the
shell.

Apache 2.0.
