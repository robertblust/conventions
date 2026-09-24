# German checks in the design package — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release `robertblust/design` v0.83.0 with the German checks of the pipeline spec: four new `typography` rules, `design german` (extract, German-only, apply, stale), `translates` reading its German title and description from the page, and the corrected generated note.

**Architecture:** One new module, `lib/german.mjs`, holds the page's German values by stable id — the parser the pilot proved in a throwaway script — and everything else uses it: the CLI's `german` command, the stale check and `translates`. `typography` gains its rules in `verify/pages.mjs` beside `DE_RULES`, reading the refused forms from the site's vendored `conventions/GERMAN.md` the way it reads the English stems from `conventions/conventions-check`.

**Tech Stack:** Node 22 ES modules, `node --test`, Playwright for the page checks' existing tests, git through `child_process` as `lib/crawl.mjs` does.

**Spec:** `docs/superpowers/specs/2026-09-24-german-pipeline-design.md` in robertblust/conventions, section 5. This plan departs from it in two places, each ruled below; both are the owner's to overrule at review.

- **Ruling: `translates` gains no `{ select }` form for `shows`.** The check already holds every `[data-de]` element to its own value after the switch (the `kept` loop), so an element form would re-check what is checked; the literal strings are what restated German, and they become optional. What the spec wanted — no German restated in a site's spec — is had by `title` and `desc` defaulting to the page's own `de:` object. Cost if wrong: one small addition later.
- **Ruling: an English edit that leaves its German right on purpose is named in a commit trailer, `German-unchanged: <file>#<id>`, not in the page's spec.** The stale check runs from the CLI over git, where a trailer is in reach and a site's `verify/check.mjs` is not, and the trailer keeps the reason in the commit the spec asks for it. Cost if wrong: the check reads a second place later.

## Global Constraints

- Work in a worktree `~/git/robertblust/design-german-checks` on branch `german-checks`, cut from `main`.
- `export PATH=/opt/homebrew/bin:$PATH` before `node`, `npm`, `npx` or `gh`.
- The refused forms are read from `${BASE}/conventions/GERMAN.md`, the fence opened by a line that is exactly ```` ```banned ```` and closed by ```` ``` ````, one `form → replacement` a line. A site without that file fails `typography` with a message that names conventions v1.29.0, as a site without `conventions-check` already fails it.
- A refused form matches case-insensitively and as a whole phrase: no letter or digit on either side.
- Ids: `a<n>` for the n-th `data-de`, `data-notes-de` or `data-de-aria` attribute in source order, counted from 0; `js.title` and `js.desc` for the `de:{ title, desc }` object.
- A value written back never contains its attribute's quote character; `apply` refuses the whole set if one does, or if an id is unknown.
- Code comments say why, in the family's prose: full sentences, en-US.
- Before tagging, `version` in `package.json` is set to the tag.
- Nothing is merged, tagged or released without the owner's word.

## Review Focus

- A `data-de` value holding markup with `>` inside quotes, and a `<script>` holding `<` in code: the parser must not end a tag early or read script text as tags. Task 1 has both in its fixture.
- A page whose German repeats one value for different English, such as a nav label and a heading: the stale check must pair by value to every English it had, not the first. Task 3 tests it.
- «Über fünfundzwanzig Jahre» at the start of a sentence must pass and «fünfundzwanzig Jahre Plattformen» must fail. The pilot's own first pass got the capital wrong. Task 2 tests both.
- A refused form inside a longer word, such as «Reservierungen», must fail, and one inside an unrelated word must not. Task 2 tests the plural, «Reservierungen», and a longer word that contains the form, «Vorreservierung».
- A page with no `de:` object, as a deck's generated page or a page without a German title, must not fail `translates` for a missing default. Task 4 tests it.

---

### Task 1: `lib/german.mjs`, a page's German by id

**Files:**

- Create: `lib/german.mjs`
- Test: `test/german.test.mjs`

**Interfaces:**

- Produces: `germanValues(html) → Array<{ id, kind, tag, en, de, start, end, quote }>` in source order, where `kind` is `data-de`, `data-notes-de`, `data-de-aria`, `title` or `description`, `start`/`end` bound the value inside the source, and `quote` is the attribute's quote character; and `applyGerman(html, edits) → string`, `edits` an object `{ [id]: value }`, throwing `Error` whose message begins `refused:` for an unknown id or a value holding its quote.

- [ ] **Step 1: Write the failing test**

```js
// test/german.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { germanValues, applyGerman } from "../lib/german.mjs";

const PAGE = `<!doctype html><html lang="en"><head>
<meta name="description" id="metadesc" content="Over twenty-five years." data-de="Über fünfundzwanzig Jahre.">
</head><body>
<h1 data-de="Zwei Ideen, <em class='x'>öffentlich</em> geprüft.">Two ideas, <em>tested</em> in public.</h1>
<p data-de="a &gt; b, «so»">a &gt; b, “so”</p>
<button aria-label="Dark" data-de-aria="Dunkel">◐</button>
<section class="slide" data-notes="Say it." data-notes-de="Sagen Sie es."><p>Slide</p></section>
<script>
  if (a < b && c > d) {}
  var UI = {
    de:{ title:"Robert Blust – Titel", desc:"Deutsche Beschreibung." },
    en:{ title:"Robert Blust — Title", desc:"English description." }
  };
</script>
</body></html>`;

test("germanValues finds every German value in source order, each with its English", () => {
  const v = germanValues(PAGE);
  assert.deepEqual(v.map((e) => e.id), ["a0", "a1", "a2", "a3", "a4", "js.title", "js.desc"]);
  assert.deepEqual(v.map((e) => e.kind), ["data-de", "data-de", "data-de", "data-de-aria", "data-notes-de", "title", "description"]);
  assert.equal(v[0].en, "Over twenty-five years.");
  assert.equal(v[1].en, "Two ideas, tested in public.");
  assert.equal(v[1].de, "Zwei Ideen, <em class='x'>öffentlich</em> geprüft.");
  assert.equal(v[2].en, "a > b, “so”");
  assert.equal(v[3].en, "Dark");
  assert.equal(v[4].en, "Say it.");
  assert.equal(v[5].de, "Robert Blust – Titel");
  assert.equal(v[5].en, "Robert Blust — Title");
  assert.equal(v[6].en, "English description.");
});

test("a script's < and > are not read as tags", () => {
  const v = germanValues(PAGE);
  assert.equal(v.filter((e) => e.kind === "data-de").length, 3);
});

test("applyGerman writes values back by id and leaves everything else byte for byte", () => {
  const out = applyGerman(PAGE, { a2: "a &gt; b, «ja»", "js.desc": "Neue Beschreibung." });
  assert.equal(out, PAGE.replace("a &gt; b, «so»", "a &gt; b, «ja»").replace("Deutsche Beschreibung.", "Neue Beschreibung."));
  assert.equal(applyGerman(PAGE, {}), PAGE);
});

test("applyGerman refuses an unknown id and a value holding its own quote", () => {
  assert.throws(() => applyGerman(PAGE, { a99: "x" }), /^Error: refused: a99/);
  assert.throws(() => applyGerman(PAGE, { a1: 'ein "Zitat"' }), /^Error: refused: a1/);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/german.test.mjs` Expected: FAIL, `Cannot find module '…/lib/german.mjs'`.

- [ ] **Step 3: Write `lib/german.mjs`**

```js
// A page's German values by stable id. The German of a page lives in attributes and in one
// script object, and an agent that reads German without the English, or writes German back
// without touching the markup around it, needs each value addressed by something that does
// not move when the text does: its position among the page's German values.
//
// Ids: a<n> for the n-th data-de, data-notes-de or data-de-aria attribute in source order,
// and js.title / js.desc for the de:{ title, desc } object a page or a deck declares.

const ATTR = /\b(data-de|data-notes-de|data-de-aria)=(["'])([\s\S]*?)\2/dg;
const JS_DE = /de:\s*\{\s*title:\s*(["'])([\s\S]*?)\1\s*,\s*desc:\s*(["'])([\s\S]*?)\3/d;
const JS_EN = /en:\s*\{\s*title:\s*(["'])([\s\S]*?)\1\s*,\s*desc:\s*(["'])([\s\S]*?)\3/;
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style"]);

const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const plain = (html) => decode(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

// Every start tag with its span and, for an element that closes, the span of its content.
// Quotes are honored inside a tag, because a data-de value carries markup whose > would
// otherwise end the tag; a script's or a style's text is skipped whole, because code holds <.
function tags(src) {
  const out = [], stack = [];
  let i = 0;
  while ((i = src.indexOf("<", i)) !== -1) {
    if (src.startsWith("<!--", i)) { i = src.indexOf("-->", i); if (i === -1) break; continue; }
    const close = src[i + 1] === "/";
    const nameMatch = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(src.slice(i + (close ? 2 : 1)));
    if (!nameMatch) { i++; continue; }
    const name = nameMatch[0].toLowerCase();
    let j = i + 1, q = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === ">") break;
    }
    const end = j + 1;
    if (close) {
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].name === name) { stack[k].inner = [stack[k].end, i]; stack.length = k; break; }
      }
    } else {
      const t = { name, start: i, end, head: src.slice(i, end) };
      out.push(t);
      if (RAW.has(name)) {
        const stop = src.toLowerCase().indexOf(`</${name}`, end);
        t.inner = [end, stop === -1 ? src.length : stop];
        i = stop === -1 ? src.length : stop;
        continue;
      }
      if (!VOID.has(name) && !src.slice(i, end).endsWith("/>")) stack.push(t);
    }
    i = end;
  }
  return out;
}

const attr = (head, name) => {
  const m = new RegExp(`\\s${name}=(["'])([\\s\\S]*?)\\1`).exec(head);
  return m ? m[2] : "";
};

export function germanValues(html) {
  const all = tags(html);
  const owner = (pos) => {
    let found = null;
    for (const t of all) { if (t.start > pos) break; if (pos < t.end) found = t; }
    return found;
  };
  const out = [];
  let n = 0;
  for (const m of html.matchAll(ATTR)) {
    const t = owner(m.index);
    if (!t || RAW.has(t.name)) continue;
    const kind = m[1];
    let en = "";
    if (kind === "data-de") en = t.name === "meta" ? decode(attr(t.head, "content")) : t.inner ? plain(html.slice(...t.inner)) : "";
    else if (kind === "data-notes-de") en = decode(attr(t.head, "data-notes"));
    else en = decode(attr(t.head, "aria-label"));
    const [start] = m.indices[3];
    out.push({ id: `a${n++}`, kind, tag: t.name, en, de: m[3], start, end: start + m[3].length, quote: m[2] });
  }
  const de = JS_DE.exec(html), en = JS_EN.exec(html);
  if (de) {
    const [t] = de.indices[2], [d] = de.indices[4];
    out.push({ id: "js.title", kind: "title", tag: "js", en: en ? en[2] : "", de: de[2], start: t, end: t + de[2].length, quote: de[1] });
    out.push({ id: "js.desc", kind: "description", tag: "js", en: en ? en[4] : "", de: de[4], start: d, end: d + de[4].length, quote: de[3] });
  }
  return out;
}

export function applyGerman(html, edits) {
  const byId = new Map(germanValues(html).map((e) => [e.id, e]));
  const bad = Object.keys(edits).filter((id) => !byId.has(id) || edits[id].includes(byId.get(id).quote));
  if (bad.length) throw new Error(`refused: ${bad.join(", ")}`);
  let out = html;
  for (const id of Object.keys(edits).sort((a, b) => byId.get(b).start - byId.get(a).start)) {
    const e = byId.get(id);
    out = out.slice(0, e.start) + edits[id] + out.slice(e.end);
  }
  return out;
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test test/german.test.mjs` Expected: PASS, 4 tests. The spans come from the `d` flag's `indices`, so `applyGerman` replaces exactly the value between its quotes.

- [ ] **Step 5: The round trip over the three sites**

Run, from the worktree, for each site checked out under `~/git`:

```bash
node -e '
import("./lib/german.mjs").then(({ germanValues, applyGerman }) => {
  const fs = require("fs"), cp = require("child_process");
  for (const site of process.argv.slice(1)) {
    for (const f of cp.execSync("git ls-files \"*.html\"", { cwd: site }).toString().split("\n").filter(Boolean)) {
      const src = fs.readFileSync(site + "/" + f, "utf8");
      const v = germanValues(src);
      const same = applyGerman(src, Object.fromEntries(v.map((e) => [e.id, e.de])));
      if (same !== src) { console.log("ROUND TRIP CHANGED", site, f); process.exitCode = 1; }
      const missing = v.filter((e) => !e.en).length;
      if (missing) console.log("no English for", missing, "value(s) in", site + "/" + f);
    }
  }
})' ~/git/robertblust/robertblust.github.io ~/git/guestgraph/guestgraph.github.io ~/git/companygraph/companygraph.github.io; echo exit=$?
```

Expected: `exit=0`, no `ROUND TRIP CHANGED` line. A `no English for` line is a finding to read: an element whose English is empty on purpose (an icon button's text) is fine, anything else is a parser gap to fix with a fixture line in Step 1's test first.

- [ ] **Step 6: Commit**

```bash
git add lib/german.mjs test/german.test.mjs
git commit -F - <<'EOF'
A page's German can be read and written by id

The German pipeline hands a page's German to an editor and a back-reader without the English and writes their values back without an agent touching the markup, so every German value needs an address that does not move when its text does. germanValues lists them in source order with the English each translates, and applyGerman writes a set back and refuses one that would break its attribute.

Verified: node --test test/german.test.mjs passes, and a round trip over every page of the three sites changes no byte.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Four new `typography` rules

**Files:**

- Modify: `verify/pages.mjs` (`DE_RULES` near line 29; `typography` near line 1034)
- Test: `test/verify-pages.test.mjs` (every existing `typography` fetch stub, and four new tests)

**Interfaces:**

- Produces: `bannedForms(markdown) → Array<[label, RegExp]> | null`, exported from `verify/pages.mjs`, `null` when the markdown has no `banned` fence.

- [ ] **Step 1: Give every existing `typography` stub a `GERMAN.md`**

At the top of `test/verify-pages.test.mjs`, after `OPTS`, add:

```js
// What a member's vendored conventions/GERMAN.md carries in its refused-forms fence.
const GERMAN_STUB = "# German\n\n```banned\nReservierung → Reservation\nOffener Kern → Open Core\n```\n";
```

and in every test that stubs `globalThis.fetch` for `typography`, replace

```js
text: async () => (String(url).endsWith("conventions-check") ? stems : html),
```

with

```js
text: async () => (String(url).endsWith("conventions-check") ? stems : String(url).endsWith("/conventions/GERMAN.md") ? GERMAN_STUB : html),
```

Run: `grep -c 'endsWith("conventions-check") ? stems : html' test/verify-pages.test.mjs` Expected: `0` after the edit (a positive control before it: the count equals the number of `typography(page` calls that stub fetch).

- [ ] **Step 2: Write the failing tests**

Append to `test/verify-pages.test.mjs`:

```js
import { bannedForms } from "../verify/pages.mjs";

function stubFetch(html, german = GERMAN_STUB) {
  const stems = "STEMS='colour([^a-z]|$)'";
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.endsWith("/conventions/GERMAN.md")) return german === null ? { ok: false, text: async () => "" } : { ok: true, text: async () => german };
    return { ok: true, text: async () => (u.endsWith("conventions-check") ? stems : html) };
  };
  return () => { globalThis.fetch = real; };
}
const cleanPage = { evaluate: async () => ({ text: "Clean English text.", title: "", desc: "" }) };

test("bannedForms reads the fence, one form and its replacement a line", () => {
  const forms = bannedForms(GERMAN_STUB);
  assert.equal(forms.length, 2);
  assert.equal(forms[0][0], "Reservierung (write Reservation)");
  assert.ok(forms[0][1].test("Ihre RESERVIERUNGEN"));
  assert.equal(bannedForms("# German\n\nno fence\n"), null);
});

test("typography fails an empty German value", async () => {
  const restore = stubFetch(`<h2 id="x" data-de="">Apaleo could not be reached</h2>`);
  try {
    const out = await pageChecks(OPTS).typography(cleanPage, { absolute: "https://example.test/x/" });
    assert.match(out, /\[de\] empty data-de/);
  } finally { restore(); }
});

test("typography fails a refused form as a whole phrase, in any case, and nothing inside another word", async () => {
  const restore = stubFetch(`<p data-de="Ihre Reservierungen und ein offener Kern.">x</p><p data-de="Die Vorreservierung läuft.">y</p>`);
  try {
    const out = await pageChecks(OPTS).typography(cleanPage, { absolute: "https://example.test/x/" });
    assert.match(out, /Offener Kern \(write Open Core\)/);
    assert.match(out, /Reservierung \(write Reservation\) in "Ihre Reservierungen/);
    assert.doesNotMatch(out, /Vorreservierung/);
  } finally { restore(); }
});

test("typography fails the informal plural and a bare count of the years, and passes «Über fünfundzwanzig Jahre»", async () => {
  const restore = stubFetch(`<p data-de="Weder eure Entscheide noch euer Plan.">x</p><p data-de="Dahinter stehen fünfundzwanzig Jahre Plattformarbeit.">y</p><p data-de="Über fünfundzwanzig Jahre der Reihe nach.">z</p>`);
  try {
    const out = await pageChecks(OPTS).typography(cleanPage, { absolute: "https://example.test/x/" });
    assert.equal((out.match(/\[de\] informal plural/g) || []).length, 2);
    assert.equal((out.match(/\[de\] bare count of the years/g) || []).length, 1);
  } finally { restore(); }
});

test("typography fails a site with no vendored GERMAN.md and names the release that brings it", async () => {
  const restore = stubFetch(`<p data-de="Gut.">x</p>`, null);
  try {
    const out = await pageChecks(OPTS).typography(cleanPage, { absolute: "https://example.test/x/" });
    assert.match(out, /no vendored conventions\/GERMAN\.md .* v1\.29\.0/);
  } finally { restore(); }
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `node --test test/verify-pages.test.mjs 2>&1 | tail -20` Expected: the five new tests FAIL (`bannedForms` is not exported; the others find no hit); every existing test still passes.

- [ ] **Step 4: Implement**

In `verify/pages.mjs`, extend `DE_RULES`:

```js
const DE_RULES = [
  ["ß", /ß/],
  ["„", /„/], ["“", /“/], ["”", /”/],
  ["em-dash", /—/],
  ["du-form", /\b(du|dich|dir|dein|deine|deinen|deinem|deiner|deines)\b/i],
  // The pages address their reader as Sie, a room as well as a person; the informal plural
  // is the form a talk's notes reached for when the audience was more than one.
  ["informal plural", /\b(eure|euren|eurem|eurer|eures|euer|euch)\b/i],
  // "Over twenty-five years" is a floor that stays true; a bare count is a claim the pages do
  // not make, and it is what a translator's shortening left twice.
  ["bare count of the years", /(?<!über )fünfundzwanzig Jahre/i],
];
```

Below `markHits`, add:

```js
// The refused forms of a member's conventions/GERMAN.md, read from its `banned` fence: one
// "form → replacement" a line. A form matches in any case and as a whole phrase, so the plural
// of a refused noun is refused with it and a word that merely contains one is not.
export function bannedForms(markdown) {
  const fence = /^```banned\n([\s\S]*?)\n```$/m.exec(markdown);
  if (!fence) return null;
  return fence[1].split("\n").filter(Boolean).map((line) => {
    const [form, fix] = line.split(" → ");
    const esc = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return [`${form} (write ${fix})`, new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?=\\p{L}{0,3}(?![\\p{L}\\p{N}]))`, "iu")];
  });
}
```

(The lookahead lets up to three letters follow, which is a German plural or case ending — «Reservierungen» — and still refuses a longer word.)

In `typography`, after the stems are read, read the refused forms:

```js
      const germanUrl = `${BASE}/conventions/GERMAN.md`;
      const germanRes = await fetch(germanUrl).catch(() => null);
      const banned = germanRes && germanRes.ok ? bannedForms(await germanRes.text()) : null;
      if (!banned) return `no vendored conventions/GERMAN.md with a banned fence at ${germanUrl} — take conventions v1.29.0`;
      const deRules = [...DE_RULES, ...banned];
```

and change the cold scan so German values use `deRules` and an empty German value is a hit:

```js
      for (const [name, value] of values) {
        if (name !== "notes" && !value.trim()) { hits.push(`[de] empty data-${name}: a German visitor sees nothing here`); continue; }
        scan(name === "notes" ? "en" : "de", value, name === "notes" ? enRules : deRules);
      }
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `node --test test/verify-pages.test.mjs 2>&1 | tail -5` Expected: every test passes, the five new ones among them. If the existing test "typography reads German and English notes cold…" fails on the source-shape assertions, read which regex it expects and keep `data-(de|notes-de|notes)` in the source.

- [ ] **Step 6: Commit**

```bash
git add verify/pages.mjs test/verify-pages.test.mjs
git commit -F - <<'EOF'
Typography refuses an empty German value and the forms GERMAN.md lists

An empty data-de hid a whole section from German visitors with every check green, and the forms a translator reaches for from Germany or from English — Reservierung, Offener Kern, eure, a bare count of the years — passed because the check knew only the marks. typography now reads the refused forms from the member's vendored conventions/GERMAN.md, as it reads the English stems, matches each as a whole phrase in any case, and fails an empty value.

Verified: node --test test/verify-pages.test.mjs passes.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: `design german`, and German left behind an English edit

**Files:**

- Create: `lib/german-stale.mjs`
- Modify: `bin/design.mjs` (`USAGE`, and a `german` branch before `readConfig`)
- Test: `test/german-stale.test.mjs`, `test/cli.test.mjs` (usage text)

**Interfaces:**

- Consumes: `germanValues`, `applyGerman` from Task 1.
- Produces: `staleGerman({ before, after }) → Array<{ id, de, was, now }>` comparing two versions of one page; `staleRange({ root, base, head }) → Array<{ file, id, de, was, now }>` over git, honoring `German-unchanged: <file>#<id>` trailers in `base..head`.

- [ ] **Step 1: Write the failing test**

```js
// test/german-stale.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { staleGerman, staleRange } from "../lib/german-stale.mjs";

const page = (h1, nav = "Model") => `<nav><a data-de="Modell">${nav}</a></nav><h1 data-de="Zwei Ideen.">${h1}</h1><p data-de="Modell">Model</p>`;

test("an English edit under unchanged German is stale; a pair whose German also changed is not", () => {
  assert.deepEqual(staleGerman({ before: page("Two ideas."), after: page("Two ideas, tested.") }).map((s) => s.de), ["Zwei Ideen."]);
  assert.deepEqual(staleGerman({ before: page("Two ideas."), after: page("Two ideas, tested.").replace("Zwei Ideen.", "Zwei Ideen, geprüft.") }), []);
});

test("German repeated for the same English is paired with every English it had, not the first", () => {
  assert.deepEqual(staleGerman({ before: page("Two ideas."), after: page("Two ideas.") }), []);
  assert.equal(staleGerman({ before: page("Two ideas."), after: page("Two ideas.", "Models") }).length, 1);
});

test("staleRange reads git and honors a German-unchanged trailer", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stale-"));
  const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" });
  git("init", "-q"); git("config", "user.email", "t@example.test"); git("config", "user.name", "t");
  fs.writeFileSync(path.join(dir, "index.html"), page("Two ideas."));
  git("add", "."); git("commit", "-qm", "base");
  const base = git("rev-parse", "HEAD").trim();
  fs.writeFileSync(path.join(dir, "index.html"), page("Two ideas, tested."));
  git("commit", "-qam", "English only");
  assert.equal(staleRange({ root: dir, base, head: "HEAD" }).length, 1);
  git("commit", "-q", "--allow-empty", "-m", "Keep the German\n\nGerman-unchanged: index.html#a1");
  assert.equal(staleRange({ root: dir, base, head: "HEAD" }).length, 0);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/german-stale.test.mjs` Expected: FAIL, `Cannot find module '…/lib/german-stale.mjs'`.

- [ ] **Step 3: Write `lib/german-stale.mjs`**

```js
// German left behind an English edit. Nothing on a page says when its German was made, so a
// sentence reworded in English keeps a German that now says something else, and every check
// that reads the rendered page reads one language and passes. Two versions of a page are
// compared by their German: a German value identical in both whose English changed is stale.
// Pairing by the German, not by position, is what survives an element inserted above.
import { execFileSync } from "node:child_process";
import { germanValues } from "./german.mjs";

export function staleGerman({ before, after }) {
  const had = new Map();
  for (const e of germanValues(before)) {
    if (!had.has(e.de)) had.set(e.de, new Set());
    had.get(e.de).add(e.en);
  }
  return germanValues(after)
    .filter((e) => had.has(e.de) && !had.get(e.de).has(e.en))
    .map((e) => ({ id: e.id, de: e.de, was: [...had.get(e.de)].join(" | "), now: e.en }));
}

// An English edit whose German is right on purpose is named in a commit of the range, in a
// trailer, so the reason sits in the commit that made the decision.
export function staleRange({ root, base, head }) {
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
  const allowed = new Set(git("log", "--format=%B", `${base}..${head}`).split("\n")
    .map((l) => /^German-unchanged:\s*(\S+)\s*$/.exec(l)).filter(Boolean).map((m) => m[1]));
  const show = (rev, file) => { try { return git("show", `${rev}:${file}`); } catch { return null; } };
  const out = [];
  for (const file of git("diff", "--name-only", base, head, "--", "*.html").split("\n").filter(Boolean)) {
    const before = show(base, file), after = show(head, file);
    if (before === null || after === null) continue;
    for (const s of staleGerman({ before, after })) if (!allowed.has(`${file}#${s.id}`)) out.push({ file, ...s });
  }
  return out;
}
```

- [ ] **Step 4: Wire the CLI**

In `bin/design.mjs`, add to `USAGE` after the `links` lines:

```
       design german extract|german <page>
       design german apply <page> <edits.json>
       design german stale <base> <head>

  german extract  every German value of a page by id, with its English, as JSON
  german german   the same without the English, for a role that must not read it
  german apply    write {id: value} back into the page; refuses an unknown id or a broken attribute
  german stale    fail where an English edit between two commits left its German unchanged
```

and, before the `indexnow`/`sitemap` branch:

```js
// The German of a page by id, for the roles of the German pipeline, and the check that finds
// German left behind an English edit. Like the crawler commands it needs no design.config.json.
if (argv[0] === "german") {
  const { germanValues, applyGerman } = await import("../lib/german.mjs");
  const [sub, a, b] = argv.slice(1);
  if (sub === "extract" || sub === "german") {
    if (!a) fail(USAGE, 2);
    const v = germanValues(fs.readFileSync(a, "utf8"));
    const keys = sub === "extract" ? ["id", "kind", "tag", "en", "de"] : ["id", "kind", "tag", "de"];
    console.log(JSON.stringify(v.map((e) => Object.fromEntries(keys.map((k) => [k, e[k]]))), null, 1));
    process.exit(0);
  }
  if (sub === "apply") {
    if (!a || !b) fail(USAGE, 2);
    try {
      fs.writeFileSync(a, applyGerman(fs.readFileSync(a, "utf8"), JSON.parse(fs.readFileSync(b, "utf8"))));
    } catch (e) { fail(`  ✗ ${e.message}`, 1); }
    console.log(`  ✓ ${a} written`);
    process.exit(0);
  }
  if (sub === "stale") {
    if (!a || !b) fail(USAGE, 2);
    const { staleRange } = await import("../lib/german-stale.mjs");
    const stale = staleRange({ root: process.cwd(), base: a, head: b });
    for (const s of stale) console.error(`  ✗ ${s.file}#${s.id} «${s.de}» was made for “${s.was}”, the English now reads “${s.now}”`);
    if (stale.length) fail(`  ${stale.length} German value(s) left behind an English edit — translate them, or name each in a commit trailer German-unchanged: <file>#<id>`, 1);
    console.log("  ✓ no German left behind an English edit");
    process.exit(0);
  }
  fail(USAGE, 2);
}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `node --test test/german-stale.test.mjs test/german.test.mjs test/cli.test.mjs 2>&1 | tail -5` Expected: all pass. If `test/cli.test.mjs` asserts the exact usage text, extend its expectation with the four `german` lines.

- [ ] **Step 6: Commit**

```bash
git add lib/german-stale.mjs bin/design.mjs test/german-stale.test.mjs test/cli.test.mjs
git commit -F - <<'EOF'
design german reads a page's German by id and finds it gone stale

The roles of the German pipeline need a page's German with and without its English and a way to write their values back, and nothing told anyone when an English edit left its German behind. design german extract, german and apply do the first; design german stale compares two commits by German value and fails where the German is unchanged and its English is not, unless a commit in the range names the element in a German-unchanged trailer.

Verified: node --test over german, german-stale and cli passes.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: `translates` reads its German title and description from the page

**Files:**

- Modify: `verify/pages.mjs` (`translates`, the `title` and `desc` blocks)
- Test: `test/verify-pages.test.mjs`

**Interfaces:**

- Consumes: `germanValues` from Task 1.
- Produces: `expectedGerman(html) → { title, desc } | null`, exported from `verify/pages.mjs`.

- [ ] **Step 1: Write the failing test**

```js
import { expectedGerman } from "../verify/pages.mjs";

test("translates takes its German title and description from the page when the spec names none", () => {
  const html = `<script>var UI = { de:{ title:"Titel – DE", desc:"Beschreibung." }, en:{ title:"Title", desc:"Description." } };</script>`;
  assert.deepEqual(expectedGerman(html), { title: "Titel – DE", desc: "Beschreibung." });
  assert.equal(expectedGerman("<p data-de='x'>y</p>"), null);
  const src = pageChecks(OPTS).translates.toString();
  assert.match(src, /expectedGerman/);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/verify-pages.test.mjs 2>&1 | grep -A3 'takes its German title'` Expected: FAIL, `expectedGerman` is not exported.

- [ ] **Step 3: Implement**

At the top of `verify/pages.mjs`, `import { germanValues } from "../lib/german.mjs";`, and below `bannedForms`:

```js
// The German <title> and meta description a page declares in its de:{ title, desc } object,
// read from the source so a site's spec need not restate them — restated German is German a
// better translation has to change twice, and the pilot of the German pipeline had to.
export function expectedGerman(html) {
  const v = germanValues(html);
  const title = v.find((e) => e.id === "js.title"), desc = v.find((e) => e.id === "js.desc");
  return title && desc ? { title: title.de, desc: desc.de } : null;
}
```

In `translates`, before the `if (spec.translates.title)` block:

```js
      const declared = expectedGerman(await (await fetch(spec.absolute)).text()) || {};
      const wantTitle = spec.translates.title ?? declared.title;
      const wantDesc = spec.translates.desc ?? declared.desc;
```

and use `wantTitle` and `wantDesc` in place of `spec.translates.title` and `spec.translates.desc` in the two blocks and their messages. A page with no `de:` object and no literal checks neither, as today.

- [ ] **Step 4: Run the suite**

Run: `npm test > /tmp/design-test.log 2>&1; echo exit=$?; tail -5 /tmp/design-test.log` Expected: `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add verify/pages.mjs test/verify-pages.test.mjs
git commit -F - <<'EOF'
translates reads its German title and description from the page

A site's spec restated the German title and description of every page, so each better translation failed the check until the spec was rewritten; the pilot of the German pipeline rewrote sixteen such lines. Where a spec names none, translates now expects what the page's own de object declares. Its every-element check already holds each data-de, so literal shows strings become optional too.

Verified: npm test passes.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: The generated note says site, and the release

**Files:**

- Modify: `lib/render/note.mjs` (`NOTE_DE`)
- Modify: `README.md` (a `## German` section before `## Crawlers`)
- Modify: `package.json` (`version`)
- Test: `test/render.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to `test/render.test.mjs`:

```js
import { NOTE_DE } from "../lib/render/note.mjs";

test("the generated note says the rest of the site is bilingual, not the rest of the page", () => {
  assert.match(NOTE_DE, /Der Rest dieser Website ist zweisprachig/);
  assert.doesNotMatch(NOTE_DE, /Der Rest dieser Seite/);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/render.test.mjs 2>&1 | grep -A2 'rest of the site'` Expected: FAIL.

- [ ] **Step 3: The note**

`NOTE_DE` becomes the German the owner approved on blust.ch in the pilot:

```js
export const NOTE_DE = "Aus dem Modell erzeugt: Die Worte unten sind seine eigenen – und in der einen " +
  "Sprache, in der es geschrieben ist. Der Rest dieser Website ist zweisprachig; eine übersetzte " +
  "Kopie wäre eine zweite Fassung, die ebenfalls stimmen müsste – und genau dagegen argumentiert " +
  "diese Seite.";
```

Run: `node --test test/render.test.mjs` Expected: PASS.

- [ ] **Step 4: The README section**

Insert before `## Crawlers`:

```markdown
## German

`typography` holds every German value a page carries cold to the marks of `WRITING.md`, to the informal plural and a bare count of the years, and to the refused forms the member's vendored `conventions/GERMAN.md` lists in its `banned` fence, matched in any case and as a whole phrase; an empty German value fails it too, because a section a German visitor cannot read passes every other check. A site without that file fails with a message naming the conventions release that brings it.

`design german extract <page>` prints a page's German values by id with their English, `design german german <page>` the same without the English for a role that must not read it, and `design german apply <page> <edits.json>` writes values back by id and refuses one that would break its attribute. The ids are the n-th German attribute in source order and `js.title` and `js.desc` for the page's `de` object. `design german stale <base> <head>` fails where an English edit between two commits left its German unchanged; a commit in the range that names the element in a trailer, `German-unchanged: <file>#<id>`, says the German is right on purpose. `translates` expects the German title and description the page's own `de` object declares where a spec names none.
```

- [ ] **Step 5: Version, suite and checks**

Set `"version": "0.83.0"` in `package.json`.

Run: `npm test > /tmp/design-test.log 2>&1; echo exit=$?; tail -3 /tmp/design-test.log` and `sh conventions/conventions-check; echo $?` and `sh conventions/conventions-format; echo $?` Expected: all `0`.

- [ ] **Step 6: Commit, push, pull request**

```bash
git add lib/render/note.mjs test/render.test.mjs README.md package.json
git commit -F - <<'EOF'
The generated note says site, and the package is v0.83.0

Every page generated from a model said «Der Rest dieser Seite ist zweisprachig» where it meant the site, on a page whose own words are English, so the note contradicted the page it sat on. It now carries the German the owner approved in the blust.ch pilot. The README says what the German checks and commands do, and the version moves to the tag this release takes.

Verified: npm test, conventions-check and conventions-format pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
git push -u origin german-checks
gh pr create --repo robertblust/design --base main --head german-checks --title "German checks: refused forms, empty values, stale German, and design german" --body-file <(cat <<'EOF'
The German pipeline of robertblust/conventions v1.29.0 needs the design package to hold what is mechanical and to hand a page's German to its roles. typography now fails an empty German value, the informal plural, a bare count of the years and the refused forms a member's GERMAN.md lists; design german reads and writes a page's German by id and finds German left behind an English edit; translates reads its German title and description from the page; the generated note says site. Two departures from the spec's section 5 are ruled in the plan: no element form for shows, because translates already holds every data-de, and a German-unchanged commit trailer in place of a list in the page's spec.

A site taking this release must vendor conventions v1.29.0 first, or typography fails on the missing GERMAN.md; the member wave does that.

Verified: npm test passes; a round trip of design german over every page of the three sites changes no byte.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)
```

Stop for the owner's word. After the merge, on that word: `git tag -a v0.83.0 -m "v0.83.0 — German checks"` on the merge commit, push the tag, and `gh release create v0.83.0` with notes in the prose register: what changed for a site (four typography rules, `design german`, `translates` defaults, the note), what breaks (a site without conventions v1.29.0 fails typography; each site's `npm run pages` rewrites its generated notes), and how to take it (vendor v1.29.0, re-pin, `npm run design && npm run pages`, add `npx design german stale` to the pull request job).
