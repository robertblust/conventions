# Family resync — design

> Conventions is the one repository that knows the whole family, and today it knows it only as prose: a list, a paragraph of what pins what, and an order to re-sync in. A re-sync wave is planned by hand each time, and the pins it moves are read from memory or from a local clone that may be stale. This design gives conventions a report that reads every pin from GitHub and says what is behind, and a run that moves the pins the owner chooses, level by level, through to merged pull requests and releases.

Status: proposed. Adds `conventions/PINS.md` to the vendored files, adds `family/report.mjs`, `family/resync.mjs` and two agent skills to this repository, adds a paragraph to `WORKING.md` and a section to the README, and lands as a minor release after the pins stack of #60, #61 and #63. A wave then adds `pins.json` to every member. Follows `2026-09-24-v1-29-0-wave.md`, whose hand-made wave this automates.

---

## 1. The finding

A scan of every member's pin files on Sep 28, 2026 found two mechanisms and one rule. Code or rules a repository runs or is checked against are pinned by tag; content it draws or serves is pinned by commit; the connector's pin on the engine's contracts is a commit only because the engine has no releases. #63 writes that rule into `WORKING.md`.

The same scan found 55 pairs of a member and what it pins: 20 on conventions and 35 between members. The pairs form a graph five levels deep, from conventions at level 0 to the three MCP deployments and guestgraph.io at level 4, so a meta-model release reaches mcp-blust-ch only after mcp-server and chat-server have each taken it and released.

It also found pins that `REPOSITORIES.md` does not name, even with #60: the three sites and chat-server take mcp-server by tag, and the three deployments take design by tag in both `package.json` and `chat/package.json`. A description of pins kept by hand drifts, and nothing notices. The report reads pins from the members, never from that file, and says where the two disagree.

The scan read local clones, and a local clone is not the family. The remote `main` of each member is.

## 2. What was decided

**A chosen resync is the owner's word for everything it needs.** Once the owner picks the chains to run, the run merges, tags, releases and — in the three deployments — deploys without asking again. It stops only where a person's judgment is needed, and it stops by blocking a member, not by asking. This is what lets the same run become a GitHub Action later.

**The run blocks rather than guesses.** A member is blocked when a step fails, when its suite fails, when its required check does not pass, when its worktree has no `user.email`, or when its `main` holds commits since its last tag that the run did not make. A blocked member holds every member downstream of it, and the rest of the run goes on. Nothing is released that carries work without notes a person wrote.

**The contract is central and the steps are the member's.** `conventions/PINS.md` defines the kinds of pin and how each one moves. Each member declares its own pins, and the commands that rebuild it after a move, in a `pins.json` at its root. Conventions holds the contract, the graph and the order; the member holds the knowledge its own tooling needs, where its own suite exercises it.

**The run releases only the minor that a re-pin needs.** A member between two levels is released so that the next level can take it, always as a minor, with notes that name each pin it moved and link the upstream release. The run takes an upstream major like any release; it never makes one. It never releases conventions.

## 3. `conventions/PINS.md` and `pins.json`

`PINS.md` is vendored like the other shared files, so `conventions-sync` writes it and `test/run.sh` lists it. It names six kinds.

| Kind | The line | How it moves |
| --- | --- | --- |
| `conventions` | `tag` in `conventions.json` | set the tag, `sh conventions/conventions-sync sync`, and the `uses: robertblust/conventions/.github/workflows/check.yml@<tag>` line |
| `service-conventions` | `tag` in `service-conventions.json` | set the tag, `sh service-conventions/service-conventions-sync sync` |
| `npm-tag` | `github:owner/repo#tag` in a `package.json` | set the tag, `npm install` |
| `source-commit` | an object with `repo` and `commit` in a JSON file, at the top or under a key | set the commit of the object whose `repo` matches |
| `contract-commit` | a string `owner/repo@commit:path` in a JSON file | set the commit of every string for that repository |
| `core-release` | `core.version` in `.companygraph/manifest.json` | the entry's own `move` command |

A member's `pins.json` lists its pins and its two member-wide steps:

```json
{
  "pins": [
    { "kind": "npm-tag", "file": "package.json", "repo": "robertblust/design", "after": ["npm run design"] },
    { "kind": "source-commit", "file": "source.json", "repo": "robertblust/mental-model", "after": ["npm run model", "npm run pages"] }
  ],
  "verify": ["npm test"],
  "release": ["npm version minor --no-git-tag-version"]
}
```

`after` runs in the worktree once that pin has moved, in order. Any entry may give `move`, a command with `{version}` in it, which replaces the kind's own move; `core-release` must. A commit pin may give `watch`, a list of paths in the upstream; it is then behind only when a commit since the pinned one touches one of them, so the connector is not re-pinned for an engine change that left its contracts alone. `verify` runs once all of a member's pins have moved. `release` runs when the member is released and leaves the version bump uncommitted for the run to commit. A member that releases nothing has no `release`.

The conventions pin is declared like any other, so a member's `pins.json` is the whole of what it takes. A test in `test/run.sh` holds the format, and the report holds each entry to the line it names.

## 4. The report

`node family/report.mjs` writes `dist/resync-YYYY-MM-DD.md` and `dist/resync-YYYY-MM-DD.json` with the date of the machine it runs on, and a second run on the same day overwrites both. `dist/` is ignored. The report changes nothing else: it clones nothing and writes nowhere but `dist/`. It needs `gh` with read access to the three organizations and Node, the runtime `conventions-format` already asks for, and it has no dependencies.

It reads the members from the table in `REPOSITORIES.md`, and for each member reads from `main` through `gh api`: `pins.json`, every file a pin names, and every `conventions.json`, `service-conventions.json`, `package.json`, `source.json`, `api-sources.json` and `.companygraph/manifest.json` it has, so that a pin `pins.json` does not declare is still seen. For each upstream it reads the latest GitHub Release — a tag without a Release is not a release — or the head of `main`, and for a commit pin the count of commits between, from the compare API, filtered by `watch` where the entry gives it. For each member other members take from, it reads the commits on `main` since its last tag.

Each pin has one status. **current**: nothing to do. **behind**: a newer release, or a newer commit, is there to take. **unmanaged**: the pin is in the member's files and not in its `pins.json`, or the member has no `pins.json`; it is shown and never moved. **drift**: a `pins.json` entry names a line the file does not hold. A member other members take from is **blocked** when `main` holds commits since its last tag.

The Markdown opens with the count of each status and the blocked members. Then one table per level, 0 to 4, with the member, the pin as kind and file, the upstream, what is pinned, what is available and the status. Then the chains, numbered: each behind pin, and every member downstream of it that would have to release or re-pin for the change to reach the last level, as `meta-model v0.56.0 → mcp-server → chat-server → mcp-blust-ch`. Last, what disagrees: a pin the members hold that the paragraph and drawing of `REPOSITORIES.md` do not show, a member of the table the scan could not reach, and a pin whose upstream is outside the family, which is named and never followed.

The level of a member is one more than the highest level of what it pins, computed from the pins and not taken from the re-sync order in `REPOSITORIES.md`. A cycle is reported and blocks every member on it.

## 5. The run

`node family/resync.mjs <report.json> <all | chain numbers…> [--dry-run]` works through the levels from 1 to 4. The unit of choice is the chain, because a pin moved halfway is a pin that helps no one. Before each level the run reads the upstream releases and commits again, so a release it made at level 2 is behind at level 3 though it did not exist when the report ran.

A member gets one pull request per run, carrying every pin of it that moves in this run. For each member, in order:

1. Clone it beside the others under `~/git/<owner>/` if it is missing, fetch, and fast-forward the local `main` where the clone is on `main` and clean; a clone that is not is left alone and named in the record.
2. Add the worktree `../<repo>-resync-YYYY-MM-DD` on the branch `resync-YYYY-MM-DD` from `origin/main`, or reuse it where a run of the same day made it.
3. Read `git config user.email` there, and block the member if it is empty.
4. Move each pin as its kind or its `move` says, run its `after`, then run the member's `verify`.
5. Commit in the git register: the subject names what the member now takes, the body names each move and the upstream notes, and `Verified:` names the commands that ran and passed.
6. Push, open the pull request, wait for its required check, bring a branch that is behind `main` up to date with `gh pr update-branch` and wait again, merge with `gh pr merge --merge`, and remove the worktree and the branch.
7. Where a member of a later level will re-pin this one in this run, release it: run `release` on a new branch through its own pull request as in step 6, then tag the next minor and create the GitHub Release with the generated notes.

Any failure blocks the member as section 2 says, and the members downstream of it are held. A second run on the same day finds the branch, the pull request and the release where the first left them and goes on from there. `--dry-run` goes as far as the local commit and prints each GitHub action it would take.

The run writes `dist/resync-run-YYYY-MM-DD.md`: each member touched, with its pull request, its merge commit and its release, or why it was blocked or held.

## 6. The skills

Two skills in `.claude/skills/` are the agent's way in and do nothing the scripts do not. `family-report` runs the report and says in the reply register what is behind, what is blocked and what disagrees. `family-resync` runs the report, shows the chains, asks the owner to choose all or a list, and runs `resync.mjs` with that choice. The run needs no subagent, because every step is a command.

## 7. `WORKING.md` and the README

`WORKING.md` gains a paragraph under "Pull requests": a resync the owner chose is the owner's word for every merge, release and deploy it needs; the run stops by blocking a member wherever a person's judgment is needed; and it never releases work that has no notes a person wrote. The README gains a section on the report and the run: what they read, where they write, and how a member joins by adding its `pins.json`.

## 8. Tests

Every call to `gh` goes through one function, so a test can put fixtures in its place. The report is tested against a fake family of pin files, releases and `main` heads: each status, the levels, a cycle, the chains, a blocked upstream, a `watch` that filters, and a pin outside the family. The run is tested against real git repositories in a temporary folder, with a `gh` on the path that records its calls: the steps of a member, a failure that holds the members downstream, a run cut short and run again, and conventions never released. Both run in `test/run.sh`, so the shared job runs them.

## 9. The rollout

One pull request each, in this order. First, #60 and #61 are corrected for the pins they miss. Then this repository gains the contract, the scripts, the skills, the tests, the paragraph and the section, and conventions is released as a minor. Then a wave adds `pins.json` to every member in the re-sync order, which the report shows as unmanaged until it lands. Then the first run: a dry run, one chain, and all.

## 10. What this is not

It does not fix a member whose suite fails; the member is blocked and a person or a separate agent session fixes it, and an agent fix can be designed once real failures show its shape. It does not decide a major release, and it does not release conventions or any work that a person has not written notes for. It is not the GitHub Action: that is a later spec, and it has to settle which credential can merge in three organizations and whose name the commits carry.
