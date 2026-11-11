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

## Google Health API (Fitbit Air) connection

The Google Health connection uses a Supabase Edge Function. It imports reconciled workout sessions into RunTrack Pro; the first release imports up to 250 workouts from the previous 2 years when you click **Import Fitbit workouts**. Repeated imports are deduplicated. This first release imports workout summaries only; GPS routes and detailed heart-rate time series are not requested.

### One-time Google Cloud setup

1. Open the [Google Health API setup guide](https://developers.google.com/health/setup), select or create a Google Cloud project, enable Google Health API, and create a **Web application** OAuth client.
2. Add this exact authorized redirect URI to the OAuth client:
   `https://vetmhkrempjtwuojupfr.supabase.co/functions/v1/google-health`
3. Configure the OAuth consent screen as External. While testing, add the Google account you use with Google Health as a test user.
4. In Data Access, allow the scope `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`. This is the only scope requested by the first release.

### Supabase Edge Function secrets

Open [Supabase Edge Function Secrets](https://supabase.com/dashboard/project/vetmhkrempjtwuojupfr/functions/secrets) and add:

- `GOOGLE_CLIENT_ID` — OAuth client ID from Google Cloud.
- `GOOGLE_CLIENT_SECRET` — OAuth client secret from Google Cloud. Never put this in the website or Git.
- `GOOGLE_REDIRECT_URI` — `https://vetmhkrempjtwuojupfr.supabase.co/functions/v1/google-health`
- `GOOGLE_TOKEN_ENCRYPTION_KEY` — base64 encoding of 32 cryptographically random bytes. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Keep this secret and back it up securely; losing it makes stored refresh tokens unreadable.
- `RUNTRACK_APP_URL` — `https://iamaaan.github.io/runtrack-pro/`

Supabase injects its project URL and service-role key into Edge Functions. Never copy a Supabase secret/service-role key into the public website or GitHub.

### Connect and import

1. Open RunTrack Pro on the same browser that has your private RunTrack cloud sync code.
2. Go to **Settings → Google Health · Fitbit → Connect Google Health**.
3. Approve the activity and fitness permission.
4. Return to RunTrack Pro and click **Import Fitbit workouts**. Imported workouts are added without replacing local activities and are synced to RunTrack cloud if private cloud sync is connected.

Google Health must already be linked to the same Google Account in the Google Health mobile app. Google OAuth testing-mode refresh tokens expire after 7 days; move the OAuth app through Google's required review/publishing process before relying on long-term production access. Google Health API scopes are restricted and production access may require a security/privacy review.

Disconnecting Google removes the saved encrypted refresh token and attempts to revoke it at Google. Already-imported RunTrack activities remain.

