# TiVo Shows

Read-only public GitHub Pages mirror of a local TiVo show list. The site loads a checked-in JSON snapshot and renders the current recordings in the browser.

## Published Page

```text
https://numerate64.github.io/tivo/
```

## Files

- `index.html` - app shell.
- `styles.css` - responsive table/list styling.
- `app.js` - rendering and search/filter behavior.
- `tivo-shows.json` - published show data snapshot.
- `scripts/sync-tivo-data.js` - local data sync helper.
- `scripts/publish-tivo-pages.sh` - publish helper used by the OpenClaw host.

## Data Flow

A local scheduled job on the OpenClaw host refreshes the private TiVo API snapshot, updates `tivo-shows.json`, and pushes changes to GitHub. The public page only reads the static JSON file in this repository.

## Local Preview

Serve the folder so the JSON fetch works consistently:

```sh
python3 -m http.server 8000
```

## Privacy Note

Only the checked-in `tivo-shows.json` data is public. Private API access stays on the local host that runs the sync.
