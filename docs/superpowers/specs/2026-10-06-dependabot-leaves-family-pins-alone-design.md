# Dependabot leaves the family's pins alone — design

> WORKING.md says a pin moves when the owner decides and that no bot proposes it, and the family resync now moves pins with everything their moves rewrite. Every member that keeps a `dependabot.yml` still lets Dependabot propose them. This states the rule in `PINS.md` for family repositories and for the tools a conventions release pins, and holds it in `conventions-check`.

Status: proposed. Decided on 2026-10-06 with the owner, against this repository at `0362479` (v1.43.0), from companygraph/meta-model#294, a Dependabot bump that failed because the version it moved is pinned twice more.

---

## 1. The gap

Dependabot watches what a member's manifests name, and a family pin is one of them. Run over the fourteen members that keep a `dependabot.yml`, on 2026-10-06, the check this adds named 39 family pins Dependabot would propose. Every member watches the conventions workflow, `robertblust/conventions/.github/workflows/check.yml`. The three sites and the three MCP hosts watch their npm pins of robertblust/design, companygraph/meta-model and companygraph/mcp-server, the hosts the workflows of companygraph/chat-server, and robertblust/mental-model the instance check of companygraph/meta-model. It is not hypothetical: companygraph/meta-model#76 moved the conventions workflow from 1.10.0 to 1.11.0 on 2026-09-15 and was merged, leaving `conventions.json` and the vendored copy behind the workflow until the next sync.

guestgraph/service-conventions v0.12.0 solved the same problem for what it vendors into a service: its `spring/dependabot.yml` ignores what the parent pins, and its own test holds the list to the parent. This is that rule for the whole family, and the check is what keeps the list from drifting.

## 2. The rule

`PINS.md` gains a section: where a member keeps `.github/dependabot.yml`, each block ignores every family repository it would otherwise watch, and Dependabot keeps everything else in view. A family repository is one `REPOSITORIES.md` lists. What a block watches is read from the member's own files in the block's directory: `uses:` lines under `.github/workflows` for `github-actions`, `github:owner/repo#tag` values in a `package.json` for `npm`, and `git::` module sources in `.tf` files for `terraform`. A `dependency-name` is a glob, so one entry, `"*owner/repo*"`, covers every path of a repository.

## 3. The check

`conventions-check` reads `dependabot.yml` block by block, with `directory` or `directories`, and the member's pins as §2 names them, and fails with one line per family pin a block watches and no pattern of that block covers. Each line names the block, the pin, the file and line that holds it, and the entry to add. No `dependabot.yml`, no vendored `REPOSITORIES.md` or no family pin is a pass. It needs only `sh`, `awk`, `find` and `grep`, as the rest of the script does, since a Java service runs it too.

`test/run.sh` holds it on a fixture member: a member without the file passes; a conventions workflow, a family package and a family module are each named in the block that watches them; a comment, an action outside the family, a package outside it and a manifest no block watches are not; globs, an exact name, a `directories` list, a trailing slash and a comment after a value all cover; and an ignore naming another package covers nothing.

## 4. Release and how members take it

A minor, by the owner's word, while the family is still working toward its final release: the script's commands and the block's shape are unchanged, and a member takes it by adding the lines the check names to its own `dependabot.yml`. The notes say so first. On the sites, the group that kept `@robertblust/design` apart for reading has nothing left to hold once the package is ignored, and the member decides whether to keep its comment.

guestgraph/engine and guestgraph/connector-apaleo vendor their `dependabot.yml` from guestgraph/service-conventions, whose sync refuses a local edit, so their entry, `"*robertblust/conventions*"` in the `github-actions` block, comes from a service-conventions release that both take before this one reaches them.

A tool whose version a conventions release pins counts as a family pin wherever a `package.json` declares it. `markdownlint-cli2` is the family's Markdown form: `conventions-format` runs it at the version it pins, and companygraph/meta-model declares it and pins it again in its own form check, which is why meta-model#294 failed when Dependabot moved one copy. The check keeps the list in `TOOLS`, and `test/run.sh` holds it to the tools `conventions-format` runs. Today only meta-model declares one, and the check names its line like any other.
