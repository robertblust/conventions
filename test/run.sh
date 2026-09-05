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
for f in WRITING.md WORKING.md REPOSITORIES.md AGENTS.md conventions-sync conventions-check manifest.json; do
  [ -f "$MEMBER/conventions/$f" ] || bad "sync did not write conventions/$f"
done
if [ -x "$MEMBER/conventions/conventions-check" ]; then ok "conventions-check is vendored executable"; else bad "conventions-check is not vendored executable"; fi
if grep -q '^<!-- conventions · v1.0.0 -->$' "$MEMBER/AGENTS.md" && grep -q '^<!-- end conventions -->$' "$MEMBER/AGENTS.md"
then ok "sync writes the block with the pinned tag"; else bad "block missing or unversioned"; fi
if head -1 "$MEMBER/AGENTS.md" | grep -q '^<!-- conventions'; then ok "the block is the first line"; else bad "the block is not first"; fi
if grep -q '^Its own text\.$' "$MEMBER/AGENTS.md"; then ok "the member's own text survives"; else bad "the member's own text was lost"; fi
if cmp -s "$MEMBER/conventions/WRITING.md" "$HERE/conventions/WRITING.md"; then ok "a vendored file is byte-identical"; else bad "a vendored file differs from the source"; fi
if [ -x "$MEMBER/conventions/conventions-sync" ]; then ok "the vendored script is executable"; else bad "the vendored script is not executable"; fi
if grep -q '"tag": "v1.0.0"' "$MEMBER/conventions/manifest.json" && grep -q '"conventions/WORKING.md": "sha256:' "$MEMBER/conventions/manifest.json"
then ok "the manifest records the tag and a hash per file"; else bad "the manifest is incomplete"; fi

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
sed -i.bak 's/^FILES="\(.*\) conventions-check"$/FILES="\1"/' "$SELFUPDATING" && rm -f "$SELFUPDATING.bak"
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

# the workflow's declared release and the marker version cannot drift apart
workflow_release=$(sed -n 's/^ *CONVENTIONS_RELEASE: *//p' "$HERE/.github/workflows/check.yml")
marker_version=$(sed -n '1s/.*· \(v[^ ]*\) -->.*/\1/p' "$HERE/AGENTS.md")
if [ "$workflow_release" = "$marker_version" ]
then ok "check.yml's release and AGENTS.md's marker agree on $marker_version"
else bad "check.yml declares $workflow_release, AGENTS.md's marker names $marker_version"
fi

if [ "$fails" -eq 0 ]; then echo "all pass"; else echo "$fails failing"; exit 1; fi
