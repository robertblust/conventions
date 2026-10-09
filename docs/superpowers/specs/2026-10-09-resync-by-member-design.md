# Resync by member

> A family resync runs what the owner chooses from the report, and today the smallest thing it can choose is a chain: a pin that is behind and every member downstream of the one that takes it. Releasing meta-model and moving only CompanyGraph's mental model is therefore not a run the resync can make; choosing that chain also rebuilds and deploys the site and the MCP host that draw the model. And a member fixed by hand after a run blocked it, as mcp-server was after meta-model v0.88.0, then blocks the next run again as unreleased work. This spec lets a run move named members alone, and lets it release a member whose only work since its last release is a move of its own pins.

Status: decided by the owner on October 9, 2026: of the scenarios weighed, a run stops early (one taker, one level, one deployment before the others) and continues after a member fixed by hand; it does not release work it did not make other than a pin move, leave members out of `all`, or move content pins alone. A run picks members by name beside chain numbers; a name moves that member alone. A merged pull request that moved one of a member's declared pins counts as the run's own work, test fix and all, and the release notes name it.

---

## 1. What a run cannot do today

`node family/resync.mjs <report.json> <all | chain numbers…>` takes `all` or chain numbers. A chain is one pin that is behind, and its steps are its taker and everything downstream of it, level by level (`stepsOf` in `family/graph.mjs`). A run moves the union of the chosen chains' steps, so a chain cannot stop partway: the chain for meta-model's release into `companygraph/mental-model` moves the mental model, then companygraph.io, then mcp.companygraph.io.

The scenarios the owner wants, and none of them a run can make today:

1. **One taker.** Release meta-model and move only `companygraph/mental-model`; its site and MCP host follow in a later run.
2. **One level.** Move the three instances onto a new core and stop before any site or MCP deployment.
3. **One deployment before the others.** Move mcp.companygraph.io alone, look at it live, then move mcp.guestgraph.io and mcp.blust.ch.
4. **Continue after a hand fix.** A member blocks; the owner fixes it in a pull request that moves its pin and changes what the move broke; the next run carries on from there.

Scenario 4 fails today for a different reason. A rerun already continues: it recomputes from the pins, and a member whose main holds its moved pins is left as it is. But `releaseBlock` in `family/assess.mjs` counts every single-parent commit since the member's last release as work unless it came from a `resync-` pull request or touched only vendored files, and a hand fix is neither, so the rerun refuses to release the member, and everything taking it by tag is held. On October 9 that held the chat server, three sites and three MCP deployments behind mcp-server #155 until a person released mcp-server by hand.

Weighed and left out: releasing unreleased work the run did not make, beyond a pin move; leaving named members out of `all`; and moving only commit pins.

## 2. Picking members by name

A pick is `all`, a chain number, or a member's name as `REPOSITORIES.md` lists it. Names and numbers mix in one run.

```
node family/resync.mjs dist/resync-<date>.json companygraph/mental-model
node family/resync.mjs dist/resync-<date>.json robertblust/mental-model companygraph/mental-model guestgraph/mental-model
node family/resync.mjs dist/resync-<date>.json companygraph/mcp-companygraph-io
node family/resync.mjs dist/resync-<date>.json 3 companygraph/mental-model
```

A name moves every pin of that member the report shows behind, and adds nothing downstream of it to the run. A chain number keeps its meaning. The run's members are the union of the chosen chains' steps and the named members, moved level by level as today.

A release follows today's rule unchanged: a member is released only where something in the same run takes it by tag (`releasesIn`). A member named alone and taken by tag is therefore moved and merged but not released, and the next report offers its release as a chain of its own, as it already does for a member a run merged and did not release.

The run record gains one line naming the members downstream of what moved that the run left alone, so the owner sees what the next run would take; the next report offers them as ordinary chains.

A name that is not a member of `REPOSITORIES.md`, or a member with no pin behind in the report, refuses the run before it moves anything and says which name and why, as an unknown chain number does today.

## 3. A pin move made by hand is the run's own work

A commit since a member's last release counts as the run's own, and not as work, when it belongs to a merged pull request that moved one of the member's declared pins: the value a `pins.json` entry of the member reads in its file differs between the merge commit's first parent and the merge. The first parent is the commit the merge followed, which is what the pull request changed on main; a stacked layer's base is not that commit, and a layer whose lower pull request had already moved the pin would otherwise count as a move itself. A conventions or service-conventions pin does not count: a hand move of one is a re-sync, which owes no release, as the rule for vendored moves says. Every commit of such a pull request counts, the fix that came with the move included, because the pull request is the person's account of why the move needed it.

Every other commit still counts as work and still blocks, as now: a pull request that moved no pin, and a commit that belongs to no pull request. A pull request whose pin values cannot be read counts as work, keeping `releaseBlock`'s rule that blocking is the side a wrong guess can be undone from, unless the commit only re-synced: an unreadable pin fails to prove a move and is no evidence of work. A member with no declared pin that propagates is not asked at all.

The release notes the run writes for such a member are its re-pin notes and one line for each hand pull request they carry: "It also carries #155, made by hand: Takes meta-model v0.88.0", linked, naming the pull request by its title and not paraphrasing it. A hand pull request may change more than its pin, so the first paragraph of those notes does not say the release changes nothing else.

The report, in its list of a member's unreleased commits, marks such a commit `(pin move)` beside the existing `(re-sync only)`, so the owner sees before a run what it would release and why. The chain that offers the release of a member whose main holds such pull requests names them in its heading.

## 4. Errors

- A pick that is neither `all`, a positive whole number nor a member's name fails in `parseArgs`, with the usage line.
- A name not in `REPOSITORIES.md`, a named member with nothing behind, or a named member on a cycle, which has no level to move at, refuses the run before it moves anything.
- A pull request that cannot be read leaves its commits counted as work.

## 5. Tests

In `test/family/`, with the fake GitHub the tests already use:

- `parseArgs`: one name, several names, names mixed with numbers, an unknown name, a malformed name.
- `orchestrate`: a named member moves alone and nothing downstream runs; the record's leftover line names what was left; a name and a chain mixed move level by level; a named member with nothing behind refuses; a named member taken by tag is merged and not released.
- `releaseBlock`: a merged pull request that moved a declared pin counts as the run's, its fix commit included; one that moved no pin blocks; a pin-move pull request beside a separate feature commit blocks; a pull request that cannot be read blocks.
- The release notes carry the "made by hand" line, and the report marks a pin-move commit `(pin move)`.

## 6. What it costs

A change to this repository's own `family/` scripts and their tests, the README's section on keeping the family in step, and the `family-resync` skill, which offers names beside chain numbers when it asks the owner what to run. `family/` is not vendored, so no member changes and nothing has to be re-synced: a run uses the scripts from conventions' main the moment they merge. A conventions release is optional and marks only the change. `all` and chain numbers, and every run that uses them, behave as before.
