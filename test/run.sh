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
for f in WRITING.md WORKING.md REPOSITORIES.md AGENTS.md conventions-sync manifest.json; do
  [ -f "$MEMBER/conventions/$f" ] || bad "sync did not write conventions/$f"
done
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

if [ -x "$HERE/conventions/conventions-check" ]; then ok "conventions-check is executable"; else bad "conventions-check is not executable"; fi
if grep -q 'conventions-check' "$HERE/conventions/conventions-sync"; then ok "the sync script vendors conventions-check"; else bad "the sync script does not vendor conventions-check"; fi

if [ "$fails" -eq 0 ]; then echo "all pass"; else echo "$fails failing"; exit 1; fi
