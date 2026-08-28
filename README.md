# Sahaayak

Accessibility-first government services navigator for persons with disabilities (PWD). Sahaayak helps citizens discover services, book medical assessments, track disability certificates, apply for benefits, and file grievances — with dedicated portals for hospitals, CPGRAMS officers, state representatives, and administrators.

This is a **demo prototype**. No real Aadhaar, medical records, or identity documents are collected or stored.

## Tech stack

| Layer | Stack |
|-------|-------|
| Backend | Python, FastAPI, SQLAlchemy 2, Alembic |
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Database | PostgreSQL |

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- npm (or pnpm)

## Quick start

### 1. Clone and set up Python

```bash
git clone https://github.com/RM-5/Sahaayak.git
cd Sahaayak

python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure the database

Create a PostgreSQL database, then set environment variables (export them or create a local `.env` file — it is gitignored):

```bash
export DATABASE_URL="postgresql+psycopg://USER:PASSWORD@localhost:5432/disability_navigator"
export CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
```

Optional settings (defaults shown):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_AUTO_CREATE` | `true` | Create tables on startup |
| `DATABASE_RUN_MIGRATIONS` | `false` | Run Alembic migrations on startup |
| `DATABASE_AUTO_SEED_DEMO` | `true` | Seed demo users and data |
| `DATABASE_STARTUP_CHECK` | `true` | Ping database on startup |
| `DEMO_AUTH_ENABLED` | `true` | Email-only demo login |
| `CORS_ALLOW_VERCEL` | `true` | Allow `*.vercel.app` origins |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | Backend URL for the frontend |

Run migrations (optional if auto-create is enabled):

```bash
alembic upgrade head
```

### 3. Install and run the frontend

```bash
cd frontend && npm install && cd ..
```

From the repository root:

```bash
# Terminal 1 — API on http://127.0.0.1:8000
npm run backend:dev

# Terminal 2 — UI on http://localhost:3000
npm run frontend:dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

The Next.js dev server proxies `/api/*` to the backend, so the browser uses same-origin API calls.

## Demo accounts

Log in with any email below (no password in demo mode):

| Role | Email | Portal |
|------|-------|--------|
| Citizen | `citizen@demo.local` | `/citizen` |
| Hospital staff | `hospital@demo.local` | `/hospital` |
| CPGRAMS officer | `cpgrams@demo.local` | `/cpgrams` |
| State representative | `state@demo.local` | `/state` |
| Administrator | `admin@demo.local` | `/admin` |

### Citizen journey (overview)

1. **Profile** — confirm citizen profile
2. **Service identified** — browse government services
3. **Hospital identified** — choose an assessment hospital
4. **Appointment** — book a medical board slot
5. **Medical assessment** — hospital evaluates the case
6. **Certificate** — UDID / disability certificate issued
7. **Benefits & Pensions** — check eligibility and apply for pensions, concessions, and welfare grants

Grievances (CPGRAMS and rights violations) are available at every step via the citizen portal banner.

Admins can reset the demo citizen journey from the admin portal without clearing grievances.

## Project structure

```
├── app/              FastAPI application (routes, auth, schemas)
├── database/         SQLAlchemy engine and session helpers
├── models/           ORM models and enums
├── migrations/       Alembic migrations
├── seed/             Demo seed data and citizen journey helpers
├── tests/            Pytest suite
├── frontend/         Next.js citizen and staff portals
├── alembic.ini
├── requirements.txt
└── package.json      Root scripts for backend + frontend
```

## API

- Health: `GET /api/health`, `GET /api/health/db`
- Interactive docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) (when the backend is running)

All application routes are prefixed with `/api`.

## Tests

```bash
source .venv/bin/activate
npm run backend:test
# or: python -m pytest
```

Unit tests use an in-memory SQLite database with seeded demo data. Full PostgreSQL integration tests require a running Postgres instance.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run backend:dev` | Start FastAPI with hot reload (port 8000) |
| `npm run frontend:dev` | Start Next.js dev server (port 3000) |
| `npm run frontend:build` | Production build of the frontend |
| `npm run backend:test` | Run pytest |

## Deploy online (Vercel + Supabase + Render)

This app splits across three free-tier services:

| Service | Hosts | Cost |
|---------|-------|------|
| **Frontend** | [Vercel](https://vercel.com) | Free |
| **Database** | [Supabase](https://supabase.com) (PostgreSQL) | Free |
| **Backend API** | [Render](https://render.com) | Free |

Deploy in this order: **Supabase → Render → Vercel**.

### 1. Supabase (database)

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open **Project Settings → Database**.
3. Copy the **URI** connection string (Session mode, port `5432`).
4. Replace `[YOUR-PASSWORD]` with your database password.
5. The app auto-converts `postgresql://` to `postgresql+psycopg://` and adds SSL for Supabase hosts.

Example (yours will differ):

```text
postgresql+psycopg://postgres.xxxxx:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require
```

### 2. Render (backend API)

1. Push this repo to GitHub if it is not already there.
2. Go to [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**.
3. Connect the **Sahaayak** repository and apply the included `render.yaml`.
4. When prompted, set **`DATABASE_URL`** to your Supabase URI from step 1.
5. After deploy, note your API URL (e.g. `https://sahaayak-api.onrender.com`).
6. Verify: open `https://YOUR-API.onrender.com/api/health/db` — it should return `{"status":"ok"}`.

**Render environment variables** (set in the Render dashboard if not using the blueprint):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Supabase connection string |
| `DATABASE_AUTO_CREATE` | `false` |
| `DATABASE_AUTO_SEED_DEMO` | `true` |
| `CORS_ALLOW_VERCEL` | `true` |
| `CORS_ORIGINS` | Your Vercel URL (update after step 3) |

Migrations run automatically on each deploy via `scripts/start-production.sh`.

> **Note:** Render free tier sleeps after ~15 minutes of inactivity. The first request after sleep may take 30–60 seconds.

### 3. Vercel (frontend)

1. Go to [vercel.com/new](https://vercel.com/new) and import the **Sahaayak** GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Add environment variable:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_API_URL` | `https://YOUR-API.onrender.com` (no trailing slash) |

4. Deploy. Note your Vercel URL (e.g. `https://sahaayak.vercel.app`).

### 4. Connect frontend and backend

1. In **Render**, update `CORS_ORIGINS` to your exact Vercel URL and redeploy the API.
2. Open your Vercel URL → `/login` and sign in with `citizen@demo.local`.

The Next.js app proxies browser `/api/*` calls to Render using `NEXT_PUBLIC_API_URL`.

### Troubleshooting

| Problem | Fix |
|---------|-----|
| `Failed to fetch` on login | Backend asleep (wait ~60s) or wrong `NEXT_PUBLIC_API_URL` |
| CORS error in browser | Add your Vercel URL to Render `CORS_ORIGINS` |
| Database connection failed | Check Supabase password, use Session pooler URI, ensure project is active |
| `Could not parse SQLAlchemy URL` | Set `DATABASE_URL` in Render (not empty). Use Supabase **URI** with your real password — no `[YOUR-PASSWORD]` placeholders. If the password has special characters (`@`, `#`, etc.), the app auto-encodes them on startup |
| Empty data after deploy | Confirm `DATABASE_AUTO_SEED_DEMO=true` on Render; check `/api/health/db` |

## License

Hackathon / demonstration project. Use and adapt as needed for learning and prototyping.
