#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

node scripts/sync-tivo-data.js

if git diff --quiet -- tivo-shows.json; then
  echo "No TiVo show changes to publish."
  exit 0
fi

git add tivo-shows.json
git commit -m "Update TiVo show snapshot"
git push
