#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

node scripts/sync-tivo-data.js

if git diff --quiet -- tivo-shows.json tivo-upcoming.json; then
  echo "No TiVo snapshot changes to publish."
  exit 0
fi

git add tivo-shows.json tivo-upcoming.json
git commit -m "Update TiVo snapshots"
git push
