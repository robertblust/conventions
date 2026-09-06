# Content roles — design

> `WRITING.md` says what a finished text looks like and nothing about how it is made, so every
> session invents the writer again and the style wobbles between pages. Three vendored files
> fix the process: a writer brief, a translator brief and a glossary, with a thin vendor
> adapter per member that points an agent at them. The English is drafted by the writer and
> reviewed by the owner on the branch; the German is translated from that reviewed English
> and reviewed by back-translation, which is a minute's read instead of a second original.

Status: proposed. Adds `conventions/WRITER.md`, `conventions/TRANSLATOR.md` and
`conventions/GLOSSARY.md`, changes the Languages section and the prose register of
`WRITING.md`, adds a paragraph to `WORKING.md`, extends the README recipe with two adapter
files, and lands as **v1.5.0**. Follows `2026-09-04-conventions-design.md` and
`2026-09-04-enforcement-design.md`, which this file does not restate.

---

## 1. The finding

The pages of blust.ch, guestgraph.io and companygraph.io are written the same way every time:
an agent drafts the English, the owner reads and edits it, an agent translates the result
into German. That order is nowhere in writing. `WRITING.md` fixes the voice, the registers and
the marks of both languages, and no file in the family says who drafts, who reviews, what a
draft starts from or when the German is made. No repository carries a role definition, so
the writer is a fresh prompt in every session and the prose on one site drifts from the prose
on the next in ways the marks check cannot see.

The Languages section of `WRITING.md` says the German is a second original, written by
someone who reads it and never generated and left unread. That is not what happens. The
German is translated, and the owner does not read it as prose; the sentence describes a
process the family does not run, and a rule that describes what is not done is the first one
an agent ignores.

Nothing fixes a term. `meta-model`, `guest identity graph` and `reference instance` each have
one English form because they are read from one repository; their German forms live only in
the `data-de` attributes of whichever page last needed them, and three sites can carry three
renderings of one word with nothing to say which is the family's.

A page and a README share the prose register, and the register says nothing about what
separates them: a page is read by a visitor deciding in ten seconds whether to stay, a README
by someone who has already decided. The writer needs that difference in writing or it writes
a README at the top of a landing page.

## 2. What was decided

**The process is written down, and it is the one already run.** A text starts from a brief.
The writer drafts English on the branch. The owner reviews and edits it there, in the diff
and on the rendered page. Only then does the translator make the German, from the reviewed
English and the glossary, one element at a time. An English edit to an element re-runs the
translator on that element and nothing else. The German's review is a back-translation the
translator hands back with its work, read by the owner in English.

**Two roles, vendor-neutral, vendored with the rest.** `conventions/WRITER.md` and
`conventions/TRANSLATOR.md` are Markdown in the prose register naming no vendor and no model:
what the role is for, what it takes, what it produces, what it never does, and its self-check.
They sit flat under `conventions/` beside the three files already there, so the sync script
changes by three names in one line and nothing in how it fetches.

**One glossary, vendored.** `conventions/GLOSSARY.md` holds every family term in its fixed
English and German form. The translator reads it before any text; the writer reads it so the
English form is the family's too. Its seed is harvested from what the sites already carry,
not invented; where two sites disagree, the owner picks and the other site is fixed in its own
sweep.

**Thin adapters per member, written once, like `CLAUDE.md`.** `.claude/agents/writer.md` and
`.claude/agents/translator.md` carry a vendor's frontmatter and two sentences pointing at the
briefs. They are not vendored, because they are a vendor's syntax and the shared files name
none; the README recipe gains them beside the four-line `CLAUDE.md`, and another vendor's
adapters would be added the same way.

**A page paragraph in the prose register, not a fourth register.** The voice does not change
between a page and a README; the shape does. One paragraph says how.

**The Languages section says what is true.** The German is a translation of the reviewed
English, made for a reader in Zürich or Bern and Swiss in its forms, reviewed by
back-translation. The reason the page carries German stays as it is.

**Not in this round.** A check that finds German gone stale behind an English edit: no
element carries a date, so the rule is procedural until something makes it mechanical. A
second German-reading role. A third language. The narration in `tts/`. The generated model
pages stay English in both views, as they are.

## 3. `WRITING.md`

**Languages.** The paragraph on German loses “a second original, not a translation” and
“never generated and left unread”. In their place: the German is translated from the English
after the owner has reviewed it, by the translator role, in the forms Switzerland uses,
and it is reviewed by reading the translator's back-translation, not by reading German. It is
made for a reader in Zürich or Bern because the person behind the family is Swiss; that
sentence stays. The rest of the section is unchanged.

**How a text is made.** A new section after Languages, in six sentences and their reasons.
A text starts from a brief that names the audience, the one point, the facts it may claim and
where each is shown, and the file and place it lands; a draft without a brief is a draft the
reviewer has to reverse-engineer. The writer drafts English on the branch and reports what it
wrote and what it could not verify. The owner reviews on the branch, in the diff and on the
rendered page, because the review is the pull request review already made. The translator
makes the German from the reviewed English only, one element at a time, from the glossary;
German made from a draft is German that has to be made again. An English edit to an element
re-runs the translator on that element alone. Both roles edit files and neither commits;
`WORKING.md` says who does.

**The prose register.** One paragraph after “Release notes are this register aimed at a
consumer”: a page is this register aimed at a visitor who has not decided to stay. The first
line is the one point in the words the visitor would use, and every later screen earns its
place or goes. Sentences run shorter than in a README because they are read on a phone. A
claim the page opens with is a claim the page then shows. Nothing else changes: cause before
mechanism holds where a page explains, and no adjective sells.

## 4. The two briefs

Both are written forward in the prose register, each under a page, with the same five
sections: what it is for, what it takes, what it produces, what it never does, and the
self-check it runs before it reports. Neither names a vendor, a model or a tool by product
name; the adapter does that.

**`WRITER.md`.** For: English text in the family voice, on a page, in a README, in release
notes or in an agent file. Takes: the brief, and where the brief lacks the audience, the point
or a fact's source, it asks instead of filling in. Produces: the text in the file on the
current branch, and a reply in the reply register saying what it wrote, what it changed and
which claims it could not trace to the brief or the repository. Never: a fact or a number the
brief or the repository does not show; a word in a `-de` attribute, a `de:` branch or a
`translates` spec; a commit; a run of the build; an adjective that sells. Self-check: the
first sentence carries the point; each sentence carries one idea; every claim has a source;
the marks are the English section's; a glossary term is in the glossary's form.

**`TRANSLATOR.md`.** For: the German of an element whose English the owner has reviewed.
Takes: the reviewed English, the glossary, and the elements named; where the task names no
elements, every element in the diff whose English changed. Produces: the German in the
element's `-de` attribute, or in the `de:` branch or `translates` spec the page's own agent
file names, with the markup inside the attribute kept and only its text replaced; and a reply
carrying one row per element: the English, the German, and the German read back into plain
English. Where German needed a different number of sentences, the row says so. Never: an
English word changed; an element whose English is not reviewed; a glossary term in any other
form; a `-de` on a page whose note says the model's words stay English; a commit. The German
section of `WRITING.md` is its rulebook: Sie, ss, guillemets, the spaced en-dash, Swiss dates
and the typographic apostrophe, and German syntax rather than English syntax in German words.
Self-check: the back-translation means what the English means; every glossary term is in its
form; the marks are the German section's; the attribute's quote character does not appear in
its value.

## 5. `GLOSSARY.md`

One table: the term, its English form, its German form, and a note where the choice needs a
reason. German cells are inline code, because the prose check reads no language and a German
word such as `Organisation` would be a hit; the note under the table says so, and it is the
one place in the shared files where German is quoted on purpose beside `WRITING.md`'s
paragraph.

The seed is the terms `REPOSITORIES.md` uses for what each repository is, and every family
noun the three landing pages carry: CompanyGraph, GuestGraph, guest identity graph, identity
resolution, meta-model, mental model, reference instance, pack, open core, design system, talk,
deck. Their German forms are read out of the sites' existing `data-de` attributes in the
implementation, not written in this spec; where the sites disagree, the owner picks in the
pull request and the sites that carry the other form are fixed in their own sweeps, not in
the re-sync. A term is added the first time a text needs it and the translator has to choose.

## 6. `WORKING.md`, the adapters and the recipe

**`WORKING.md`.** Under *Branches and commits*, after the sentence that an agent commits when
the owner asks: a role invoked as a subagent edits files and reports; it never commits, and
the session that invoked it proposes the message. This is the existing rule said once more
for the case the briefs create.

**The adapters.** `.claude/agents/writer.md` and `.claude/agents/translator.md` in every
member: frontmatter with the name, a one-line description that says when to use it, and the
tools limited to reading, searching and editing files; a body of two sentences that reads
`conventions/WRITING.md`, `conventions/GLOSSARY.md` and its own brief before anything else,
follows them, and reports in the reply register. No shell, no git. The prose check scans them
like any Markdown and they pass.

**The README recipe.** Step one gains the two adapter files, written beside `CLAUDE.md` with
their content in full, and the sentence that another vendor's adapters go in that vendor's
place the same way. Every member takes both, the two `.github` repositories included: the
writer serves any README, and a translator with nothing to translate costs a file.

**The block in `AGENTS.md`.** One line joins the list of three: the two roles and the glossary,
what they are for. The block changes, so every copy is stale, and the tag says so.

## 7. The release and the wave

v1.5.0. `FILES` in `conventions-sync` gains the three names; a member on v1.3.0 or later
re-executes the release's script first, so one `sync` vendors them. `test/run.sh` lists the
three among the files a sync writes; the prose check over this checkout reads the glossary
like any other file, which is what proves its German cells are skipped. `CONVENTIONS_RELEASE` and the version in `AGENTS.md` move together as before.

The wave follows `REPOSITORIES.md` order, one pull request each: both tags, `sync`, the two
adapters, nothing else. A site whose German disagrees with the glossary is not fixed in its
re-sync; that is a sweep with its own pull request, and the glossary's note names the site
until it is done.

## 8. What this is not

Not a stale-German detector; the rule that an English edit re-runs the translator is
procedural. Not a fourth register. Not a vendored `.claude/` folder. Not a change to how a
page carries German; the `-de` attribute and the `de:` branches stay what the site agent
files say. Not a translation of the model pages. Not a third language.
