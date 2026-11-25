# BV Mining Solution HR App

Static HR, shift, attendance, leave, accounting, and stock management app. No build step is required.

## Structure

```text
.
├── index.html                 # Dashboard (login protected)
├── 404.html                   # Friendly missing-page and restricted-access page
├── login.html                 # Supabase Auth sign-in
├── attendance.html
├── accounting.html             # Finance, balances, payroll, and payslips
├── admin-users.html           # Admin-only account creation
├── employee-records.html
├── employees-data.html
├── leave.html
├── ppe-issue-records.html
├── ppe-stock.html
├── reports.html
├── samaan-issue.html          # Stock Management issue form
├── shift-dashboard.html
├── assets/css/                # Per-page stylesheets
├── assets/js/                 # Page scripts, Supabase client and config
├── database/                  # Supabase schemas and setup instructions
├── supabase/functions/         # Server-side Supabase Edge Functions
├── netlify.toml
└── .nojekyll
```

## Supabase setup

Run the SQL files and deploy the admin account-creation Edge Function as explained in [database/supabase-setup.md](database/supabase-setup.md). Create the first Auth user and promote it to `admin`. The app's project URL and browser-safe public key are in `assets/js/supabase-config.js`.

## Run locally

From the project root:

```bash
python -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). Supabase Auth redirect URLs must include your local URL during development.

## Deploy

### GitHub Pages

Upload the full project contents to a repository. In **Settings → Pages**, select **Deploy from a branch**, choose `main` and `/ (root)`. `index.html` is the entry page and `404.html` handles unknown URLs. Keep links relative; do not upload just the HTML files.

### Netlify

Import the repository or deploy the folder. Leave the build command empty and set the publish directory to `.`; `netlify.toml` includes that setting.

## Notes

- Pages sign in through Supabase Auth and load/save records in Supabase tables protected by RLS.
- The `anon`/publishable key is designed for browser use; never put a database password, `service_role`, or secret key in frontend code.
- Existing records stored in a browser's old `localStorage` are not imported automatically. Export/migrate them before switching to the database.
