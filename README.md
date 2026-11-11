# RunTrack Pro

A personal running analytics web app. Upload Fitbit/Google Fit TCX files to view your training history and performance.

## Deploy free with GitHub Pages

This repository includes a GitHub Actions workflow that deploys the website whenever you push to `main`.

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. The workflow will deploy the site. Check the **Actions** tab for its status.
4. Your site address will be: https://iAmaaan.github.io/runtrack-pro/

## Data and privacy

TCX files are parsed inside your browser. Activities and profile settings are stored in that browser's local storage and are not uploaded to GitHub or a cloud database. Data does not automatically sync between devices or browsers. Use **Data & settings → Download backup** regularly and restore that backup on another device when needed.

The repository and published website are public. Do not commit TCX activity files, backups, credentials, or private information.
