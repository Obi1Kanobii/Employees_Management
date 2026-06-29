# Time Tracker

Employee timesheet app built with Next.js and Supabase, hosted on **GitHub Pages**.

## Live URL

After deployment: `https://YOUR_USERNAME.github.io/REPO_NAME/`

Example: `https://johndoe.github.io/emplyees/`

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
git add .
git commit -m "Deploy to GitHub Pages"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/emplyees.git
git push -u origin main
```

### 2. Enable GitHub Pages (one-time)

1. Push to `main` and wait for **Deploy to GitHub Pages** to finish
2. Open **Settings → Pages**
3. Set **Source:** Deploy from a branch
4. Set **Branch:** `main` → folder **`/docs`** → **Save**
5. Wait 1–2 minutes, then open:

   **`https://YOUR_USERNAME.github.io/REPO_NAME/`**

   Example: `https://obi1kanobii.github.io/Employees_Management-/`

If you previously used the `gh-pages` branch or GitHub Actions as the source, switch to **`main` / `docs`** as above.

### 3. Add GitHub secrets

**Settings → Secrets and variables → Actions:**

| Secret | Value |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |

### 4. Configure Supabase auth URLs

Replace `YOUR_USERNAME` and `REPO_NAME` with your values:

- **Site URL:** `https://YOUR_USERNAME.github.io/REPO_NAME/`
- **Redirect URLs:** `https://YOUR_USERNAME.github.io/REPO_NAME/auth/callback`

### 5. Share with employees

Send them the GitHub Pages URL and ask them to sign up and submit weekly timesheets.

## Custom domain (optional)

GitHub repo → **Settings → Pages → Custom domain** to use your own domain (e.g. `timesheets.yourcompany.com`).
