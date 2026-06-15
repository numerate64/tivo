# TiVo Shows

Read-only public GitHub Pages mirror of the local TiVo show list.

Published at:

```text
https://numerate64.github.io/tivo/
```

The static site reads `tivo-shows.json`. A local cron job on the OpenClaw host runs
`scripts/publish-tivo-pages.sh` every 30 minutes to refresh the private TiVo API
snapshot and push changed data to GitHub.
