#!/usr/bin/env bash
set -euo pipefail

echo "Running database migrations..."
alembic upgrade head

echo "Starting Sahaayak API..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
