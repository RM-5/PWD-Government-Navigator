# Deployment Guide — Sahaayak (PWD Disability Navigator)

This guide walks you through hosting the Sahaayak prototype publicly using **Vercel** (frontend), **Supabase** (PostgreSQL database), and **Render** or **Railway** (FastAPI backend).

## Architecture Overview

```
┌─────────────┐     HTTPS      ┌──────────────┐     HTTPS      ┌──────────────┐
│   Vercel    │ ──────────────▶│ Render/Railway│ ──────────────▶│   Supabase   │
│  (Next.js)  │                │  (FastAPI)    │                │ (PostgreSQL) │
│  Port 3000  │                │  Port 8000    │                │              │
└─────────────┘                └──────────────┘                └──────────────┘
```

---

## Step 1: Set Up Supabase (Database)

1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New Project** → choose a name (e.g. `sahaayak`), set a strong database password, and pick a region close to India (e.g. `ap-south-1` Mumbai).
3. Once the project is ready, go to **Project Settings → Database**.
4. Copy the **Connection string (URI)** — it looks like:
   ```
   postgresql://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   ```
5. For SQLAlchemy, change the scheme to `postgresql+psycopg://` (same host/credentials).

---

## Step 2: Deploy the Backend (Render — recommended)

### Option A: Render

1. Push your code to GitHub (branch `RM-5`).
2. Go to [render.com](https://render.com) → **New → Web Service**.
3. Connect your GitHub repo and select the `RM-5` branch.
4. Configure:
   - **Name:** `sahaayak-api`
   - **Root Directory:** *(leave blank — repo root)*
   - **Runtime:** Python 3
   - **Build Command:**
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command:**
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
5. Add **Environment Variables**:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Your Supabase connection string (`postgresql+psycopg://...`) |
   | `DATABASE_AUTO_CREATE` | `true` |
   | `DATABASE_AUTO_SEED_DEMO` | `true` |
   | `DEMO_AUTH_ENABLED` | `true` |
   | `CORS_ORIGINS` | `https://your-app.vercel.app` (update after Vercel deploy) |

6. Click **Create Web Service**. Note the URL (e.g. `https://sahaayak-api.onrender.com`).

### Option B: Railway

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**.
2. Select your repo and branch.
3. Railway auto-detects Python. Set the start command:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
4. Add the same environment variables as above in the **Variables** tab.
5. Railway provides a public URL automatically.

---

## Step 3: Deploy the Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) → **Add New Project**.
2. Import your GitHub repo, select branch `RM-5`.
3. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
4. Add **Environment Variable**:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | `https://sahaayak-api.onrender.com` (your backend URL) |

5. Click **Deploy**. Vercel gives you a URL like `https://sahaayak.vercel.app`.

6. Go back to Render/Railway and update `CORS_ORIGINS` to include your Vercel URL:
   ```
   https://sahaayak.vercel.app,https://sahaayak-*.vercel.app
   ```

---

## Step 4: Verify Deployment

1. Open your Vercel URL → you should see the login page with Workflow & FAQ.
2. Log in as `citizen@demo.local` → explore the citizen portal.
3. Log in as `cpgrams@demo.local` → see CPGRAMS grievance queue.
4. Log in as `state@demo.local` → see rights violation queue.
5. Test API health: `https://your-api-url.onrender.com/health`

---

## Step 5: Custom Domain (Optional)

### Vercel
- Go to **Project Settings → Domains** → add your domain (e.g. `sahaayak.org`).
- Update DNS records as instructed.

### Render
- Go to **Settings → Custom Domains** → add `api.sahaayak.org`.
- Update `NEXT_PUBLIC_API_URL` and `CORS_ORIGINS` accordingly.

---

## Environment Variables Reference

### Backend (`.env` or Render/Railway)

```env
APP_NAME="Disability Navigator API"
DATABASE_URL="postgresql+psycopg://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
DATABASE_AUTO_CREATE=true
DATABASE_AUTO_SEED_DEMO=true
DEMO_AUTH_ENABLED=true
CORS_ORIGINS="https://your-app.vercel.app"
```

### Frontend (`frontend/.env.local` or Vercel)

```env
NEXT_PUBLIC_API_URL=https://your-api-url.onrender.com
```

---

## Demo Accounts

| Role | Email | Portal |
|------|-------|--------|
| Citizen | `citizen@demo.local` | `/citizen` |
| Hospital | `hospital@demo.local` | `/hospital` |
| CPGRAMS Officer | `cpgrams@demo.local` | `/cpgrams` |
| State Representative | `state@demo.local` | `/state` |
| Admin | `admin@demo.local` | `/admin` |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| CORS errors in browser | Add your Vercel URL to `CORS_ORIGINS` on the backend |
| "Login failed" | Check `NEXT_PUBLIC_API_URL` points to the live backend |
| Empty database | Set `DATABASE_AUTO_SEED_DEMO=true` and restart backend |
| Render cold start (30s delay) | Free tier spins down after inactivity; first request is slow |
| `grievance_type` column missing | Drop and recreate tables, or run `alembic upgrade head` |

---

## Cost Estimate (Free Tier)

| Service | Free Tier Limits |
|---------|-----------------|
| Vercel | 100 GB bandwidth/month, unlimited hobby projects |
| Supabase | 500 MB database, 2 projects |
| Render | 750 hours/month, spins down after 15 min idle |
| Railway | $5 free credit/month |

For a hackathon demo, the free tiers are sufficient.
