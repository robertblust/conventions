# blust.ch German from the pilot — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** blust.ch serves the German the owner approved in the pilot, on design v0.83.0, with its CI failing a pull request that leaves German behind an English edit.

**Architecture:** The pilot's German is already in the worktree `~/git/robertblust/robertblust.github.io-german-pilot` on branch `german-pilot`, uncommitted, with `verify` green. It is committed as it stands, the branch takes `main` by a merge (it was cut from `67edf1b`, and the conventions v1.29.0 wave lands on `main` first), then re-pins design, regenerates what the site commits, and adds the stale check to CI.

**Tech Stack:** The site's own npm scripts (`verify`, `design`, `pages`, `og`, `sitemap`), Python for `tts/generate.py`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-24-german-pipeline-design.md` in robertblust/conventions, section 6 step 3.

## Global Constraints

- Runs after two things are merged on their own plans: the conventions v1.29.0 wave pull request on blust.ch, and design v0.83.0 tagged and released.
- `export PATH=/opt/homebrew/bin:$PATH`. Serve on a free port and stop only the PID started; `verify` takes `BASE=http://localhost:<port>`.
- The pin is a tag: `"@robertblust/design": "github:robertblust/design#v0.83.0"`. Install it by name, `npm install @robertblust/design@github:robertblust/design#v0.83.0`, because a stale lockfile otherwise keeps the old tree while `npm install` reports up to date.
- The narration re-record bills ElevenLabs characters and runs only on the owner's word; the key is pulled for that one command and never printed.
- The branch is merged into, never rebased, once pushed.
- Nothing is merged without the owner's word.

## Review Focus

- `npm run pages` after the re-pin rewrites the three generated notes; the preview had them by hand, so a `pages:check` that stays red means the design release did not carry the note.
- The essential-complexity deck changed English (slide 23 and a cue say *precision*); `design german stale` must pass on this branch because their German changed too. A run of it against `main` proves the CI step works before it is in CI.
- A `translates` spec whose literal `title` or `desc` is removed must still check the page's German title; the design release's default does that, and a page without a `de` object must not start failing.

---

### Task 1: Commit the pilot as it stands

- [ ] **Step 1: Read what is there**

Run: `cd ~/git/robertblust/robertblust.github.io-german-pilot && git status --short && git diff --stat | tail -1` Expected: eleven page files and `verify/check.mjs` modified, nothing else; about 155 lines in each direction.

- [ ] **Step 2: Serve and verify**

```bash
PORT=$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1])')
python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 & echo $! > /tmp/blust-serve.pid
BASE=http://localhost:$PORT npm run verify > /tmp/blust-verify.log 2>&1; echo exit=$?; tail -1 /tmp/blust-verify.log
```

Expected: `exit=0`, `all checks pass`. (If the pilot's preview server, PID 86744 on port 50865, is still up and the owner has said it may go, stop it with `kill 86744` and nothing else.)

- [ ] **Step 3: Commit the German and the check in two commits**

```bash
git add index.html ideas talks privacy team timeline surfaces model principles
git commit -F - <<'EOF'
The German reads as German

A German-only review found the site's German right in its marks and weak as German: English idioms taken word for word, «Seite» where the site was meant, a lost «über» before the years, «eure» in a talk. Every value went through the new pipeline — translator, an editor without the English, a literal back-reading and a fidelity check — and the owner picked every flagged sentence and term. The English of the essential-complexity deck now says precision on slide 23 and in its cue, as its note did.

Verified: npm run verify passes on every page.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
git add verify/check.mjs
git commit -F - <<'EOF'
The translates specs expect the German the pages now carry

The specs restated German strings and titles, so the new German failed them. They now name the new strings, and the decks' language pair is the title slide's kicker, ÜBERBLICK against EXPLAINED, since the owner's title is English in both views.

Verified: npm run verify passes on every page.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Take main, re-pin design, regenerate

- [ ] **Step 1: Merge main**

Run: `git fetch -q origin && git merge --no-edit origin/main; echo exit=$?` Expected: `exit=0`. On a conflict in a page, keep both sides' intent: the German from this branch, anything else from `main`; then `git add` and `git commit --no-edit`. `head -1 AGENTS.md` names `v1.29.0` and `ls conventions/GERMAN.md` finds the file.

- [ ] **Step 2: Re-pin and install by name**

```bash
sed -i '' 's|"@robertblust/design": "github:robertblust/design#v0.82.0"|"@robertblust/design": "github:robertblust/design#v0.83.0"|' package.json
npm install @robertblust/design@github:robertblust/design#v0.83.0 > /tmp/npm.log 2>&1; echo exit=$?
node -p 'require("@robertblust/design/package.json").version'
```

Expected: `exit=0`, then `0.83.0`.

- [ ] **Step 3: Regenerate**

```bash
npm run design && npm run pages && npm run sitemap; echo exit=$?
git diff --stat | tail -3
grep -c 'Der Rest dieser Website ist zweisprachig' principles/index.html team/index.html surfaces/index.html
```

Expected: `exit=0`; each of the three pages counts `1`; `git diff` shows the design files, the three notes (likely unchanged in bytes, since the preview carried the same German) and `sitemap.xml`.

- [ ] **Step 4: The checks the re-pin brings**

Run: `npm run pages:check && npm run design:check && npm run sitemap:check; echo exit=$?` Expected: `exit=0`.

Run (server from Task 1): `BASE=http://localhost:$PORT npm run verify > /tmp/blust-verify.log 2>&1; echo exit=$?; grep -E '^✗|^\s{4}\S' /tmp/blust-verify.log | head` Expected: `exit=0`. `typography` now reads `conventions/GERMAN.md`; a hit it names is a real finding on the page, fixed in its German value with `npx design german apply`, not by loosening the check.

- [ ] **Step 5: Drop the restated titles and descriptions**

In `verify/check.mjs`, delete the `title:` and `desc:` keys from every `translates` spec whose value equals the page's own `de` object — the design release now expects that by default. Keep `shows` and `hides`.

```bash
node -e '
const fs=require("fs"); let s=fs.readFileSync("verify/check.mjs","utf8"); const before=s.length;
s=s.replace(/,\s*\n\s*title: "(?:[^"\\]|\\.)*"(?=[,\s])/g, "").replace(/,\s*\n\s*desc: "(?:[^"\\]|\\.)*"(?=\s*\})/g, "");
fs.writeFileSync("verify/check.mjs", s); console.log(before - s.length, "characters removed");'
git diff --stat verify/check.mjs
BASE=http://localhost:$PORT npm run verify > /tmp/blust-verify.log 2>&1; echo exit=$?
```

Expected: characters removed, `exit=0`. Read the diff: only `title:` and `desc:` lines inside `translates` specs are gone; a spec's own top-level `title: /Robert Blust/` regex is not a string and stays. If the diff touched anything else, `git checkout verify/check.mjs` and edit by hand.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -F - <<'EOF'
The site takes design v0.83.0 and stops restating its German

v0.83.0 refuses the forms GERMAN.md lists and an empty German value, writes the generated note with «Website», and lets translates read a page's German title and description from the page. The pin moves, the generated files and notes are rewritten, and the translates specs drop the titles and descriptions they no longer need to restate.

Verified: npm run verify, pages:check, design:check and sitemap:check pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: CI fails German left behind an English edit

**Files:**

- Modify: `.github/workflows/ci.yml` (the `verify` job, after `npm ci`)
- Modify: `AGENTS.md` (the section "A page is en-US; a `-de` attribute is de-CH")

- [ ] **Step 1: See the check work against main before CI runs it**

Run: `npx design german stale origin/main HEAD; echo exit=$?` Expected: `exit=0` and `✓ no German left behind an English edit`, because every English this branch changed has new German.

Positive control, in a detached scratch worktree so the branch is untouched:

```bash
git worktree add -q --detach ../blust-stale-control HEAD
( cd ../blust-stale-control && sed -i '' 's/>Same precision — </>Same precision, always — </' talks/essential-complexity/index.html && git commit -qam "control: English only" && npx design german stale origin/main HEAD; echo exit=$? )
git worktree remove --force ../blust-stale-control
```

Expected: `exit=1`, naming `talks/essential-complexity/index.html#a…` with the German «Dieselbe Präzision – …» and the new English. The scratch worktree holds no ledger and nothing uncommitted of value, which is why `--force` is safe for it alone.

- [ ] **Step 2: The CI step**

After the job's `- run: npm ci` step, add:

```yaml
      - name: No German left behind an English edit
        if: github.event_name == 'pull_request'
        run: |
          git fetch -q origin "${{ github.base_ref }}"
          npx design german stale "origin/${{ github.base_ref }}" HEAD
```

The job already checks out full history for `sitemap:check`; if `fetch-depth: 0` is not on its checkout step, add it.

- [ ] **Step 3: AGENTS.md says it**

In the section "A page is en-US; a `-de` attribute is de-CH", replace the sentence `The \`translates\` specs in \`verify/check.mjs\` quote German too, and are the one place it is quoted on purpose.` with:

```markdown
The `translates` specs quote a few German strings in `shows`, and nothing else: the page's German title and description are read from its own `de` object. German is made by the pipeline of `conventions/WRITING.md`, and a pull request that edits English and leaves its German as it was fails CI's `design german stale`; where the German is right on purpose, a commit in the pull request says so in a trailer, `German-unchanged: <file>#<id>`, with the id from `npx design german extract <file>`.
```

- [ ] **Step 4: Checks and commit**

Run: `sh conventions/conventions-check && sh conventions/conventions-format; echo exit=$?` Expected: `exit=0`.

```bash
git add .github/workflows/ci.yml AGENTS.md
git commit -F - <<'EOF'
A pull request that leaves German behind an English edit fails

Nothing marked a German value stale when its English changed, so the rule that an English edit re-runs the translation was kept by memory. CI now runs design german stale against the pull request's base, and AGENTS.md says how to name German that is right on purpose.

Verified: design german stale passes on this branch against main and fails on a control commit that changes English alone.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: Cards, narration and the pull request

- [ ] **Step 1: The share cards**

Run: `npm run og > /tmp/og.log 2>&1; echo exit=$?; npm run og:check; echo exit=$?` Expected: both `0`; eleven `og.png`/`og.sha` pairs changed.

```bash
git add -A '*og.png' '*og.sha'
git commit -F - <<'EOF'
Every share card shows its page again

The pages' HTML changed with the German, so each card's recipe no longer matched; the cards are English and look the same, re-rendered so og:check holds them to the pages.

Verified: npm run og:check passes.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

- [ ] **Step 2: The narration, on the owner's word only**

Run first: `./tts/generate.py --dry-run 2>&1 | tail -3` Expected: `would write` for the German clips whose notes changed, and the characters it would bill. Report that line to the owner and wait.

On the owner's word:

```bash
export ELEVENLABS_API_KEY="$(zsh -ic 'printf %s "$ELEVENLABS_API_KEY"' 2>/dev/null)"
./tts/generate.py > /tmp/tts.log 2>&1; echo exit=$?; tail -2 /tmp/tts.log
./tts/generate.py --dry-run 2>&1 | grep -c 'would write'
git add tts talks/*/audio 2>/dev/null; git status --short | head
```

Expected: `exit=0`, then `0` clips left to write. Commit the clips with a message that names the count and the characters billed, from the log.

- [ ] **Step 3: Push and open the pull request**

```bash
git -c credential.helper= -c credential.helper='!gh auth git-credential' push -u https://github.com/robertblust/robertblust.github.io.git german-pilot
gh pr create --repo robertblust/robertblust.github.io --base main --head german-pilot --title "The German reads as German" --body-file <(cat <<'EOF'
The site's German was right in its marks and weak as German, and the translator's own back-translation could not see it. Every German value went through the pipeline of conventions v1.29.0 — a translator working the whole page, an editor that read the German without the English, a literal back-reading and a fidelity check against the English — and the owner picked every flagged sentence and term on the served pages before anything was committed. The English of the essential-complexity deck now says precision where its slide and cue said clarity.

The site takes design v0.83.0, which refuses the forms GERMAN.md lists and an empty German value, writes the generated note with «Website», and reads each page's German title and description from the page; the translates specs stop restating them. CI fails a pull request that edits English and leaves its German unchanged. The share cards are re-rendered, and the German narration is re-recorded or not as the owner decided.

Verified: npm run verify, pages:check, design:check, sitemap:check and og:check pass; design german stale passes against main.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)
kill "$(cat /tmp/blust-serve.pid)"
```

Then stop: report the pull request and its checks. Merging is the owner's word; after the merge, remove the worktree and branch by name.

---

## After this plan

guestgraph.io and companygraph.io each get the pipeline the way blust.ch did: every page through the four roles, the review's findings as the seed (the empty `apaleo-unreachable` section, «Reservierung», the DSG forms, «Offener Kern», «Schnittstelle»), the owner's picks on a review page, then the same commits, re-pin and CI step. Each is its own plan, written when blust.ch has merged, from what this one teaches.
