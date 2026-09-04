#!/bin/sh
# Every Markdown file here is American English, WRITING.md included — it may not quote a
# British form even to forbid it, because this is the list, and the list lives here. Stems
# rather than words, so derived forms are caught; a stem is only on the list when no
# American word contains it. docs/superpowers/ is the one place left out: a spec or a plan
# that specifies this very list has to quote it.
set -eu
HERE=$(cd "$(dirname "$0")/.." && pwd)
cd "$HERE"
STEMS='organis|colour|behaviour|centre|licence|recognis|modelling|catalogue|\bgrey\b|judgement|artefact|whilst|amongst|favour|honour|analys(e|ed|ing)\b|optimis|normalis|serialis|initialis|visualis|minimis|prioritis|customis|summaris|categoris|parameteris|rasteris|unrecognis|cancelled|travelled|labelled|aluminium|instalment|neighbour|totalled|defence|offence|\bprogrammes?\b|\bfulfil\b|\benrol\b|skilful|ageing|\bcosy\b|focuss|\bcheque\b|\btyre\b|\bkerb\b|\bstorey\b|\bmould\b|\bplough\b|\bdraught\b|sceptic'
hits=$(grep -rn -i -E "$STEMS" --include='*.md' . --exclude-dir=.git --exclude-dir=superpowers || true)
if [ -n "$hits" ]; then
  echo "✗ British spellings:"
  echo "$hits"
  exit 1
fi
echo "✓ every Markdown file is American English"
