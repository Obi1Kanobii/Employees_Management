# Time Tracker

Employee timesheet app built with Next.js and Supabase, hosted on **GitHub Pages**.

## Live URL

After deployment: `https://YOUR_USERNAME.github.io/REPO_NAME/`

Example: `https://obi1kanobii.github.io/Employees_Management/`

## For employees

1. Open the app URL your admin shared
2. Click **Sign up** and create an account with your work email
3. Log your hours for the week and click **Submit for the Week**
4. Wait for admin approval

## For admins

Promote a user to admin in Supabase SQL Editor:

```sql
UPDATE profiles SET role = 'admin' WHERE id = 'user-uuid-here';
```

Sign out and sign back in to access the admin dashboard.

## Local development

```bash
npm install
cp env.example .env.local   # add your Supabase keys
npm run dev
```

Run `supabase/schema.sql` in the Supabase SQL Editor on first setup.

If you already have a database, also run `supabase/add-clients.sql` to add client tracking.

For Google Calendar sync, run `supabase/add-calendar-sync.sql` and follow [Google Calendar setup](#google-calendar-sync) below.

## Google Calendar sync

Sync shift hours from your **משמרות** Google Calendar into employee timesheets. Each calendar event title should be the employee name (e.g. `אלעד`, `יובל`).

### Easiest setup: iCal link (no JSON, no OAuth)

This is the simplest option — no service account, no Google Cloud credentials.

1. Open Google Calendar → **משמרות** → **Settings and sharing**
2. Scroll to **Integrate calendar**
3. Copy the **Secret address in iCal format** (starts with `https://calendar.google.com/calendar/ical/...`)
4. Deploy the Edge Function and add one secret:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy sync-calendar
```

| Secret | Value |
|--------|--------|
| `GOOGLE_CALENDAR_ICAL_URL` | The secret iCal URL you copied |

5. Run `supabase/add-calendar-sync.sql` in the SQL Editor
6. Log in as admin → click **Sync from Calendar**

Treat the iCal URL like a password — anyone with the link can read your calendar.

---

### Alternative: OAuth (if you prefer the official API)

<details>
<summary>OAuth setup (no JSON key needed)</summary>

1. Enable **Google Calendar API** in Google Cloud
2. Create an **OAuth client ID** (Desktop app) — not a service account key
3. Get a refresh token via [Google OAuth Playground](https://developers.google.com/oauthplayground) with scope `https://www.googleapis.com/auth/calendar.readonly`
4. Set these Supabase secrets:

| Secret | Value |
|--------|--------|
| `GOOGLE_CALENDAR_ID` | Calendar ID from calendar settings |
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | Refresh token from OAuth Playground |

</details>

### Sync shifts

1. Log in as admin and open the admin dashboard.
2. Click **Sync from Calendar**.
3. Shifts from the last 4 weeks (+ 1 week ahead) are imported into pending timesheets. Approved timesheets are not overwritten.

Event titles are matched to employees by name: `אלעד` / `Elad` → elad@betterai360.com, `יובל` / `Yuval` → yuval@betterai360.com. To add more aliases, update `calendar_aliases` on the employee's profile in SQL.

## Deploy to GitHub Pages

### 1. Push to GitHub

```bash
git push origin main
```

### 2. Enable GitHub Pages (one-time)

1. **Settings → Pages**
2. **Source:** **GitHub Actions** (not "Deploy from a branch")
3. Push to `main` — the **Deploy to GitHub Pages** workflow builds `out/` and publishes via `deploy-pages`
4. Open: **https://obi1kanobii.github.io/Employees_Management/**

If you previously used **main → /docs** or **gh-pages** branch, switch the source to **GitHub Actions** so the old `pages build and deployment` workflow stops looking for a `docs/` folder.

### 3. Add GitHub secrets (required)

Copy the same values from your local `.env.local`. **Without these secrets, the live site cannot connect to Supabase.**

| Secret | Value |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key |

Use **either** option (not both required):

1. **Repository secrets (simplest):** Settings → Secrets and variables → Actions → **Repository secrets** → New repository secret
2. **Environment secrets:** Settings → Environments → create or open **`env`** → add both secrets there (the deploy workflow uses `environment: env`)

After adding secrets, go to **Actions → Deploy to GitHub Pages → Run workflow** to redeploy.

### 4. Configure Supabase auth URLs

- **Site URL:** `https://obi1kanobii.github.io/Employees_Management/`
- **Redirect URLs:** `https://obi1kanobii.github.io/Employees_Management/auth/callback`

### 5. Share with employees

Send them the GitHub Pages URL and ask them to sign up and submit weekly timesheets.

## Custom domain (optional)

GitHub repo → **Settings → Pages → Custom domain** to use your own domain (e.g. `timesheets.yourcompany.com`).
