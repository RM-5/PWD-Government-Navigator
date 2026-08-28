#!/usr/bin/env bash
# Per-boot startup: bring PostgreSQL online. Idempotent and non-blocking.
set -euo pipefail

sudo pg_ctlcluster 16 main start || true

# Wait for the database to accept connections so dependent services start cleanly.
for _ in $(seq 1 15); do
  if sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
    echo "PostgreSQL is ready."
    exit 0
  fi
  sleep 1
done

echo "WARNING: PostgreSQL did not report ready within timeout." >&2
