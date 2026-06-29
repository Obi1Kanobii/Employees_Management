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

### 2. Delete the stuck `deploy-pages` workflow

If Actions runs `actions/deploy-pages@v5` and stays on `deployment_queued`:

1. GitHub → **Actions** → click the workflow on the left (e.g. "Deploy Next.js site to Pages")
2. **⋯** → **Delete workflow**

This repo uses the **`docs/` folder** — not `deploy-pages`.

### 3. Enable GitHub Pages (one-time)

1. Wait for **Deploy to GitHub Pages** to finish
2. **Settings → Pages**
3. **Source:** Deploy from a branch (**NOT** "GitHub Actions")
4. **Branch:** `main` → **`/docs`** → **Save**
5. Open: **https://obi1kanobii.github.io/Employees_Management/**

### 4. Add GitHub secrets

**Settings → Secrets and variables → Actions:**

| Secret | Value |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |

### 5. Configure Supabase auth URLs

- **Site URL:** `https://obi1kanobii.github.io/Employees_Management/`
- **Redirect URLs:** `https://obi1kanobii.github.io/Employees_Management/auth/callback`

### 6. Share with employees

Send them the GitHub Pages URL and ask them to sign up and submit weekly timesheets.

## Custom domain (optional)

GitHub repo → **Settings → Pages → Custom domain** to use your own domain (e.g. `timesheets.yourcompany.com`).
