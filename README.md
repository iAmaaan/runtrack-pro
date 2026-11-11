# RunTrack Pro

A personal running analytics web app. Upload Fitbit/Google Fit TCX files to view your training history and performance.

## Deploy free with GitHub Pages

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. The workflow deploys the site whenever you push to `main`.
4. Site: https://iAmaaan.github.io/runtrack-pro/

## Local data and private cloud sync

- TCX files are parsed in your browser.
- Without cloud sync, activities and profile settings stay in that browser's local storage.
- To sync devices without an email/password login, open **Data & profile → Private cloud sync**.
- On your first device choose **Create new code**, then copy and keep the code private.
- On each additional device paste the same code and choose **Connect this device**.
- Use **Sync now** to manually sync. Changes are also synced automatically after local updates when connected.
- Before the first sync, open the Supabase project SQL Editor and run the complete `supabase-sync-schema.sql` file from this repository.
- The sync code is a bearer credential: anyone who has it can read or change the synced running data. Keep it private. The database stores only a SHA-256 hash of the code.
- Download regular JSON backups as an additional safety measure.

The repository and published website are public. Do not commit TCX activity files, backups, sync codes, service-role keys, or private information.
