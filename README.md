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

## Deploy to GitHub Pages

### 1. Push to GitHub

```bash
git push origin main
```

### 2. Enable GitHub Pages (one-time)

1. Wait for **Deploy to GitHub Pages** to finish (pushes to the `gh-pages` branch)
2. **Settings → Pages**
3. **Source:** Deploy from a branch (**NOT** "GitHub Actions")
4. **Branch:** `gh-pages` → **`/ (root)`** → **Save**
5. Open: **https://obi1kanobii.github.io/Employees_Management/**

If you previously used `main` → `/docs`, switch to `gh-pages` → `/ (root)` so `_next/` static assets are served (Jekyll strips underscore folders from `/docs` deploys).

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
