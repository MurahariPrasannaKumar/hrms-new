# Deploying EduSphere: Vercel (frontend) + Render (backend)

Order matters: **Render database → Render backend → Vercel frontend → point the backend at the frontend URL.**

## 1. Render: PostgreSQL

1. Render dashboard → **New → PostgreSQL**. Pick a region (use the same one for the backend) and a plan.
2. When it is ready, copy two URLs from its page:
   - **Internal Database URL**: use this as `DATABASE_URL` on the backend service.
   - **External Database URL**: only for the one-time seed in step 4.

## 2. Render: backend (Web Service)

1. **New → Web Service** → connect the Git repository.
2. Settings:
   | Setting | Value |
   |---|---|
   | Root Directory | `backend` |
   | Runtime | **Docker** (uses `backend/Dockerfile`) |
   | Health Check Path | `/health` |
   | Region | same as the database |
3. Environment variables (Render sets `PORT` itself):

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | the **Internal** database URL |
   | `JWT_ACCESS_SECRET` | random string, 32+ chars |
   | `JWT_REFRESH_SECRET` | a different random string |
   | `CORS_ORIGIN` | `https://<your-app>.vercel.app` (no trailing slash; comma-separate several origins) |
   | `FRONTEND_URL` | `https://<your-app>.vercel.app` (used for links in emails) |
   | `COOKIE_SAMESITE` | `none` (needed while frontend and API are on different sites) |
   | `STORAGE_PROVIDER` | `local` |
   | `AI_PROVIDER` | `mock` (or add the provider key) |
   | `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | your SMTP details (Gmail needs an App Password) |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | the first super admin account |
   | `SEED_DEMO_DATA` | `false` |

   Generate secrets with:
   `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
4. Deploy. On start the container runs `prisma migrate deploy` (creates all tables) and then the API.
5. Check `https://<service>.onrender.com/health` returns `{"status":"ok"}`. API docs are at `/api/docs`.

### One-time: create the super admin

The container does not run the seed. Run it once from your computer against the **External** database URL
(append `?sslmode=require` if the connection is refused). In `backend/`, PowerShell:

```powershell
$env:DATABASE_URL = "<external database url>?sslmode=require"
$env:ADMIN_EMAIL = "you@example.com"
$env:ADMIN_PASSWORD = "a-strong-password"
npm run prisma:seed
```

This creates the roles, permissions, modules and the super admin. Leave `SEED_DEMO_DATA` unset so no demo data is loaded.

## 3. Vercel: frontend

1. **Add New → Project** → import the repository.
2. Settings:
   | Setting | Value |
   |---|---|
   | Root Directory | `frontend` |
   | Framework Preset | Next.js (auto-detected) |
   | Build / Install commands | defaults |
3. Environment variable (Production and Preview):
   - `NEXT_PUBLIC_API_URL` = `https://<service>.onrender.com/api/v1`

   It is baked in at build time, so changing it later needs a **redeploy**.
4. Deploy and copy the URL Vercel gives you.

## 4. Connect them

1. Back on Render, set `CORS_ORIGIN` and `FRONTEND_URL` to the real Vercel URL and let the service redeploy.
2. Open the Vercel URL, sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, create a school, then a school admin.

## Things to know

- **Cookies across sites.** `*.vercel.app` and `*.onrender.com` are different sites, so the login refresh cookie is
  cross-site. `COOKIE_SAMESITE=none` makes this work in Chrome, Edge and Firefox, but **Safari and browsers that block
  third-party cookies will sign users out on reload.** The reliable fix is custom domains on the same parent domain
  (for example `app.yourschool.com` on Vercel and `api.yourschool.com` on Render). Then set `COOKIE_SAMESITE=lax`
  and use those domains in `CORS_ORIGIN`, `FRONTEND_URL` and `NEXT_PUBLIC_API_URL`.
- **Uploaded files.** Assignment attachments are stored on the server's disk (`STORAGE_PROVIDER=local`). Render's
  filesystem is wiped on every deploy or restart unless you attach a paid **Disk**, and the S3 provider is not
  implemented yet. Until then, treat uploads as temporary on Render.
- **Free tier cold starts.** Free Render services sleep after ~15 minutes idle and take about a minute to wake, so the
  first request after a pause can fail or be slow. Use a paid instance for real use.
- **Preview deployments** on Vercel get different URLs; add them to `CORS_ORIGIN` (comma-separated) if you need them to
  talk to the backend.
- **Email links** use `FRONTEND_URL`; if it is wrong, the buttons in emails point to the wrong place.
- **Keep secrets out of Git.** `.env` files are ignored; only the `.env.example` templates are committed.
