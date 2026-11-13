# RunTrack Pro

A personal running analytics web app. Upload your TCX workout files manually to view running history, pace, distance, heart rate, splits and performance trends.

## Deploy free with GitHub Pages

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. The workflow deploys the site whenever you push to `main`.
4. Site: https://iAmaaan.github.io/runtrack-pro/

## Manual TCX import and local data

- Choose **Import activity** and select one or more `.tcx` files.
- TCX files are parsed in your browser; they are not uploaded to a server.
- Activities and profile settings are stored in that browser's local storage.
- To use another phone or computer, open the same public website and import your TCX files there too.
- Use **Backup** to download a JSON copy of your RunTrack data. Use **Restore backup** to load it in another browser.
- Clearing browser site data or changing browser profiles can remove locally stored activities. Keep regular backups.

The repository and published website are public. Do not commit TCX activity files, backups, or private information.

## Privacy

RunTrack Pro currently has no Google login, Google Health/Fitbit connection, or cloud sync. Your uploaded TCX data stays in the browser where you imported it.
