# Sahaayak Frontend

This is the Next.js frontend inside the `PWDdisabilitynavigator` monorepo. It is connected to the FastAPI backend and reads seeded demo data through the backend API.

## Run Locally

1. Start the backend from the repository root: `npm run backend:dev`.
2. Start the frontend from the repository root: `npm run frontend:dev`.
3. Open `http://localhost:3000`.

The frontend uses `NEXT_PUBLIC_API_URL=http://localhost:8000` from `.env.local`. Demo auth stores the backend access token in `localStorage` and sends it as `Authorization: Bearer <token>` on API requests.

## API Boundary

- `lib/api/index.ts` is the only application API boundary. Components do not use raw `fetch`.
- Dashboard views compose real data from `/api/auth/me`, `/api/cases`, `/api/hospitals`, `/api/appointments`, `/api/benefits`, `/api/documents`, `/api/grievances`, `/api/ngos`, `/api/notifications`, and `/api/admin/summary`.
- `/[role]/[[...slug]]` provides the role portals while FastAPI still enforces authorization.
