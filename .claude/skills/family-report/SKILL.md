---
name: family-report
description: Use when the owner asks which members of the family are behind on a pin, what a resync would move, whether the family is in step, or for the family report. Reads every member's pins from GitHub and writes dist/resync-<date>.md in this repository.
---

# Family report

Run `node family/report.mjs` from the root of this repository. It needs `gh` with read access to robertblust, guestgraph and companygraph, and it changes nothing but `dist/`.

Read the Markdown it names and reply in the reply register of `conventions/WRITING.md`: the counts first, then the blocked members with their reasons, then the chains by number, then what disagrees. Link the report. Say what a disagreement means for the reader — a pin the drawing does not show is a change to `conventions/REPOSITORIES.md`, and a member with unmanaged pins needs its `pins.json` as `conventions/PINS.md` describes — and do not fix either without being asked.
