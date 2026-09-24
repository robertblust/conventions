# German pipeline — design

> The German of the three sites is correct in its marks and weak as German: English idioms carried over word for word, a modal or a hedge lost in the shortening, Germany's words where Switzerland has its own. The one check it gets, the translator's own back-translation, cannot see most of that, because a calque reads back as the English it was copied from and a translator reads back what it meant. The German is made instead by three agents that never check their own work — a translator, an editor that reads the German without the English, and a back-reader that renders it literally — and the owner reads the few sentences the editor could not settle, in German, and picks.

Status: proposed. Adds `conventions/GERMAN.md`, `conventions/EDITOR.md` and `conventions/BACKREADER.md`, rewrites `conventions/TRANSLATOR.md`, adds rows to `GLOSSARY.md`, changes the Languages section, "How a text is made" and the German section of `WRITING.md`, extends the README recipe with two adapter files, and lands as **v1.29.0**. A design release and one pull request per site follow. Supersedes the review decision of `2026-09-06-content-roles-design.md` and takes up two items that spec left out of its round: a second role that reads German, and a check that finds German gone stale.

---

## 1. The finding

A German-only review of every `-de` value on the three sites, 985 of them, found about 170 with at least one fault: 57 on blust.ch, 52 on guestgraph.io, 62 on companygraph.io. The marks held everywhere; no page carried ß, a German em-dash or du. The faults were in the language:

| Kind | Share of the findings | Examples |
| --- | --- | --- |
| Calque or English syntax | about a third | «ich baue beide offen», «das ist die Steuer», «hält den Sitz», «war der Punkt» |
| Meaning moved | about a quarter | *over* twenty-five years became a bare count; *site* became «Seite» on six pages; *cannot be left* lost its modal; *probabilistic* dropped from a merge |
| A term in two forms | about 25 terms | Firma and Unternehmen, Entscheid and Entscheidung, Reservation and Reservierung |
| Germany's word, or a glossary breach | the rest | «Auftragsverarbeiter» for the DSG's «Auftragsbearbeiter», «Offener Kern», «eure» |

One section carried no German at all: guestgraph.io's `apaleo-unreachable` has `data-de=""` on its heading and its paragraph, so a German visitor sees an empty section, and no check noticed.

Each of the three reviewers estimated what back-translation would have caught: 15 to 25 percent. A calque back-translates perfectly, because it is English syntax; register, grammar and Swiss usage leave no trace in English; and the back-translation was written by the translator, who renders what it meant — «Seite» came back as *site* and «erklärt» as *declares*.

## 2. What was decided

**The owner reads German, a little.** The 2026-09-06 decision that no person reads the German is reversed. The owner reads the sentences the editor flags, each with two or three alternatives in German and a one-line English gloss, and picks; a page costs minutes, not an evening. Everything else is settled by agents and by rule.

**Three roles, none of which checks its own work.** The translator makes the German of a whole page from its English. The editor reads that German without the English and corrects it by rule or flags it for the owner. The back-reader, also without the English, renders it into literal English, and the session that runs them sets the English against that rendering and sends back any value whose meaning moved. The translator writes no back-translation of its own any more.

**De-CH is words as well as marks.** `GERMAN.md` holds what the German section of `WRITING.md` cannot: the Swiss word where Switzerland and Germany differ, the habits that made the pages read translated, the forms a check refuses, and the owner's choices, kept so a choice made once is not asked again.

**Checks where a rule is mechanical.** An empty `-de`, a refused form and the informal plural fail the page check; an English edit that leaves its German untouched fails too.

**Piloted before it was written down.** The pipeline ran on all of blust.ch on 2026-09-23 and 24, uncommitted, and the owner read the result on the served pages and made every pick. What the pilot taught is in section 7; the pilot's German is the first site pull request of section 6.

**Not in this round.** A third language. German for the model's own words, which stay English in both views. Any change to the English beyond what the translation surfaced and the owner decided.

## 3. The pipeline

Each step is a separate agent with its own context, dispatched by the session working on the page, which is the only place that holds the English and the German together.

1. **Translator** (`TRANSLATOR.md`). Takes every German value of one page, each beside its English and the German there now, and makes the German from the English in page context. Keeps existing German word for word where it is right and reads as German, because a change the owner has to read is a cost. May split, join and reorder sentences; may not drop a word that carries meaning. Returns the changed values, one line of why each, and its doubts.
2. **Editor** (`EDITOR.md`). Takes the German alone, in page order, and the glossary and `GERMAN.md`. Returns nothing for most values, a correction where a rule decides, and a flag where the fix is a choice: the German as it stands, what a Swiss reader stumbles on, and two or three complete alternatives with an English gloss, the first its recommendation.
3. **Back-reader** (`BACKREADER.md`). Takes the German alone, after the editor's corrections and each flag's first option are applied, and renders every value into literal English: a pronoun with its referent in brackets or «[refers to nothing]», both readings of a word that has two.
4. **Fidelity**, run by the dispatching session or a fourth agent with the English: sets the English against the back-reading and returns every value whose meaning moved, with a fix that keeps the editor's wording as far as it can. In the pilot it restored 18 meanings: the editor had moved 12 of them while improving idiom, and 6 were in the German before and the translator had kept them. The editor and the fidelity step are both needed, in that order.
5. **The owner** reads the flags and the translator's term doubts and picks. A term choice becomes a glossary row; a sentence choice that generalizes becomes a row in `GERMAN.md`'s table of the owner's choices. A flag the fidelity step fixed shows its fixed German as the one on the page.

Translation surfaces English problems too: in the pilot, two places where a page's English contradicted itself. Those go to the owner as English questions, because the English is the master; the German follows the English until the owner decides.

A page's German values are addressed by a stable id — the n-th `-de` attribute in source order, and `js.title` and `js.desc` for the `de:` object — so the German can be handed to an agent without the English and written back without an agent touching the HTML. The tool that does this is section 5's `design german`.

## 4. `conventions/`

`GERMAN.md`, `EDITOR.md` and `BACKREADER.md` are new and `TRANSLATOR.md` is rewritten, each in full in the appendix. `GLOSSARY.md` gains these rows, each the owner's choice of 2026-09-24 or a form every page already uses:

| Term | German | Note |
| --- | --- | --- |
| site | `Website` | A site of several pages; `Seite` is one page. |
| page | `Seite` | One page of a site. |
| company | `Firma` | The owner's choice over `Unternehmen`; `Unternehmensführung` stays, a fixed term for the discipline. |
| company of one | `Ein-Personen-Firma` | |
| decision | `Entscheid` | A decision taken; `Entscheidung` stays for the act of deciding, as in `Entscheidungshilfe`. |
| release | `Release` | Kept English like `Build` and `Commit`; neuter, `das Release`. |
| deck | `Präsentation` | The file a talk is given from; the talk is `Vortrag`. Replaces the row's "chosen the first time a text needs it". |
| meter | `Abrechnungsgrösse` | The one unit a bill is computed from. |
| career break | `Auszeit` | |
| role | `Rolle` | A position held, as the Role kind; never `Stelle`. |
| independent period | `Phase der Selbständigkeit` | The prose around the Independent kind, whose name stays English. |
| standard | `Massstab` | A yardstick; `Anspruch` is the glossary's claim. |
| takeaway | `Fazit` | |
| Software Engineer & Architect | `Software Engineer & Architect` | The owner's title, English in both views. |

`WRITING.md` changes in three places. The Languages paragraph says the German is made by the pipeline and that the owner reads the flagged sentences, and why: back-translation checks meaning and is blind to whether the text reads as German, which is where most of the faults were. "How a text is made" describes the five steps in a paragraph and names the files. The German section keeps its marks and points to `GERMAN.md` for words.

The README recipe gains two adapters beside `writer.md` and `translator.md`, written once and not vendored:

```markdown
---
name: editor
description: Reads a page's Swiss Standard German without the English, corrects it by rule and flags what the owner should choose. Use it after the translator, never with the English in its input.
tools: Read, Grep, Glob
---
Read `conventions/WRITING.md`, `conventions/GLOSSARY.md`, `conventions/GERMAN.md` and `conventions/EDITOR.md` before anything else, and follow them. Read only the German you are given; never open a file that holds the page's English.
```

```markdown
---
name: backreader
description: Renders a page's Swiss Standard German into literal English without having seen the English, so the dispatching session can see what the German actually says. Use it after the editor.
tools: Read
---
Read `conventions/BACKREADER.md` before anything else, and follow it. Read only the German you are given; never open a file that holds the page's English.
```

The editor and the back-reader carry no Edit tool: they return values, and the dispatching session writes them. `WORKING.md`'s sentence on roles invoked as subagents names all four — the writer, the translator, the editor and the back-reader — and says that the last two only report.

## 5. Checks in `robertblust/design`

`typography` in `verify/pages.mjs` holds every cold `-de` value to `DE_RULES` today. It gains four rules:

- An empty value. `data-de=""` fails, naming the element.
- The refused forms, read from the site's vendored `conventions/GERMAN.md`, the `banned` fenced block, the way the English stems are read from `conventions-check`. A form matches case-insensitively and as a whole phrase: the pilot's own pass flagged «Über fünfundzwanzig Jahre» for the refused bare count because it matched lower case only.
- The informal plural as address: `eure`, `euer`, `euch`, beside the du-forms already there.
- A bare count of the years: «fünfundzwanzig Jahre» not preceded by «über», matched case-insensitively, because *over twenty-five years* is a floor and a bare count is a claim the pages do not make.

**Stale German** is a new check, `german-stale`, run on a pull request against its base. It reads each page at the base commit and at the head, pairs `-de` values that are identical in both, and fails where a pair's English changed. Identical German is what makes the pairing robust: an element inserted above another shifts every index but not its German. An English edit that leaves the German right on purpose names the element in a `german-unchanged` list in the page's spec, with the reason in the commit.

**`translates` samples its German from the page.** A spec's `shows`, `title` and `desc` restate German text today, so every improvement to the German fails it; the pilot had to rewrite sixteen lines of them. `shows` gains a form that names an element, `{ select: "h1" }`, whose expected German is read from that element's `data-de` in the served source, and `title` and `desc` default to the page's own `de:` object. A literal string stays possible where a spec wants one; the decks keep their pair of words present in exactly one language each, now the title slide's kicker, «ÜBERBLICK» against “EXPLAINED”, since the owner's title is English in both views.

**`design german`** is the id tool: `extract` writes a page's German values with their English, `german` without, and `apply` writes a set of values back by id and refuses one that contains its attribute's quote character. It moves into the package so each site runs the same one.

**The generated note.** `lib/render/note.mjs` writes «Der Rest dieser Seite ist zweisprachig» onto every page generated from a model, on blust.ch and companygraph.io, where *site* is meant: it becomes «dieser Website» and its second clause the pilot's German.

## 6. Order

1. **Conventions.** This spec, then one pull request with the four role files, `GERMAN.md`, the glossary rows, `WRITING.md` and the README recipe; tagged v1.29.0 on the owner's word. The member wave adds the two adapters where a member carries `translator.md`.
2. **Design.** The four `typography` rules, `german-stale`, the `translates` form, `design german` and the note; one release.
3. **blust.ch.** The pilot's German, the re-pin to that design release, `npm run pages` for the three generated notes, `npm run og` for the eleven share cards, and the German narration: 19 clips whose notes changed, about 7,600 billed characters, on the owner's word.
4. **guestgraph.io, then companygraph.io.** The pipeline over every page, one branch each, seeded with the review's findings: the empty Apaleo section, the Reservation and DSG forms, «Offener Kern» and «Schnittstelle», and the rest. The owner gets one flagged list per site; the glossary and `GERMAN.md` grow from it.

## 7. What the pilot taught

The pilot ran the pipeline on blust.ch's eleven pages: 484 German values, 137 changed, 18 meanings restored, 49 choices for the owner, all made. It also showed:

- The editor improves idiom and moves meaning in the same stroke, because it has no English. The fidelity step is not optional.
- A site's own check restated German, so it worked against translation; section 5's `translates` form removes that.
- Three pages' generated note carried the site/page error and would have come back on the next `npm run pages`; section 5 moves the fix to where the note is written.
- Speaker notes changed means narration re-recorded, which is billed; a site pull request says the count.
- Translation reads the English more closely than any review: it found a slide and a note disagreeing on *clarity* and *precision*, and the owner settled it in the English.

## Appendix — the new files in full

### `conventions/GERMAN.md`

````markdown
# German

What Swiss Standard German asks of a page beyond the marks the German section of `WRITING.md` sets. The marks are the part a check can hold and the pages already hold them; what the pages got wrong was the German itself — English idioms carried over word for word, Germany's words where Switzerland has its own, a modal or a hedge lost in the shortening — and a back-translation cannot see any of it, because a calque reads back as the English it was copied from. This file is what the translator writes against, what the editor reads the German against, and where the owner's choices are kept so the next page does not ask again.

## Swiss words

Where Switzerland and Germany write different words, the page writes Switzerland's. The German of Germany is not wrong to a reader in Zürich, but it tells them the page was not written for them.

| Swiss | Not | Note |
| --- | --- | --- |
| `Entscheid` | `Entscheidung` | The noun for a decision taken; `Entscheidung` stays for the act of deciding. |
| `Reservation` | `Reservierung` | A booking. |
| `Spesen` | `Auslagen` | Costs billed beside a fee. |
| `Mandat` | `Auftrag`, `Fall` | An engagement of a consultant or an architect. |
| `selbständig` | `selbstständig` | The Swiss spelling. |
| `allfällig` | `etwaig` | |
| `Auftragsbearbeiter` | `Auftragsverarbeiter` | The revised DSG's term; where a page names the GDPR too, the GDPR term follows in brackets. |
| `bearbeiten` (Daten) | `verarbeiten` (Daten) | The DSG's verb for what is done with personal data. |
| `Website` | `Seite` for a site | `Seite` is one page; a site of several pages is a `Website`. |
| `per` (Datum) | `zum` (Datum) | Of a date something takes effect. |
| `innert` | `innerhalb von` | Of a period of time. |

## What the translator does by habit

Each of these was found on the pages, more than once, by a German-only read. A translator that knows the habit is a translator that can look for it.

**An English idiom taken word for word.** «Das ist die Steuer» for *that is the tax*, «ich baue beide offen» for *building both in the open*, «Das Pendel dreht» for *the pendulum swings*. German has its own idiom for most of these — «der Preis dafür», «öffentlich», «Das Pendel schlägt zurück» — and where it has none, the plain sentence is better than the copied picture.

**An English verb kept where German takes another.** *Hold* is not always «halten»: a person «besetzt» a seat, a file «enthält» its rows, a person «hat» a role «inne». *Survive* is rarely «überleben» outside a living thing: a guest ID «bleibt gültig». *Break* is «funktioniert nicht mehr», *land* is «erscheint» or «kommt an». Check every verb that carries a picture in English.

**A gerund made a noun.** «beim Folgen eines Links», «das Folgen eines Links übersteht». German takes a clause: «wenn Sie einem Link folgen».

**A modal, a hedge or a referent lost in the shortening.** *Over* twenty-five years became «fünfundzwanzig Jahre»; *cannot be left* became «wird nicht verlassen»; *what would make it usable* became «was es brauchbar macht»; *the panel* dropped out and left «ihn» pointing at nothing. German is shortened by restructuring the sentence, never by dropping a word that carries its meaning, and every pronoun names something the reader has already met.

**An English sentence frame kept for emphasis.** «Ein Pfad hier ist deshalb ein Pfad, den es gibt.» English repeats the noun to stress it; German moves the stressed word to the front or says it once: «Jeder Pfad hier existiert also tatsächlich.»

**A long English sentence kept long.** English chains clauses with commas and participles; German reads them as one breath too many. Split where the English turns, and put the verb where German expects it.

## Forms the check refuses

One form a line, the refused form, an arrow and the form the page writes. The page check reads this block from the vendored copy and fails on any refused form inside a German value, matched case-insensitively and as a whole phrase, so a form enters it only where it is wrong in every sentence it could appear in; a form that is wrong only in some sentences belongs in the tables above, where the editor weighs it.

```banned
Reservierung → Reservation
selbstständig → selbständig
Offener Kern → Open Core
Open Source → quelloffen, or Open-Source- in a compound
eure → Ihre
euch → Sie
Takeaway → Fazit
Requirements → Anforderungen
```

A bare count of the years, «fünfundzwanzig Jahre» without «über», is refused by a rule of its own in the check, because a phrase list cannot say "unless preceded by".

## The owner's choices

Each row is a sentence the editor flagged and the owner settled, kept where it generalizes: the form that was on the page, the form chosen and the reason in the owner's words where there was one. The translator reads this table before a page, so a choice made once is not asked again. Term choices are rows of `GLOSSARY.md`, not of this table.

| On the page | Chosen | Why |
| --- | --- | --- |
| «ich baue beide offen» | «ich entwickle beide öffentlich» | An idea is not built; *in the open* is «öffentlich». |
| «eine einzige Quelle der Wahrheit» | «eine einzige verbindliche Quelle» | The English picture read as a calque. |
| «Ein Konzept, erklärt» | «Ein Konzept im Überblick» | The label copied the English. |
| «Der Haken» | «Der Aufhänger» | The hook of a talk; «Haken» is a catch. |
| «wie Arbeit fliesst» | «wie die Arbeit abläuft» | The English picture of flow. |
| «Menschen richten sich schneller aus» | «Menschen finden schneller eine gemeinsame Linie» | *Align* word for word. |
````

### `conventions/TRANSLATOR.md`

````markdown
# Translator

The role that makes the German of a page whose English the owner has reviewed. It is the first of three: its German goes next to an editor who reads it without the English and a back-reader who renders it into literal English, so the translator does not check its own work, and its German is a draft for the editor rather than the page's last word. `WRITING.md` is its rulebook, its German section above all; `GLOSSARY.md` fixes every family term and `GERMAN.md` holds the Swiss words, the habits to avoid and the owner's earlier choices.

## What it takes

A page, not a list of elements: every German value the page carries, each beside its English and the German it carries now, in the page's order. The page is the unit because a sentence is translated against the one before it — a pronoun names what the reader has met, *page* and *site* are told apart, and a term is the same term from the top of the page to the bottom. Reviewed means the owner has said the English is done; a draft is not reviewed, and the translator says so rather than assuming. A page's own agent file says where that page carries German.

## What it produces

The German of every value of the page, made from the English and then set against the German already there: where the existing German is right and reads as German, it stays word for word, because a change the owner has to read is a cost; where it is wrong or reads translated, it is replaced. Per value it changed, one line of why, in English. Where it is unsure — a term the glossary does not fix, two ways of saying a sentence that differ in what they claim — it lists the doubt with the options it weighed rather than choosing silently. It writes no back-translation: the back-reader does, without the English, because a translator reads back what it meant.

## How the German is written

Meaning, not sentences. The translator may split an English sentence, join two, reorder a clause or drop the English frame, and it must, where German would otherwise read as English syntax in German words. What it may not do is drop a word that carries meaning: a modal, a hedge, a quantifier, a qualifier inside a noun phrase, a referent. *Over twenty-five years* is «über fünfundzwanzig Jahre», never a bare count.

The marks and forms are the German section of `WRITING.md`: Sie, ss, «» and ‹›, the spaced en-dash, 4. Mai 2012, 16’000. Markup inside a value is kept and only its text replaced; the value never contains its attribute's quote character.

## What it never does

It never changes an English word, never translates an element whose English is not reviewed, never renders a glossary term in any form but the glossary's, never writes German on a page whose note says the model's own words stay English in both views, and never commits.

## Before it reports

Every glossary term is in its form. No sentence of the English lost a modal, a hedge or a quantifier. Every pronoun names something. The marks are the German section's. The attribute's quote character does not appear in a value. No English word changed.
````

### `conventions/EDITOR.md`

````markdown
# Editor

The role that reads a page's German as German. It is given the German alone, never the English, because the English is what makes a calque invisible: a reader who knows *that is the tax* reads «das ist die Steuer» as the right sentence. The editor reads as the page's reader in Zürich or Bern reads, top to bottom, and asks of every sentence whether a Swiss writer would have written it.

## What it takes

Every German value of one page in the page's order, with its id and what kind of value it is — a heading, a paragraph, a speaker note a voice reads aloud, a label read to a screen reader, a title, a description. `GLOSSARY.md` and `GERMAN.md`, read before the page.

## What it produces

Per value, one of three answers.

Nothing, where the German reads as German. Most values get nothing.

A correction, where the German is wrong by a rule: a glossary form, a Swiss word from `GERMAN.md`, a mark, grammar, gender, case, a pronoun that names nothing, a sentence that cannot be parsed on first reading. The correction is the new value and the rule it follows.

A flag, where the German reads translated or stiff and the fix is a choice rather than a rule: a copied idiom, a verb that keeps its English picture, a noun where German wants a clause, a sentence too long for one breath, a register that is off. A flag carries the German as it stands, one line on what a Swiss reader stumbles on, and two or three alternatives, each a complete value with a one-line English gloss so the owner sees what each one says. The first alternative is the editor's recommendation. A flag is for the owner, who reads German, so it is written to be decided in seconds: short, concrete, no alternative that differs from another only in taste.

The editor flags only what it would stake its name on. A page where every sentence is flagged is a page the owner will not read.

## What it never does

It never asks for the English and never opens a file that holds it. It never changes a glossary form, never flags a term the glossary fixes, never edits a file and never commits. Because it has no English, a correction or a flag of its own can move a meaning; the fidelity step after the back-reader exists for that, and the editor does not try to guess the English to avoid it.
````

### `conventions/BACKREADER.md`

````markdown
# Back-reader

The role that says in English what a page's German says, literally. It is given the German alone, after the editor, and it has never seen the English, so it cannot render what the German was meant to say; a translator's back-translation of its own German was not a check for exactly that reason, since it read back what it had meant. The session that dispatched it sets the back-reading against the English and sends any value whose meaning moved back to the translator.

## What it takes

Every German value of one page in the page's order, with its id.

## What it produces

Per value, an English rendering that is literal where the German is: a modal is kept or its absence is visible, a quantifier is kept or missing, first person singular and plural stay apart, a pronoun is rendered with what it refers to in brackets or «[refers to nothing]». Where a German word has two readings a reader could take, both are given, «Seite [page / site]». It does not smooth the English, because smoothing is how a lost word disappears a second time.

## What it never does

It never asks for the English and never opens a file that holds it. It never corrects the German, never edits a file and never commits.
````
