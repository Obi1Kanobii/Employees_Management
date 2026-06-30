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
