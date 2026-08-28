#!/usr/bin/env bash
# Idempotent repository bootstrap for the Sahaayak dev environment.
# Installs system packages, Python deps, and frontend deps. Safe to re-run.
set -euo pipefail

echo "==> Installing system packages (PostgreSQL, python venv)"
sudo apt-get update -qq
sudo apt-get install -y -qq postgresql postgresql-contrib python3-venv

echo "==> Ensuring PostgreSQL is running and configured"
sudo pg_ctlcluster 16 main start || true
# Wait briefly for the socket to come up, then set the demo password.
for _ in $(seq 1 10); do
  if sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"

echo "==> Setting up Python virtual environment"
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

echo "==> Installing frontend dependencies"
npm --prefix frontend install

echo "==> Install complete"
