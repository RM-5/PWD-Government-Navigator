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
| `DATABASE_AUTO_SEED_DEMO` | `true` | Seed demo users and data |
| `DATABASE_STARTUP_CHECK` | `true` | Ping database on startup |
| `DEMO_AUTH_ENABLED` | `true` | Email-only demo login |
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
7. **Benefits** — check eligibility and apply
8. **Pensions** — final financial support step

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

## License

Hackathon / demonstration project. Use and adapt as needed for learning and prototyping.
