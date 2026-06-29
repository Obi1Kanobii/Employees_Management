# Time Tracker

Employee timesheet app built with Next.js and Supabase.

## For employees

1. Open the app URL your admin shared (e.g. `https://your-app.vercel.app`)
2. Click **Sign up** and create an account with your work email
3. Log your hours for the week and click **Submit for the Week**
4. Wait for admin approval

## For admins

1. Promote a user to admin in Supabase SQL Editor:

```sql
UPDATE profiles SET role = 'admin' WHERE id = 'user-uuid-here';
```

2. Sign out and sign back in to access `/admin/dashboard`
3. Approve/reject timesheets and export payroll CSV

## Local development

```bash
npm install
cp env.example .env.local   # add your Supabase keys
npm run dev
```

Run `supabase/schema.sql` in the Supabase SQL Editor on first setup.

## Deploy with GitHub Actions + Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Add time tracker app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/time-tracker.git
git push -u origin main
```

### 2. Create a Vercel project

1. Go to [vercel.com](https://vercel.com) and import your GitHub repo
2. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy once manually, then note your **Project ID** and **Org ID** from Vercel project settings

### 3. Add GitHub repository secrets

In GitHub → **Settings → Secrets and variables → Actions**, add:

| Secret | Where to find it |
|--------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel project settings |
| `VERCEL_PROJECT_ID` | Vercel project settings |

### 4. Configure Supabase auth for production

In Supabase → **Authentication → URL Configuration**, add:

- **Site URL:** `https://your-app.vercel.app`
- **Redirect URLs:** `https://your-app.vercel.app/auth/callback`

Every push to `main` runs CI and deploys to Vercel automatically.

## Share with employees

Send them:

- The live app URL
- A short note to sign up with their email and submit weekly timesheets
