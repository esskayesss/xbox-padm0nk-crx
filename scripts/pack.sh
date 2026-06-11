#!/usr/bin/env bash
# Build a Chrome Web Store / Edge Add-ons upload zip with only runtime files.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -e "process.stdout.write(require('./manifest.json').version)")
OUT="dist/padm0nk-${VERSION}.zip"

rm -f "$OUT"
mkdir -p dist

# Runtime files only — exclude docs, source PNG, git, scripts, dist, dotfiles.
zip -r -q "$OUT" \
	manifest.json \
	src \
	popup \
	options \
	icons/icon-16.png \
	icons/icon-32.png \
	icons/icon-48.png \
	icons/icon-128.png \
	icons/padm0nk.png \
	-x "*.DS_Store"

echo "Packaged $OUT"
unzip -l "$OUT"
