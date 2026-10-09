---
name: family-resync
description: Use when the owner asks to resync the family, to bring members up to the latest releases or commits of what they pin, or to run chains from the family report. Runs the report, asks which chains to run, then merges, tags and releases through the chosen chains.
---

# Family resync

Start it only when the owner asks, never as the last step of a release, as `conventions/WORKING.md` says under Releases and pins.

1. Run the `family-report` skill and show the owner the chains, numbered as the report numbers them, with the blocked members beside them.
2. Ask the owner which chains or members to run: all, a list of chain numbers, or members' names — a name moves that member alone and leaves what is downstream of it for a later run. Offer a dry run the first time a chain is run. The choice is the owner's word for every merge, release and deploy the run needs, as `conventions/WORKING.md` says, so never run a chain the owner did not choose, and never widen a choice.
3. Run `node family/resync.mjs dist/resync-<date>.json <all | numbers… | names…>`, adding `--dry-run` when chosen, in the background with the longest timeout, because every member waits for its required check.
4. Report the run record it writes: what merged and released, and each blocked or held member with its reason. A blocked member is a decision for the owner; propose what would unblock it and do nothing further on it without being asked.

Merge, tag and release only through the script, never by hand in the same session, so the run record stays the whole account of what the run did.
