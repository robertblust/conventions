# README titles — design

> A reader who opens a member of the family in a tab, or finds one in a search result, reads
> its README title first and often reads nothing else. Four members already answer that reader
> with `CompanyGraph — Meta Model`; six answer with a bare directory name that says which
> folder it is and not whose it is. The rule is the shape those four already have, the family
> list gains a column that says every member's title exactly, and `conventions-check` holds a
> member's README against its own row.

Status: proposed. Adds a paragraph to the prose register of `WRITING.md`, adds a `Title`
column to `REPOSITORIES.md`, adds a third tripwire to `conventions/conventions-check` with its
tests, and lands as **v1.10.0**. Follows `2026-09-04-conventions-design.md` and
`2026-09-04-enforcement-design.md`, which this file does not restate.

---

## 1. The finding

Thirteen repositories are in the family and their README titles were each written on the day
the repository was made. Four of them — `guestgraph/engine`, `companygraph/meta-model` and the
two organization profile repositories — open with the organization's name, a spaced em-dash
and the thing: `GuestGraph — Engine`. Six open with the directory name as git spells it:
`conventions`, `@robertblust/design`, `Field notes`, `connector-apaleo`,
`service-conventions`, and `Robert Blust — mental model`, which has the shape but not the
case. Three are sites, and they open with their domain.

A title that is the directory name tells a reader what they already knew, since they arrived
by a path that contained it, and withholds the one thing they did not: which of three
organizations this belongs to. `conventions` and `service-conventions` are the clearest cost —
two repositories in two organizations with nearly one name, told apart today only by the URL
above the page. `@robertblust/design` is a second cost of a different kind: it answers with a
package name, which is how npm refers to the repository and not how a person does.

Nothing in the family says a title has a shape, so nothing is wrong with any of them. The
four that agree agree by habit, and habit is what the next repository will not inherit.

## 2. What was decided

**A README's title is the brand, a spaced em-dash, and the thing.** `CompanyGraph — Meta
Model`. The brand is the organization written as prose writes it — Robert Blust, GuestGraph,
CompanyGraph — not the GitHub account name, and the thing is the repository named in words
rather than in the hyphens a directory needs. The shape is the one four members already have,
so this ratifies more than it invents.

A site repository is titled by its domain alone: `blust.ch`, `guestgraph.io`,
`companygraph.io`. A domain is already the brand and the thing in one word, and prefixing it
would make `GuestGraph — guestgraph.io`, which says the brand twice. This is a decision, not
an oversight, and the rule says so where a reader will look for it.

`profile/README.md` in a `.github` repository is the page GitHub renders as the organization
profile. It is not a repository's README, it is the organization's front page, and it keeps
its own title — `# GuestGraph`. The repository's own `README.md` beside it follows the rule
and already does.

**The table is the authority, not the shape.** `REPOSITORIES.md` gains a `Title` column that
spells out every member's title in full. A reader who wants to know how a title is built reads
the rule; a member that wants to know its own title reads its row. That split is what keeps
the two exceptions from needing a clause in the check: the sites' rows simply carry their
domains, so the check compares a string to a string and never learns what a site is.

## 3. `WRITING.md`

One paragraph in the prose register, after the paragraph on paragraphs and lists, in the
register's own voice:

> A repository's `README.md` opens with an H1 of the brand, a spaced em-dash and the thing:
> `CompanyGraph — Meta Model`. The brand is the organization as prose writes it, not as GitHub
> spells the account; the thing is the repository in words, not in the hyphens a directory
> needs. A reader arrives from a search result or a tab with no other context, and the brand
> is the part they cannot recover from the path. A site repository is titled by its domain
> alone, because the domain is already the brand and the thing, and `profile/README.md` in a
> `.github` repository is the organization's front page rather than a repository's README and
> keeps its own title. `REPOSITORIES.md` carries every member's title in full and a tripwire
> holds each member to its row.

## 4. `REPOSITORIES.md`

The table gains a `Title` column between `Repository` and `Purpose`, because the title is what
the repository calls itself and the purpose is the sentence about it, and a reader scanning
the list reads them in that order. The column is the full title, the em-dash included, exactly
as the README must spell it.

| Repository | Title |
|---|---|
| robertblust/conventions | Robert Blust — Conventions |
| robertblust/design | Robert Blust — Design |
| robertblust/robertblust.github.io | blust.ch |
| robertblust/mental-model | Robert Blust — Mental Model |
| robertblust/field-notes | Robert Blust — Field Notes |
| guestgraph/guestgraph.github.io | guestgraph.io |
| guestgraph/engine | GuestGraph — Engine |
| guestgraph/connector-apaleo | GuestGraph — Apaleo Connector |
| guestgraph/service-conventions | GuestGraph — Service Conventions |
| guestgraph/.github | GuestGraph — Organization |
| companygraph/companygraph.github.io | companygraph.io |
| companygraph/meta-model | CompanyGraph — Meta Model |
| companygraph/.github | CompanyGraph — Organization |

Seven titles are what the repository already says. Six move: `conventions`,
`@robertblust/design`, `Field notes`, `Robert Blust — mental model`, `connector-apaleo` and
`service-conventions`. `design` loses its package name from the title and keeps it where it is
load-bearing, in the install fence that names
`"@robertblust/design": "github:robertblust/design#v0.1.0"`.

The list section above the table says what the list is; nothing there changes. A repository
that joins the family arrives with a row, and the row now carries a title, so the title is
decided in the same pull request that admits the member rather than in the member's first
README.

## 5. The check

`conventions-check` scans Markdown for two things today, a British spelling stem and a closed
em-dash, and both are properties of a line. The title is a property of a repository, so the
new tripwire runs once, after the walk, and reports in the same `✗ file:line: what` form.

It needs the member's identity. In CI the runner sets `GITHUB_REPOSITORY` to `owner/repo`,
which is the answer with nothing to parse; outside CI, `git remote get-url origin` gives a URL
that both the SSH and HTTPS forms end with `owner/repo`, optionally with `.git`. Neither is
consulted when `CONVENTIONS_REPO` is set, which is how `test/run.sh` points a fixture at a row
without making the fixture a clone.

Three ways the identity or the row can be missing, and all three are a quiet pass with a line
saying why, never a failure. A checkout with no remote and no `GITHUB_REPOSITORY` is a
worktree or a fixture, and a tripwire that fails there fails on the developer's desk for a
reason that has nothing to do with their change. An `owner/repo` with no row in
`REPOSITORIES.md` is a repository outside the family, which the vendored files are allowed to
be used by and which the family list does not govern. A tree with no
`conventions/REPOSITORIES.md` is a member that has not vendored it, which the sync check
already reports in its own words.

Where identity and row are both found, the check reads the first line of `$ROOT/README.md` and
compares it to the row's title with its `# `, whole line against whole line. A first line that
is not an H1 at all is the same failure as a wrong one, and comparing whole lines is what lets
the message show the difference — reporting the title alone would print two identical strings
and name no fault:

```
✗ README.md:1: first line is "# @robertblust/design", REPOSITORIES.md asks for "# Robert Blust — Design"
```

The comparison is exact, byte for byte after trailing whitespace is dropped. An em-dash that
has become a hyphen, a lost space, a lowercase word: each is a real difference to a reader and
there is no reading under which an approximate match is the right answer. The code is POSIX
`sh` with `awk`, `sed` and `grep` as the rest of the script is, and passes `shellcheck` in the
step that already runs it.

`test/run.sh` gains four cases beside the prose tripwires it drives today: a fixture whose
README matches its row passes, one whose README differs fails with the line above, one whose
`CONVENTIONS_REPO` names a repository absent from the table passes with the outside-the-family
line, and one with no identity available passes with the no-identity line.

## 6. The wave and the release

The check and the table ship in the same `conventions/` directory, so a member receives the
rule and the row that satisfies it in one sync. **No member is ever red on a rule it has not
yet received**, and no member needs a title fixed ahead of its re-sync to stay green: the
re-sync pull request carries the new table, the new check and the one-line README edit
together, and the `conventions` job goes from green to green.

This is a minor release, v1.10.0, and `WORKING.md` is the reason that needs an argument: a
change that asks the taking repository to do anything beyond re-syncing or re-pinning is a
major there, and six members do have to edit a line the sync script will not write for them.
The line is inside the re-sync pull request, the table that says what to write arrives in the
same commit that starts asking for it, and seven of the thirteen have nothing to do at all.
That is a minor with notes that carry their weight, not a major. The notes name the six, name
the line, and say the title is read from the `Title` column and nowhere else.

The wave follows the order `REPOSITORIES.md` already prescribes and this file does not repeat.
`conventions` fixes its own title in the release pull request, because the repository that
ships the check runs it on itself in CI.

## 7. What this is not

It is not a rule about what a README contains. The title is the first line; the sentence under
it, the sections, the badges and the length are the prose register's business and unchanged.

It is not a rule for every Markdown file. `SERVICE.md`, `AGENTS.md`, a field note and a spec
each title themselves for their own reader, and the check reads only `README.md` at the root
of the tree it was pointed at.

It does not derive a title. `connector-apaleo` becomes `GuestGraph — Apaleo Connector` and no
transformation of hyphens and case produces that, which is the reason the table spells each
one out rather than the check computing it.

It does not govern the organization profile page. `profile/README.md` is written for a visitor
who has never heard of the organization, and `# GuestGraph` above a one-line claim and a link
is the right title for that page.
