# RunTrack Pro

A personal running analytics web app. Import TCX workout files manually and view running history, pace, distance, heart rate, splits and performance trends.

## Deploy with GitHub Pages

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. The workflow deploys the site whenever you push to `main`.
4. Site: https://iAmaaan.github.io/runtrack-pro/

## Manual TCX import + shared cloud

- Open RunTrack Pro. No login, account, password, OTP or sync code is needed.
- Choose **Import activity** and select one or more `.tcx` files.
- TCX files are parsed in your browser. The resulting activity data is automatically saved to the shared Supabase cloud database.
- Open the same website on another phone or computer to see the same running history.
- A local browser copy is also kept as a cache. Use **Backup** to download a JSON backup and **Restore backup** to restore it.
- The app uses one shared dataset. Anyone who can access the public website can read and change the shared activities. Do not use this setup for sensitive information.
- Keep periodic JSON backups. An internet connection is required to load or save the shared cloud copy.

## Privacy and access

RunTrack Pro has no Google login, Google Health/Fitbit connection, or user authentication. Cloud access is intentionally open to visitors of the public website. The Supabase service-role key stays inside the server-side Edge Function and is never included in the website.
