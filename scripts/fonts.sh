#!/usr/bin/env bash
# Regenerates the subset webfonts from the original files.
# Only needed if you add glyphs (accents beyond Latin-1, new symbols) or weights.
#   pip install fonttools brotli
set -euo pipefail
SRC="${1:?usage: fonts.sh /path/to/original/fonts}"
OUT="src/assets/fonts"
RANGES="U+0020-007F,U+00A0-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191-2199,U+2212,U+2215,U+FEFF,U+FFFD"
mkdir -p "$OUT"

pyftsubset "$SRC/DrukWideBold.ttf" --output-file="$OUT/druk-wide-bold.woff2" \
  --flavor=woff2 --unicodes="$RANGES" --layout-features='kern,liga,calt' --desubroutinize

for pair in Regular:400 Medium:500 Bold:700; do
  name="${pair%%:*}"; weight="${pair##*:}"
  pyftsubset "$SRC/HelveticaNowText-$name.woff2" --output-file="$OUT/helvetica-now-text-$weight.woff2" \
    --flavor=woff2 --unicodes="$RANGES" --layout-features='kern,liga,calt'
done

ls -la "$OUT"
