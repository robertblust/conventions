#!/bin/sh
# The em-dash is spaced in English and absent in German, so a closed em-dash is wrong in every
# Markdown file here, WRITING.md included, which states the rule with a spaced one. Fenced code
# is skipped: a commit message or a command quoted there is not this repository's prose.
# docs/superpowers/ is left out for the reason the spelling tripwire leaves it out.
set -eu
HERE=$(cd "$(dirname "$0")/.." && pwd)
cd "$HERE"
hits=$(find . -name '*.md' -not -path './.git/*' -not -path './docs/superpowers/*' -exec awk '
  FNR == 1 { fence = 0 }
  /^```/ { fence = !fence; next }
  !fence && /[^ ]—|—[^ ]/ { print FILENAME ":" FNR ": " $0 }' {} +)
if [ -n "$hits" ]; then
  echo "✗ closed em-dashes:"
  echo "$hits"
  exit 1
fi
echo "✓ every em-dash is spaced"
