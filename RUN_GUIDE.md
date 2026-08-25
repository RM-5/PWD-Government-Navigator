# PWDdisabilitynavigator Run Guide

`PWDdisabilitynavigator` is now the working monorepo. It contains the FastAPI backend, SQLAlchemy/PostgreSQL database layer, Alembic migrations, seed data, tests, and the Next.js frontend.

## Folder Structure

```text
PWDdisabilitynavigator/
├── app/                 # FastAPI backend
├── database/            # SQLAlchemy engine/session setup
├── migrations/          # Alembic migrations
├── models/              # SQLAlchemy source-of-truth schema
├── seed/                # Reproducible demo data
├── tests/               # Backend tests
├── frontend/            # Next.js frontend
├── package.json         # Monorepo helper scripts
├── requirements.txt     # Python backend dependencies
└── .env.example         # Backend environment template
```

## Demo Accounts

Use these on the login page:

| Role | Email |
| --- | --- |
| Citizen | `citizen@demo.local` |
| Hospital staff | `hospital@demo.local` |
| State representative | `state@demo.local` |
| Admin | `admin@demo.local` |

No real Aadhaar, UDID, hospital, or government credentials are used.

## One-Time Backend Setup

From the repo root:

```bash
cd /Users/xicom/Desktop/Python/PWDdisabilitynavigator
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create the local PostgreSQL database if it does not already exist:

```bash
createdb disability_navigator
```

If your PostgreSQL user is different, create `.env` from `.env.example` and update `DATABASE_URL`. The current default is:

```env
DATABASE_URL="postgresql+psycopg://xicom@localhost:5432/disability_navigator"
CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
DATABASE_AUTO_CREATE=true
DATABASE_AUTO_SEED_DEMO=true
```

On backend startup, the app pings the DB, creates missing tables, and seeds demo rows. You can also run migrations manually:

```bash
source .venv/bin/activate
alembic upgrade head
python -m seed.seed_demo_data
```

## One-Time Frontend Setup

```bash
cd /Users/xicom/Desktop/Python/PWDdisabilitynavigator/frontend
npm install
```

The frontend environment is already set in `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_USE_MOCK_API=false
```

## Run The App

Use two terminals.

Terminal 1, backend:

```bash
cd /Users/xicom/Desktop/Python/PWDdisabilitynavigator
npm run backend:dev
```

Terminal 2, frontend:

```bash
cd /Users/xicom/Desktop/Python/PWDdisabilitynavigator
npm run frontend:dev
```

Open `http://localhost:3000`. API docs are at `http://localhost:8000/docs`. DB health is at `http://localhost:8000/api/health/db`.

## Verify

Backend tests:

```bash
cd /Users/xicom/Desktop/Python/PWDdisabilitynavigator
npm run backend:test
```

Frontend production build:

```bash
cd /Users/xicom/Desktop/Python/PWDdisabilitynavigator
npm run frontend:build
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Backend cannot connect to DB | Confirm PostgreSQL is running and `DATABASE_URL` points to the right user/database. |
| `role "postgres" does not exist` | Use your macOS username in `DATABASE_URL`, for example `postgresql+psycopg://xicom@localhost:5432/disability_navigator`. |
| Frontend API errors | Make sure backend is running on port `8000` and `frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8000`. |
| CORS error | Ensure `CORS_ORIGINS` includes `http://localhost:3000`. |
| Port already in use | Use `lsof -ti:8000` or `lsof -ti:3000` to identify the process, then stop it. |
