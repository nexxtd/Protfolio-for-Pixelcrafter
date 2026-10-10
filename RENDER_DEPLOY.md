# Connect to Render hosting — step by step

This folder (`portfolio-site/`) is a complete standalone website. You will push it as its own repo, then connect that repo to Render.

## 1. Create a Postgres database (for persistent admin edits)

Admin changes must live in a real database — Render's file system is wiped on every restart/redeploy.

Option A — Render Postgres (easiest):
1. Go to https://dashboard.render.com → New → PostgreSQL → Free plan → Create.
2. Copy the **Internal Database URL** (starts with `postgresql://`).

Option B — Supabase (what your other project uses):
1. Supabase dashboard → your project → Settings → Database → Connection string (URI).
2. Use the pooler URL on port 6543 if the direct one fails on Render free.

## 2. Push this folder to GitHub as its own repo

```bash
cd portfolio-site
git init
git add .
git commit -m "pixeclcraffter portfolio"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/pixeclcraffter-portfolio.git
git push -u origin main
```

## 3. Create the Web Service on Render

1. https://dashboard.render.com → New → Web Service → select your new repo.
2. Settings:
   - Environment: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free
3. Environment variables (Render → your service → Environment):
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = click **Generate** (long random string)
   - `ADMIN_PASSWORD` = your chosen admin password (e.g. `Pixel2026!Admin`)
   - `DATABASE_URL` = paste from step 1
4. Click **Deploy**.

First boot creates the tables and seeds your default content automatically. Check `/api/health` — `{"ok":true}` means live.

## 4. Use your admin page

- Open `https://YOUR-SERVICE.onrender.com/admin.html`
- Log in with your `ADMIN_PASSWORD`.
- Edit everything: name, bio, comp card, photos (upload under 4MB each), gallery, projects, services, testimonials, inbox, colors.
- Click **Save** — changes are live instantly on the public site.

## Notes

- Without `DATABASE_URL` the site still runs (file mode) but edits are lost on restart. Always set it in production.
- Images are stored as data URLs inside the database (no extra storage service needed). Keep each under 4MB.
- Free Render services sleep after inactivity — first load can take ~30s. That's normal.
- Your admin session lasts 7 days per login.
