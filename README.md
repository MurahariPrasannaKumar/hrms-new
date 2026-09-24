# EduSphere: School / Education Partner Management Platform

A multi-tenant education SaaS. Platform administrators manage schools; school administrators, teachers, students, parents and staff each get a permission-aware workspace (academics, attendance, digital diary, noticeboard, learning, AI helpers and more). Every school's data is isolated.

## Architecture

```
 Browser
   |
 Next.js 16 (App Router, React 19)      frontend/   - UI only, no business logic
   |  axios API client (Bearer access token + HTTP-only refresh cookie)
   v
 Express REST API  /api/v1              backend/
   |  routes -> controllers -> services -> repositories
   |  middleware: helmet, CORS, rate limit, requireAuth, requireRole,
   |              requirePermission, tenant resolution, Zod validation
   v
 Prisma ORM
   v
 PostgreSQL                             backend/prisma (schema + migrations + seed)
```

The frontend never talks to PostgreSQL. All data access goes through the API, and authorization is enforced on the server. The UI only hides what a user cannot use.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui (Base UI), Lucide, React Hook Form + Zod, TanStack Query, Axios, Recharts, Framer Motion |
| Backend | Node.js, Express 4, TypeScript, Zod, JWT (access + rotating refresh tokens), argon2, Helmet, CORS, express-rate-limit, Pino, Swagger UI, Multer |
| Database | PostgreSQL 16, Prisma 6 |
| Tests | Vitest + Supertest (backend), Vitest + React Testing Library (frontend) |
| Infra | Docker, Docker Compose |

## Folder structure

```
.
|-- backend/
|   |-- prisma/               schema.prisma, migrations/, seed.ts
|   |-- src/
|   |   |-- config/           env.ts (validated), database.ts, logger.ts, permissions.ts (roles, permissions, modules)
|   |   |-- middlewares/      auth (requireAuth/requireRole/requirePermission), tenant, validate, error
|   |   |-- modules/          auth, users, schools, students, teachers, academics, attendance, diary,
|   |   |                     notices, notifications, security, learning, files, ai, dashboard,
|   |   |                     modules, search, reports   (each: routes / controller / service / repository / validation)
|   |   |-- docs/openapi.ts   OpenAPI 3 document served at /api/docs
|   |   |-- utils/            ApiError, response helpers, pagination, audit, csv, crypto
|   |   |-- app.ts  server.ts  routes.ts
|   |-- tests/                Supertest integration tests (run against a real database)
|   `-- Dockerfile
|-- frontend/
|   |-- app/                  admin/, school/, teacher/, student/, parent/, staff/, login, ...
|   |-- components/           ui/, layout/, navigation/, dashboard/, tables/, forms/, feedback/
|   |-- lib/                  api/ (client + services), auth/, permissions/, utils/
|   |-- hooks/  schemas/  tests/
|   `-- Dockerfile
|-- docker-compose.yml
`-- .env.example
```

## Environment setup

Backend (`backend/.env`, copy from `backend/.env.example`):

| Variable | Purpose |
|---|---|
| `PORT`, `NODE_ENV` | Server port and mode |
| `DATABASE_URL` | PostgreSQL connection string (URL-encode special characters in the password) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | At least 16 characters (use 48+ random characters in production) |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | For example `15m`, `7d` |
| `CORS_ORIGIN` | Comma-separated allowed origins |
| `STORAGE_PROVIDER`, `UPLOAD_DIR` | `local` today; `s3` is a stub |
| `AI_PROVIDER` | `mock` (default), `openai`, `gemini`, `claude` |
| `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` | Only needed for a real AI provider |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The SUPER_ADMIN account the seed creates/updates (must satisfy the password rules: 8+ chars, upper, lower, digit) |
| `SEED_DEMO_DATA` | `true` loads demo schools/users (development only; default off) |
| `SEED_DEMO_PASSWORD` | Password given to demo accounts when `SEED_DEMO_DATA=true` |
| `TEST_DATABASE_URL` | Separate database used only by `npm test`; it is migrated and demo-seeded automatically |

Frontend (`frontend/.env.local`, copy from `frontend/.env.example`): `NEXT_PUBLIC_API_URL` (default `http://localhost:4000/api/v1`).

Docker Compose reads the root `.env` (copy from `.env.example`). `.env` files are git-ignored. Never commit real secrets.

## Database setup

```bash
cd backend
npm install
cp .env.example .env            # then edit DATABASE_URL and the JWT secrets
npx prisma generate
npx prisma migrate dev          # creates/updates the schema (use `migrate deploy` in production)
npx prisma db seed              # roles, permissions, modules and the ADMIN_EMAIL admin (demo data only if SEED_DEMO_DATA=true)
npx prisma studio               # optional GUI
```

Never run `migrate reset` on a database whose data you care about.

On Windows, `start-all.bat` in the repository root does all of this on every start: it starts PostgreSQL, applies pending migrations (`prisma migrate deploy`), runs the seed, then launches the API (:4000) and web app (:3000).

## Development commands

```bash
# Backend (http://localhost:4000)
cd backend
npm run dev          # tsx watch
npm run typecheck
npm test             # vitest + supertest against TEST_DATABASE_URL (auto-migrated and demo-seeded; never touches DATABASE_URL)
npm run build && npm start

# Frontend (http://localhost:3000)
cd frontend
npm install
npm run dev
npm run build
npm run lint
npm test
```

## API documentation

Interactive Swagger UI at `http://localhost:4000/api/docs`. The raw OpenAPI JSON is at `/api/docs.json`. All endpoints live under `/api/v1`.

Response envelope:

```jsonc
{ "success": true,  "data": {}, "message": "Success", "meta": { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid request", "details": [] } }
```

Lists are server-side paginated, searchable and sortable (`page`, `pageSize`, `search`, `sortBy`, `sortOrder`).

## First login and onboarding

The database starts empty (apart from roles, permissions and module definitions). The seed creates one platform admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env`; the password is re-synced on every seed run. Everything else is created through the app, so what you see always comes from the database:

1. Sign in as the admin (SUPER_ADMIN) and open **Schools** to create a school.
2. Open **Users** and create a `SCHOOL_ADMIN` for that school. Creating a `TEACHER`, `STUDENT`, `PARENT` or `STAFF` user also creates the matching profile row automatically.
3. The school admin signs in and creates an academic year, then classes and sections, then subjects (**Academics**).
4. Assign the student to a class and section and link a parent (**Students**). Assign the teacher's subjects and classes (**Teachers**).
5. Teachers can now mark attendance and post diary entries for their assigned classes; notices, courses and resources follow the same pattern.

### Optional demo data (development only)

Set `SEED_DEMO_DATA=true` before seeding to load two demo schools with users, students, attendance, notices and courses. The password for every demo account is `SEED_DEMO_PASSWORD` (default `password`). It is off by default and must never be enabled in production.

| Email | Role | School |
|---|---|---|
| `superadmin@example.com` | SUPER_ADMIN | platform |
| `admin@schoolone.com` | SCHOOL_ADMIN | Greenfield Public School |
| `teacher@schoolone.com` | TEACHER | Greenfield Public School |
| `student@schoolone.com` | STUDENT | Greenfield Public School |
| `parent@schoolone.com` | PARENT | Greenfield Public School |
| `staff@schoolone.com` | STAFF | Greenfield Public School |
| `admin@schooltwo.com` | SCHOOL_ADMIN | Riverside International Academy |

School two follows the same pattern (`teacher@`, `student@`, `parent@`, `staff@schooltwo.com`). Greenfield has Instasolve disabled and Riverside has V Buddy disabled, to demonstrate per-school module toggles.

## RBAC

Roles: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, `STUDENT`, `PARENT`, `STAFF`. Permissions are `resource.action` keys stored in the `Permission` / `RolePermission` tables and seeded from `backend/src/config/permissions.ts`. STAFF permissions are configurable per user through `UserPermission` (`extraPermissions` on the users API).

Enforcement on the server:

- `requireAuth` verifies the access token, checks the session has not been revoked, and loads the current user, role and permissions from the database on every request, so deactivation and permission changes take effect immediately.
- `requireRole(...)` and `requirePermission(...)` guard routes.
- Row-level rules sit on top: teachers see only their assigned sections, parents only their children, students only themselves.

The frontend reads `permissions` and `modules` from the login/`/auth/me` response to hide navigation and actions, but it is never the source of truth.

Default permission matrix (generated from `permissions.ts`):

| Permission | Super Admin | School Admin | Teacher | Student | Parent | Staff |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `students.read` | x | x | x |  | x | x |
| `students.create` | x | x |  |  |  |  |
| `students.update` | x | x |  |  |  |  |
| `students.delete` | x | x |  |  |  |  |
| `teachers.read` | x | x |  |  |  |  |
| `teachers.create` | x | x |  |  |  |  |
| `teachers.update` | x | x |  |  |  |  |
| `teachers.delete` | x | x |  |  |  |  |
| `attendance.read` | x | x | x | x | x | x |
| `attendance.create` | x | x | x |  |  |  |
| `attendance.update` | x | x | x |  |  |  |
| `academics.read` | x | x | x | x | x |  |
| `academics.manage` | x | x |  |  |  |  |
| `assignments.read` | x | x | x | x | x |  |
| `assignments.manage` | x | x | x |  |  |  |
| `diary.read` | x | x | x | x | x |  |
| `diary.manage` | x | x | x |  |  |  |
| `notices.read` | x | x | x | x | x | x |
| `notices.create` | x | x |  |  |  |  |
| `notices.update` | x | x |  |  |  |  |
| `notices.delete` | x | x |  |  |  |  |
| `users.read` | x | x |  |  |  |  |
| `users.create` | x | x |  |  |  |  |
| `users.update` | x | x |  |  |  |  |
| `users.delete` | x | x |  |  |  |  |
| `schools.read` | x |  |  |  |  |  |
| `schools.create` | x |  |  |  |  |  |
| `schools.update` | x |  |  |  |  |  |
| `schools.delete` | x |  |  |  |  |  |
| `modules.manage` | x |  |  |  |  |  |
| `learning.read` | x | x | x | x |  |  |
| `learning.manage` | x | x | x |  |  |  |
| `ai.use` | x | x | x | x |  |  |
| `reports.read` | x | x | x |  |  |  |
| `settings.manage` | x | x |  |  |  |  |
| `security.read` | x | x |  |  |  |  |
| `audit_logs.read` | x | x |  |  |  |  |

After changing `permissions.ts`, re-run the seed to sync role permissions.

## Multi-tenancy

- Tenant-owned tables carry a `schoolId`; users belong to one school (`schoolId` is `null` only for SUPER_ADMIN).
- The tenant is derived from the authenticated user (`resolveSchoolId` / `optionalSchoolScope` in `middlewares/tenant.ts`). A `schoolId` supplied by a non-super-admin client is ignored.
- Cross-references (class, section, subject, file, teacher, parent, and so on) are re-checked against the caller's school, and records of another tenant return 404.
- SUPER_ADMIN can target any school by passing `schoolId`.
- Integration tests assert isolation between the two seeded schools.

## Attendance self check-in and progress tracking

**Students** open `/student/attendance` to see their attendance percentage (ring gauge), present/absent/late/excused counts, a month calendar, a 6-month trend and streaks, and can mark themselves present for today. **Parents** see the same view read-only for one linked child. **Teachers** get a daily check-in card at the top of `/teacher/attendance`. **Admins and teachers** track progress under `/school/progress`, `/admin/progress` (school selector) and `/teacher/progress` (assigned students only).

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `POST /attendance/check-in` | STUDENT | Mark the caller present for today; 409 if today already has a record |
| `GET /attendance/me?month=YYYY-MM&studentId=` | STUDENT, PARENT (own children) | Today state, overall %, month days, 6-month trend, streaks |
| `POST /attendance/teacher/check-in` | TEACHER | Teacher checks in for today; 409 if already done |
| `GET /attendance/teacher/me` | TEACHER | Same shape as `/attendance/me` |
| `GET /progress/summary` | admins, teachers | Risk counts, average attendance and exam %, lowest/highest attendance |
| `GET /progress/students`, `/progress/students/:id` | admins, teachers | Progress table (server-side search, class/section/risk filters, sort, pagination) and per-student detail |
| `GET /progress/teachers`, `/progress/teachers/:id` | SUPER_ADMIN, SCHOOL_ADMIN | Teacher activity table and detail |

Rules:

- **Percentage** = (PRESENT + LATE) / all recorded days. ABSENT and EXCUSED count against it. Ring colours: 90% or more good, 75-90% watch, under 75% at risk.
- **Check-in** always applies to the caller (the student is resolved from the token, never from the request) and to "today" in the school's timezone (`SchoolSetting.timezone`). It creates the section's attendance row if needed and a record with `source = SELF`. If a record already exists for today the API answers 409, so students cannot overwrite a teacher's mark.
- **Teacher override:** saving the roster (`POST /attendance`) always wins. It replaces the status and sets `source = TEACHER`.
- **Teacher attendance %** = check-ins / weekdays (Mon-Fri) from their first check-in; today does not count against them until they have checked in.
- **Risk level:** `at_risk` if attendance is under 75% or the exam average is under 40%; `watch` if under 85% or under 55%; otherwise `ok`. Missing data never raises risk.
- **Scoping:** school admins see their own school, super admins can pass `?schoolId=`, teachers see only students of sections they are assigned to, and students/parents cannot use `/progress`. Metrics use grouped queries, so the cost does not grow per student.

## Module toggles

Modules (`academics`, `attendance`, `v-buddy`, `instasolve`, ...) can be switched on or off platform-wide (`PATCH /modules/:key`) and per school (`PUT /modules/school/:schoolId/:key`). `GET /modules/enabled` and the login response return the effective set for the caller's school. The AI endpoints enforce it server-side (`MODULE_DISABLED`).

## Authentication and security

- Short-lived JWT access token (`Authorization: Bearer`) plus an opaque refresh token stored hashed (SHA-256) and delivered as an HTTP-only, `SameSite=Lax` cookie scoped to `/api/v1/auth`.
- Refresh tokens rotate on every use. Re-using a rotated token revokes the whole session family.
- Passwords are hashed with argon2. Five failed logins for an identifier lock it for 15 minutes.
- Helmet, CORS allow-list, global and auth-specific rate limits, Zod validation on every route, and a central error handler that hides stack traces in production.
- Audit log for important mutations (who, action, resource, IP, user agent, metadata), plus login attempts and active sessions in `/security`.

## AI provider abstraction

`AIProvider` defines `generateResponse`, `solveQuestion`, `generateExplanation` and `generateStudyPlan`. `AIService` selects an implementation from `AI_PROVIDER` and records `AIRequestLog` rows (user, school, module, provider, model, latency, success, never the prompt). The shipped `MockProvider` works offline. The OpenAI, Gemini and Claude providers are stubs that return `AI_NOT_CONFIGURED` until implemented and given a key. V Buddy (chat with saved history) and Instasolve sit on top of this.

## Files and notifications

- `StorageProvider` interface with a working `LocalStorageProvider` (`UPLOAD_DIR`) and an `S3StorageProvider` stub. Only metadata is stored in PostgreSQL.
- `NotificationService` has pluggable channels (`IN_APP` implemented; `EMAIL`, `PUSH` and `SMS` are stubs). Scheduled notices are announced by a small in-process timer started in `server.ts`.

## Docker

```bash
cp .env.example .env                       # set POSTGRES_PASSWORD and both JWT secrets
docker compose up -d --build               # postgres + backend (runs migrate deploy) + frontend
docker compose --profile seed run --rm seed   # creates the ADMIN_EMAIL admin (+ demo data if SEED_DEMO_DATA=true)
docker compose logs -f backend
docker compose down                        # add -v to also delete the database volume
```

Frontend at http://localhost:3000, API at http://localhost:4000, docs at http://localhost:4000/api/docs. `NEXT_PUBLIC_API_URL` is baked into the frontend image at build time and must be reachable from the user's browser. If you change it, rebuild the frontend image.

To run only the database in Docker while developing locally: `docker compose up -d postgres`, then point `DATABASE_URL` at `localhost:5433`.

## Production deployment

1. Provision managed PostgreSQL. Set `DATABASE_URL` (URL-encode the password).
2. Generate strong, distinct `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values. Set `NODE_ENV=production` so cookies are `Secure` and error details are hidden.
3. Serve the frontend and API over HTTPS. Put them under one registrable domain (for example `app.example.com` and `api.example.com`) so the `SameSite=Lax` refresh cookie is sent, and set `CORS_ORIGIN` to the frontend origin.
4. Build the images (`backend/Dockerfile` runs `prisma migrate deploy` on start). Build the frontend with the public `NEXT_PUBLIC_API_URL`.
5. Never set `SEED_DEMO_DATA=true` in production. Create the first SUPER_ADMIN by running the seed once with your own `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then remove those variables.
6. Move uploads to durable storage: implement `S3StorageProvider` or mount a persistent volume at `UPLOAD_DIR`.
7. Run more than one API instance only after moving the scheduled-notice timer and rate limiting to shared infrastructure (Redis/BullMQ). The claim step keeps notices from being sent twice, but rate limits are per process.
8. Back up PostgreSQL and ship logs (Pino writes JSON to stdout).

## Known limitations

- The refresh cookie is `SameSite=Lax`, so the frontend and API must be same-site. There is no separate CSRF token, because state-changing calls need the bearer access token (kept in memory, not in a cookie).
- Password-reset emails are not sent, because no email provider is wired in. In development the token is written to the API log.
- Real AI providers, the S3 storage provider, and EMAIL/PUSH/SMS channels are stubs.
- Teacher attendance is self check-in only (no leave/holiday calendar yet): weekdays without a check-in count as absent from the teacher's first check-in.
- PDF export is not implemented (CSV export is).
- In-process timers and rate limits are per instance (see production step 7).
- Teacher and user "delete" deactivates the account. Student and school deletes remove rows.
