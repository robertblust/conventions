#!/bin/sh
# Runs the sync script against a temporary member, with this checkout as the source, so the
# test needs no network and no tag. Every assertion prints one line; the run fails if any
# assertion failed.
set -eu
HERE=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
MEMBER=$TMP/member
mkdir -p "$MEMBER"
fails=0
ok()  { echo "✓ $1"; }
bad() { echo "✗ $1"; fails=$((fails + 1)); }
run() { (cd "$MEMBER" && CONVENTIONS_SOURCE="$HERE" sh "$HERE/conventions/conventions-sync" "$@"); }

printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0" }\n' > "$MEMBER/conventions.json"
printf '# member — working conventions\n\nIts own text.\n' > "$MEMBER/AGENTS.md"

# sync vendors the files and writes the block
run sync > /dev/null
for f in WRITING.md WORKING.md REPOSITORIES.md WRITER.md TRANSLATOR.md GLOSSARY.md AGENTS.md conventions-sync conventions-check conventions-format markdown-rules.cjs vscode-settings.json vscode-extensions.json manifest.json; do
  [ -f "$MEMBER/conventions/$f" ] || bad "sync did not write conventions/$f"
done
# The rule set goes to the member's root, because markdownlint-cli2 and the editor plugins on it
# read it there and nowhere else.
if [ -f "$MEMBER/.markdownlint-cli2.jsonc" ]; then ok "sync writes the rule set at the member's root"; else bad "sync did not write the rule set at the member's root"; fi
if cmp -s "$MEMBER/.markdownlint-cli2.jsonc" "$HERE/.markdownlint-cli2.jsonc"
then ok "the root rule set is byte-identical to the source"; else bad "the root rule set differs from the source"; fi
# The two editor files are the member's own: written where it has none, never over one it has.
for f in .vscode/settings.json .vscode/extensions.json; do
  if [ -f "$MEMBER/$f" ]; then ok "sync seeds $f where a member has none"; else bad "sync did not seed $f"; fi
done
printf '{ "java.compile.nullAnalysis.mode": "automatic" }\n' > "$MEMBER/.vscode/settings.json"
run sync > /dev/null
if [ "$(cat "$MEMBER/.vscode/settings.json")" = '{ "java.compile.nullAnalysis.mode": "automatic" }' ]
then ok "sync leaves a settings file the member already has"
else bad "sync overwrote the member's own settings file: $(cat "$MEMBER/.vscode/settings.json")"
fi
if ! grep -q '"\.vscode/settings\.json"' "$MEMBER/conventions/manifest.json"
then ok "a seeded file is not hashed into the manifest, so the member may edit it"
else bad "a seeded file was hashed into the manifest"
fi
cp "$MEMBER/conventions/vscode-settings.json" "$MEMBER/.vscode/settings.json"
if [ -x "$MEMBER/conventions/conventions-check" ]; then ok "conventions-check is vendored executable"; else bad "conventions-check is not vendored executable"; fi
if [ -x "$MEMBER/conventions/conventions-format" ]; then ok "conventions-format is vendored executable"; else bad "conventions-format is not vendored executable"; fi
if grep -q '^<!-- conventions · v1.0.0 -->$' "$MEMBER/AGENTS.md" && grep -q '^<!-- end conventions -->$' "$MEMBER/AGENTS.md"
then ok "sync writes the block with the pinned tag"; else bad "block missing or unversioned"; fi
if head -1 "$MEMBER/AGENTS.md" | grep -q '^<!-- conventions'; then ok "the block is the first line"; else bad "the block is not first"; fi
if grep -q '^Its own text\.$' "$MEMBER/AGENTS.md"; then ok "the member's own text survives"; else bad "the member's own text was lost"; fi
if cmp -s "$MEMBER/conventions/WRITING.md" "$HERE/conventions/WRITING.md"; then ok "a vendored file is byte-identical"; else bad "a vendored file differs from the source"; fi
if [ -x "$MEMBER/conventions/conventions-sync" ]; then ok "the vendored script is executable"; else bad "the vendored script is not executable"; fi
if grep -q '"tag": "v1.0.0"' "$MEMBER/conventions/manifest.json" && grep -q '"conventions/WORKING.md": "sha256:' "$MEMBER/conventions/manifest.json"
then ok "the manifest records the tag and a hash per file"; else bad "the manifest is incomplete"; fi
if grep -q '"\.markdownlint-cli2\.jsonc": "sha256:' "$MEMBER/conventions/manifest.json"
then ok "the manifest hashes a root file under its root path"; else bad "the manifest does not hash the root file"; fi
if python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$MEMBER/conventions/manifest.json" 2> /dev/null
then ok "the manifest is valid JSON with both lists in it"; else bad "the manifest is not valid JSON"; fi

# check passes on a fresh sync
if run check > /dev/null; then ok "check passes after sync"; else bad "check fails after sync"; fi

# a second sync changes nothing
cp "$MEMBER/AGENTS.md" "$TMP/agents.before"
run sync > /dev/null
if cmp -s "$MEMBER/AGENTS.md" "$TMP/agents.before"; then ok "a second sync leaves AGENTS.md unchanged"; else bad "a second sync rewrote AGENTS.md"; fi

# an edited vendored file is named
echo "edited here" >> "$MEMBER/conventions/WORKING.md"
out=$(run check 2>&1 || true)
if echo "$out" | grep -q 'conventions/WORKING.md differs'; then ok "check names an edited vendored file"; else bad "check missed an edited file: $out"; fi
run sync > /dev/null

# an edited root file is named, as an edited vendored one is
printf '\n' >> "$MEMBER/.markdownlint-cli2.jsonc"
out=$(run check 2>&1 || true)
if echo "$out" | grep -q '\.markdownlint-cli2.jsonc differs'; then ok "check names an edited root file"; else bad "check missed an edited root file: $out"; fi
rm "$MEMBER/.markdownlint-cli2.jsonc"
out=$(run check 2>&1 || true)
if echo "$out" | grep -q '\.markdownlint-cli2.jsonc is missing'; then ok "check names a missing root file"; else bad "check missed a missing root file: $out"; fi
run sync > /dev/null
if run check > /dev/null; then ok "sync restores the root files"; else bad "sync did not restore the root files: $(run check 2>&1)"; fi

# what an earlier release vendored and this one does not is removed by sync and named until then
printf 'the old rule set\n' > "$MEMBER/conventions/markdown.markdownlint-cli2.jsonc"
out=$(run check 2>&1 || true)
if echo "$out" | grep -q 'conventions/markdown.markdownlint-cli2.jsonc is what an earlier release vendored'
then ok "check names a file the release no longer carries"; else bad "a retired file was not named: $out"; fi
run sync > /dev/null
if [ ! -f "$MEMBER/conventions/markdown.markdownlint-cli2.jsonc" ]
then ok "sync removes a file the release no longer carries"; else bad "sync left a retired file in place"; fi
if run check > /dev/null; then ok "check passes once the retired file is gone"; else bad "check still fails after the retired file was removed: $(run check 2>&1)"; fi

# an edited block is caught, and sync repairs it
sed -i.bak 's/^- .conventions\/WRITING.md.*$/- gone/' "$MEMBER/AGENTS.md" && rm -f "$MEMBER/AGENTS.md.bak"
out=$(run check 2>&1 || true)
if echo "$out" | grep -q 'block in AGENTS.md'; then ok "check catches an edited block"; else bad "check missed an edited block: $out"; fi
run sync > /dev/null
if run check > /dev/null; then ok "sync repairs the block"; else bad "sync did not repair the block"; fi

# a member with no AGENTS.md gets one
rm "$MEMBER/AGENTS.md"
run sync > /dev/null
if [ -f "$MEMBER/AGENTS.md" ] && run check > /dev/null; then ok "sync creates AGENTS.md when there is none"; else bad "sync did not create AGENTS.md"; fi

# a moved pin is reported until sync runs
sed -i.bak 's/v1\.0\.0/v9.9.9/' "$MEMBER/conventions.json" && rm -f "$MEMBER/conventions.json.bak"
out=$(run check 2>&1 || true)
if echo "$out" | grep -q 'names v9.9.9'; then ok "check reports a pin the copy does not match"; else bad "check missed a moved pin: $out"; fi

# no pin is an error, not a default
rm "$MEMBER/conventions.json"
out=$(run check 2>&1 || true)
if echo "$out" | grep -q 'no conventions.json'; then ok "a member without a pin is an error"; else bad "a missing pin was not reported: $out"; fi

# a wrong command prints usage
out=$(run frobnicate 2>&1 || true)
if echo "$out" | grep -q '^usage:'; then ok "an unknown command prints usage"; else bad "no usage on an unknown command: $out"; fi

# --- conventions-sync: a script that knows to re-exec fetches itself first ------------------
# This proves the mechanism for a script that already carries it: its own FILES is trimmed by
# hand to look like an older release's, but the re-exec code stays, which is the case every
# real upgrade from v1.3.0 onward is in. It does not prove anything about the real v1.2.0
# binary, which lacks the mechanism entirely and still needs sync run twice — see README.md.
SELFUPDATING=$TMP/selfupdating-conventions-sync
cp "$HERE/conventions/conventions-sync" "$SELFUPDATING"
sed -i.bak 's/^FILES="\(.*\) conventions-check.*"$/FILES="\1"/' "$SELFUPDATING" && rm -f "$SELFUPDATING.bak"
if grep '^FILES=' "$SELFUPDATING" | grep -q conventions-check; then bad "the trimmed FILES still names conventions-check"; fi
UPGRADE=$TMP/upgrade
mkdir -p "$UPGRADE"
printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0" }\n' > "$UPGRADE/conventions.json"
(cd "$UPGRADE" && CONVENTIONS_SOURCE="$HERE" sh "$SELFUPDATING" sync) > /dev/null
if [ -f "$UPGRADE/conventions/conventions-check" ]
then ok "a script that knows to re-exec vendors a file its own FILES lacks in one sync"
else bad "conventions-check is still missing after one sync from a script that knows to re-exec"
fi
if (cd "$UPGRADE" && CONVENTIONS_SOURCE="$HERE" sh conventions/conventions-sync check) > /dev/null
then ok "check passes after that one sync"
else bad "check failed after that one sync"
fi

# --- conventions-check: the prose tripwires, vendored ---------------------------------------
P=$TMP/prose
mkdir -p "$P/docs/kept" "$P/vendored"
pcheck() { (cd "$P" && sh "$HERE/conventions/conventions-check"); }

printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0" }\n' > "$P/conventions.json"
printf '# clean\n\nThe color of the license — like this — is fine.\n' > "$P/README.md"
if pcheck > /dev/null; then ok "conventions-check passes a clean tree"; else bad "conventions-check fails a clean tree: $(pcheck 2>&1)"; fi

printf 'The colour of it.\n' > "$P/docs/kept/a.md"
out=$(pcheck 2>&1 || true)
if echo "$out" | grep -q 'docs/kept/a.md:1: colour'; then ok "a British word is named with its file and line"; else bad "a British word was not named: $out"; fi

# shellcheck disable=SC2016 # literal markdown backticks, not command substitution
printf '```\ncolour inside a fence\n```\n\nand `colour` inline.\n' > "$P/docs/kept/a.md"
if pcheck > /dev/null; then ok "fenced and inline code are not prose"; else bad "code was scanned as prose: $(pcheck 2>&1)"; fi

printf 'A closed—dash.\n' > "$P/docs/kept/a.md"
out=$(pcheck 2>&1 || true)
if echo "$out" | grep -q 'docs/kept/a.md:1: closed em-dash'; then ok "a closed em-dash is named"; else bad "a closed em-dash was missed: $out"; fi
printf 'A spaced — dash.\n' > "$P/docs/kept/a.md"
if pcheck > /dev/null; then ok "a spaced em-dash passes"; else bad "a spaced em-dash failed: $(pcheck 2>&1)"; fi

printf 'The colour in a vendored file.\n' > "$P/vendored/v.md"
out=$(pcheck 2>&1 || true)
if echo "$out" | grep -q 'vendored/v.md'; then ok "without exclude, every folder is scanned"; else bad "a folder was skipped with no exclude: $out"; fi
printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0", "exclude": ["vendored", "docs/superpowers"] }\n' > "$P/conventions.json"
if pcheck > /dev/null; then ok "an excluded folder is not read"; else bad "an excluded folder was read: $(pcheck 2>&1)"; fi

mkdir -p "$P/my folder" "$P/colour-folder"
printf 'The colour in a folder with a space.\n' > "$P/my folder/v.md"
printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0", "exclude": ["vendored", "docs/superpowers", "my folder"] }\n' > "$P/conventions.json"
if pcheck > /dev/null; then ok "an exclude entry with a space in it is honored"; else bad "an exclude entry with a space was not honored: $(pcheck 2>&1)"; fi

printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0", "exclude": ["vendored", "docs/superpowers", "my folder/"] }\n' > "$P/conventions.json"
if pcheck > /dev/null; then ok "an exclude entry with a trailing slash is honored"; else bad "an exclude entry with a trailing slash was not honored: $(pcheck 2>&1)"; fi

printf '```\nunclosed fence\nThe colour of it is grey.\n' > "$P/docs/kept/a.md"
out=$(pcheck 2>&1 || true)
if echo "$out" | grep -q 'docs/kept/a.md:3: unclosed code fence'; then ok "an unclosed fence is reported instead of silently dropped"; else bad "an unclosed fence was not reported: $out"; fi
printf 'A spaced — dash.\n' > "$P/docs/kept/a.md"

printf 'This is fine and correct.\n' > "$P/colour-folder/notes.md"
if pcheck > /dev/null; then ok "a stem in the file's path is not mistaken for a stem in its prose"; else bad "a stem in the file's path was wrongly flagged: $(pcheck 2>&1)"; fi

# a stem anchored on an American word does not fire, and the British forms still do
printf 'An organism is an optimist about initialisms.\n' > "$P/docs/kept/a.md"
if pcheck > /dev/null; then ok "American words that contain a stem are not hits"; else bad "an American word was wrongly flagged: $(pcheck 2>&1)"; fi
printf 'The organisation meets today.\nThe result is optimised.\n' > "$P/docs/kept/a.md"
out=$(pcheck 2>&1 || true)
if echo "$out" | grep -q ':1: organisa$' && echo "$out" | grep -q ':2: optimise$'
then ok "the British forms of those stems are still caught"
else bad "a British form was missed: $out"
fi

# the reported word drops a trailing non-letter
printf 'It is grey today.\nMind the kerb.\n' > "$P/docs/kept/a.md"
out=$(pcheck 2>&1 || true)
if echo "$out" | grep -q ':1: grey$' && echo "$out" | grep -q ':2: kerb$'
then ok "a trailing non-letter is stripped from the reported word"
else bad "the reported word kept its trailing punctuation: $out"
fi

# a CRLF line ending is not mistaken for a non-space neighbor of a spaced em-dash
printf 'A trailing dash —\r\n' > "$P/docs/kept/a.md"
if pcheck > /dev/null
then ok "a spaced em-dash before a CRLF line ending passes"
else bad "a CRLF line ending after a spaced em-dash was wrongly flagged: $(pcheck 2>&1)"
fi
printf 'A spaced — dash.\n' > "$P/docs/kept/a.md"

# an empty scan is an error, not a silent green
out=$(CONVENTIONS_ROOT="$TMP/nowhere" sh "$HERE/conventions/conventions-check" 2>&1 || true)
if echo "$out" | grep -q 'no Markdown file was scanned under'
then ok "an empty scan is not silently green"
else bad "an empty scan was not caught: $out"
fi

printf 'A generalist with realism, emphasis, criticism, synthesis and a paralysis; the meter and the specialist.\n' > "$P/docs/kept/a.md"
if pcheck > /dev/null; then ok "American words that begin like an -ise stem are not hits"; else bad "an American word tripped an -ise stem: $(pcheck 2>&1)"; fi
printf 'They generalise.\nIt authorised.\nIt materialised.\nIt synthesised.\nIt modelled.\nThe harbour.\nIn metres.\n' > "$P/docs/kept/a.md"
out=$(pcheck 2>&1 || true)
for w in generalise authorised materialised synthesised modelled harbour metres; do
  if echo "$out" | grep -q ": $w"; then ok "$w is a hit"; else bad "$w was not a hit: $out"; fi
done
printf '# clean\n' > "$P/docs/kept/a.md"

if [ -x "$HERE/conventions/conventions-check" ]; then ok "conventions-check is executable"; else bad "conventions-check is not executable"; fi
if grep -q 'conventions-check' "$HERE/conventions/conventions-sync"; then ok "the sync script vendors conventions-check"; else bad "the sync script does not vendor conventions-check"; fi

# a folder git ignores is not prose the job can see, so the prose check does not read it either
GI=$TMP/prose-ignored
mkdir -p "$GI/scratch"
printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0" }\n' > "$GI/conventions.json"
printf '# kept\n\nA spaced — dash.\n' > "$GI/README.md"
printf 'The colour of it.\n' > "$GI/scratch/s.md"
gicheck() { CONVENTIONS_ROOT="$GI" sh "$HERE/conventions/conventions-check"; }
out=$(gicheck 2>&1 || true)
if echo "$out" | grep -q 'scratch/s.md:1: colour'
then ok "outside a repository the prose walk is unchanged"
else bad "the prose walk skipped a folder where there is no repository: $out"
fi
(cd "$GI" && git init -q && printf 'scratch/\n' > .gitignore) > /dev/null 2>&1
if gicheck > /dev/null 2>&1
then ok "the prose check does not read a folder git ignores"
else bad "the prose check read a folder git ignores: $(gicheck 2>&1)"
fi

# --- conventions-check: the README title -----------------------------------------------------
# A fixture, not a clone: CONVENTIONS_REPO is what a tree with no remote and no runner uses to
# say which row is its own. The table here is two rows of the real shape, one ordinary member
# and one site, because the site is the case that must need no clause in the check.
T=$TMP/title
mkdir -p "$T/conventions"
tcheck() { (cd "$T" && CONVENTIONS_REPO="$1" sh "$HERE/conventions/conventions-check"); }
printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0" }\n' > "$T/conventions.json"
cat > "$T/conventions/REPOSITORIES.md" <<'EOF'
# Repositories

| Repository | Title | Purpose | Default branch | Local path |
|---|---|---|---|---|
| robertblust/design | Robert Blust — Design | the design system | main | ~/git/robertblust/design |
| robertblust/robertblust.github.io | blust.ch | the profile page | main | ~/git/robertblust/robertblust.github.io |
EOF

printf '# Robert Blust — Design\n\nThe design system.\n' > "$T/README.md"
if tcheck robertblust/design > /dev/null
then ok "a README whose title is its row passes"
else bad "a matching title failed: $(tcheck robertblust/design 2>&1)"
fi

printf '# @robertblust/design\n\nThe design system.\n' > "$T/README.md"
out=$(tcheck robertblust/design 2>&1 || true)
if echo "$out" | grep -q 'README.md:1: first line is "# @robertblust/design", REPOSITORIES.md asks for "# Robert Blust — Design"'
then ok "a wrong title names what was found and what the row asks for"
else bad "a wrong title was not named: $out"
fi

printf 'Robert Blust — Design\n\nNo H1 at all.\n' > "$T/README.md"
out=$(tcheck robertblust/design 2>&1 || true)
if echo "$out" | grep -q 'first line is "Robert Blust — Design", REPOSITORIES.md asks for "# Robert Blust — Design"'
then ok "a first line that is not an H1 is told apart from the title it resembles"
else bad "a missing H1 was not distinguished: $out"
fi

printf '# blust.ch\n\nThe profile page.\n' > "$T/README.md"
if tcheck robertblust/robertblust.github.io > /dev/null
then ok "a site's row is its domain and needs no clause in the check"
else bad "a site row failed: $(tcheck robertblust/robertblust.github.io 2>&1)"
fi

printf '# Robert Blust — Design\n\nThe design system.\n' > "$T/README.md"
out=$(tcheck robertblust/somewhere-else 2>&1 || true)
if echo "$out" | grep -q 'robertblust/somewhere-else is not in REPOSITORIES.md'
then ok "a repository outside the family is not held to the list"
else bad "a repository outside the family was held to the list: $out"
fi

out=$( (cd "$T" && unset CONVENTIONS_REPO GITHUB_REPOSITORY; sh "$HERE/conventions/conventions-check") 2>&1 || true)
if echo "$out" | grep -q 'no repository identity here'
then ok "a tree with no identity passes with a line saying why"
else bad "a tree with no identity did not pass quietly: $out"
fi

mv "$T/conventions/REPOSITORIES.md" "$T/conventions/REPOSITORIES.md.away"
out=$(tcheck robertblust/design 2>&1 || true)
if echo "$out" | grep -q 'no conventions/REPOSITORIES.md here'
then ok "a tree that has not vendored the list passes with a line saying why"
else bad "a tree without the list did not pass quietly: $out"
fi
mv "$T/conventions/REPOSITORIES.md.away" "$T/conventions/REPOSITORIES.md"

# --- conventions-format: the one Markdown form ---------------------------------------------
# These run the real tool through npx, so they need Node 22 or later and, the first time, a
# network; CI has both. A machine without npx fails here rather than passing unseen.
F=$TMP/form
mkdir -p "$F/conventions" "$F/docs" "$F/vendored" "$F/node_modules/pkg" "$F/.claude/agents"
cp "$HERE/.markdownlint-cli2.jsonc" "$F/"
cp "$HERE/conventions/markdown-rules.cjs" "$F/conventions/"
printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0", "exclude": ["vendored"] }\n' > "$F/conventions.json"
fcheck() { CONVENTIONS_ROOT="$F" sh "$HERE/conventions/conventions-format" "$@"; }
# The table the way an editor that lines columns up writes it, alignment colons included, and
# the same table in the family's form.
cat > "$TMP/padded.md" <<'EOF'
# B

| Field     | Type | Count |
|:--------- | ---- | ----: |
| `a`       | text |     1 |
EOF
cat > "$TMP/compact.md" <<'EOF'
# B

| Field | Type | Count |
| :--- | --- | ---: |
| `a` | text | 1 |
EOF
if ! command -v npx > /dev/null 2>&1; then
  bad "npx is not on the PATH, so the Markdown form was not tested"
else
  cat > "$F/docs/a.md" <<'EOF'
# A

| Field | Type |
| --- | --- |
| `a` | text |

Some *em* and **strong**.

- one
- two
EOF
  if fcheck > /dev/null 2>&1; then ok "a file in the form passes"; else bad "a file in the form failed: $(fcheck 2>&1)"; fi

  cp "$TMP/padded.md" "$F/docs/b [draft].md"
  out=$(fcheck 2>&1 || true)
  if echo "$out" | grep -q 'docs/b \[draft\].md:3: MD060/table-column-style' && echo "$out" | grep -q 'docs/b \[draft\].md:4: table-delimiter-row'
  then ok "a padded table is named by line and rule, in a file whose name has brackets"
  else bad "a padded table was not named: $out"
  fi
  if fcheck fix > /dev/null 2>&1 && cmp -s "$F/docs/b [draft].md" "$TMP/compact.md"
  then ok "fix writes the compact table, delimiter row and alignment colons included"
  else bad "fix did not write the compact table: $(cat "$F/docs/b [draft].md")"
  fi

  # A heading, a list and a fence crowded against their neighbors, which fix opens up. Written
  # as one file because the three rules meet in ordinary prose exactly like this.
  # shellcheck disable=SC2016 # literal markdown backticks, not command substitution
  printf '# D\n## Crowded\nLead-in:\n- one\n- two\n\nAfter.\n```sh\necho hi\n```\n' > "$F/docs/d.md"
  out=$(fcheck 2>&1 || true)
  if echo "$out" | grep -q 'docs/d.md:2: MD022' && echo "$out" | grep -q 'docs/d.md:4: MD032' && echo "$out" | grep -q 'docs/d.md:8: MD031'
  then ok "a crowded heading, list and fence are each named by line and rule"
  else bad "the structural rules did not fire: $out"
  fi
  # shellcheck disable=SC2016 # literal markdown backticks, not command substitution
  if fcheck fix > /dev/null 2>&1 && [ "$(cat "$F/docs/d.md")" = "$(printf '# D\n\n## Crowded\n\nLead-in:\n\n- one\n- two\n\nAfter.\n\n```sh\necho hi\n```')" ]
  then ok "fix opens up a crowded heading, list and fence in one run"
  else bad "fix did not open them up: $(cat "$F/docs/d.md")"
  fi
  rm "$F/docs/d.md"

  # Every rule of the form can be written by the tool. A rule that only reported would leave
  # fix green with hits still standing, which is what this asserts against.
  printf '# E\n\nA line.\n' > "$F/docs/e.md"
  if fcheck fix > /dev/null 2>&1 && fcheck > /dev/null 2>&1
  then ok "fix leaves a tree the check passes, so no rule of the form only reports"
  else bad "fix left hits standing: $(fcheck 2>&1)"
  fi
  rm "$F/docs/e.md"

  printf '# C\n\n* a list in stars and _emphasis_ in underscores\n' > "$F/docs/c.md"
  if fcheck fix > /dev/null 2>&1 && [ "$(cat "$F/docs/c.md")" = "$(printf '# C\n\n- a list in stars and *emphasis* in underscores')" ]
  then ok "fix writes dashes for a list and asterisks for emphasis"
  else bad "fix did not write dashes and asterisks: $(cat "$F/docs/c.md")"
  fi

  cp "$TMP/padded.md" "$F/vendored/v.md"
  cp "$TMP/padded.md" "$F/node_modules/pkg/README.md"
  if fcheck > /dev/null 2>&1; then ok "an excluded folder and node_modules are not read"; else bad "an excluded folder or node_modules was read: $(fcheck 2>&1)"; fi

  # format-exclude is the form's own list: where it is named it replaces exclude, so a folder the
  # prose check skips is formatted, and an empty list formats everything but node_modules.
  mkdir -p "$F/specs"
  cp "$TMP/padded.md" "$F/specs/s.md"
  printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0", "exclude": ["vendored", "specs"], "format-exclude": ["vendored"] }\n' > "$F/conventions.json"
  out=$(fcheck 2>&1 || true)
  if echo "$out" | grep -q 'specs/s.md:3' && ! echo "$out" | grep -q 'vendored/v.md'
  then ok "format-exclude replaces exclude: a folder only the prose check skips is formatted"
  else bad "format-exclude did not replace exclude: $out"
  fi
  printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0", "exclude": ["vendored"], "format-exclude": [] }\n' > "$F/conventions.json"
  out=$(fcheck 2>&1 || true)
  if echo "$out" | grep -q 'vendored/v.md:3' && ! echo "$out" | grep -q 'node_modules'
  then ok "an empty format-exclude formats every folder but node_modules"
  else bad "an empty format-exclude still skipped a folder: $out"
  fi
  rm -r "$F/specs"
  printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0", "exclude": ["vendored"] }\n' > "$F/conventions.json"

  cp "$TMP/padded.md" "$F/.claude/agents/w.md"
  out=$(fcheck 2>&1 || true)
  if echo "$out" | grep -q '.claude/agents/w.md:4'; then ok "a folder whose name starts with a dot is read"; else bad "a dot folder was skipped: $out"; fi
  rm "$F/.claude/agents/w.md"

  # The editor's half of the form: the two .vscode files are the member's own, and what the
  # family owns of them is one settings key and one recommended id. A member that keeps its own
  # language settings beside them passes; one that changes the family's part does not.
  E=$TMP/editor
  mkdir -p "$E/conventions" "$E/.vscode" "$E/docs"
  cp "$HERE/.markdownlint-cli2.jsonc" "$E/"
  cp "$HERE/conventions/markdown-rules.cjs" "$HERE/conventions/vscode-settings.json" "$HERE/conventions/vscode-extensions.json" "$E/conventions/"
  printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0" }\n' > "$E/conventions.json"
  printf '# E\n' > "$E/docs/a.md"
  cp "$E/conventions/vscode-settings.json" "$E/.vscode/settings.json"
  cp "$E/conventions/vscode-extensions.json" "$E/.vscode/extensions.json"
  echeck() { CONVENTIONS_ROOT="$E" sh "$HERE/conventions/conventions-format"; }
  if echeck > /dev/null 2>&1; then ok "a member seeded from the release passes the editor check"; else bad "a seeded member failed: $(echeck 2>&1)"; fi

  printf '{\n "[markdown]": { "editor.formatOnSave": true, "editor.defaultFormatter": "DavidAnson.vscode-markdownlint" },\n "java.compile.nullAnalysis.mode": "automatic"\n}\n' > "$E/.vscode/settings.json"
  printf '{ "recommendations": ["redhat.java", "DavidAnson.vscode-markdownlint"] }\n' > "$E/.vscode/extensions.json"
  if echeck > /dev/null 2>&1
  then ok "a member keeps its own settings and extensions beside the family's"
  else bad "a member's own settings were rejected: $(echeck 2>&1)"
  fi

  printf '{ "[markdown]": { "editor.defaultFormatter": "esbenp.prettier-vscode", "editor.formatOnSave": true } }\n' > "$E/.vscode/settings.json"
  out=$(echeck 2>&1 || true)
  if echo "$out" | grep -q 'its "\[markdown\]" is not the release'
  then ok "a member that changes the family's settings key is named"
  else bad "a changed settings key was not named: $out"
  fi

  cp "$E/conventions/vscode-settings.json" "$E/.vscode/settings.json"
  printf '{ "recommendations": ["redhat.java"] }\n' > "$E/.vscode/extensions.json"
  out=$(echeck 2>&1 || true)
  if echo "$out" | grep -q 'is not recommended'
  then ok "a member that drops the family's extension is named"
  else bad "a dropped extension was not named: $out"
  fi

  cp "$E/conventions/vscode-extensions.json" "$E/.vscode/extensions.json"
  rm "$E/.vscode/settings.json"
  out=$(echeck 2>&1 || true)
  if echo "$out" | grep -q '\.vscode/settings.json is missing'
  then ok "a missing editor file is told to sync"
  else bad "a missing editor file was not named: $out"
  fi

  printf '{ "[markdown]":\n' > "$E/.vscode/settings.json"
  out=$(echeck 2>&1 || true)
  if echo "$out" | grep -q 'not readable as JSON'
  then ok "an editor file that does not parse is named, not skipped"
  else bad "an unparsable editor file was not named: $out"
  fi

  # What git ignores is scratch the shared job never sees, since it checks out tracked files
  # only; a local run that failed on it would fail where the job is green. The same fixture
  # before git init proves the walk is unchanged where there is no repository.
  G=$TMP/ignored
  mkdir -p "$G/conventions" "$G/scratch"
  cp "$HERE/.markdownlint-cli2.jsonc" "$G/"
  cp "$HERE/conventions/markdown-rules.cjs" "$G/conventions/"
  printf '{ "repo": "robertblust/conventions", "tag": "v1.0.0" }\n' > "$G/conventions.json"
  printf 'scratch/\n' > "$G/.gitignore"
  printf '# G\n' > "$G/keep.md"
  cp "$TMP/padded.md" "$G/scratch/s.md"
  gcheck() { CONVENTIONS_ROOT="$G" sh "$HERE/conventions/conventions-format"; }
  out=$(gcheck 2>&1 || true)
  if echo "$out" | grep -q 'scratch/s.md:3'
  then ok "outside a repository the walk is unchanged and an untracked folder is formatted"
  else bad "a folder was skipped where there is no repository to ignore it: $out"
  fi
  (cd "$G" && git init -q) > /dev/null 2>&1
  if gcheck > /dev/null 2>&1
  then ok "a folder git ignores is not formatted"
  else bad "a folder git ignores was formatted: $(gcheck 2>&1)"
  fi

  rm "$F/.markdownlint-cli2.jsonc"
  out=$(fcheck 2>&1 || true)
  if echo "$out" | grep -q 'no .markdownlint-cli2.jsonc'; then ok "a member without the rules is told to sync"; else bad "missing rules were not reported: $out"; fi
fi

# the workflow's declared release and the marker version cannot drift apart
workflow_release=$(sed -n 's/^ *CONVENTIONS_RELEASE: *//p' "$HERE/.github/workflows/check.yml")
marker_version=$(sed -n '1s/.*· \(v[^ ]*\) -->.*/\1/p' "$HERE/AGENTS.md")
if [ "$workflow_release" = "$marker_version" ]
then ok "check.yml's release and AGENTS.md's marker agree on $marker_version"
else bad "check.yml declares $workflow_release, AGENTS.md's marker names $marker_version"
fi

if [ "$fails" -eq 0 ]; then echo "all pass"; else echo "$fails failing"; exit 1; fi
