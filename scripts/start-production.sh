#!/usr/bin/env bash
set -euo pipefail

echo "Running database migrations..."
python - <<'PY'
from app.db import run_migrations

run_migrations()
print("Migrations complete.")
PY

echo "Starting Sahaayak API..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
