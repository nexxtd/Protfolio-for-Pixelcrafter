# pixeclcraffter — Model & Project Manager Portfolio

Public portfolio + editable admin panel. Render-ready.

- Public site: `/`
- Admin editor: `/admin.html`
- Health: `/api/health`
- Content API: `GET /api/content`

## Run locally

```bash
cd portfolio-site
npm install
cp .env.example .env
npm start
# open http://localhost:10000  (admin: http://localhost:10000/admin.html, default password admin123)
```

## Edit content

All editing happens in the admin page — no code needed:
Profile, hero/about photos, stats, modeling gallery, PM projects, services, testimonials, inbox, accent color, announcement bar.

## Deploy to Render (see RENDER_DEPLOY.md)

1. Push this folder as its own GitHub repo.
2. Render → New → Web Service → connect repo.
3. Build: `npm install`, Start: `npm start`.
4. Env: `JWT_SECRET` (generate), `ADMIN_PASSWORD` (your password), `DATABASE_URL` (Render Postgres or Supabase).
