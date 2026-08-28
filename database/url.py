from __future__ import annotations

import os
import re
from urllib.parse import quote_plus


class DatabaseUrlError(ValueError):
    """Raised when DATABASE_URL is missing or cannot be parsed."""


def normalize_database_url(raw: str | None) -> str:
    if raw is None:
        raise DatabaseUrlError(
            "DATABASE_URL is not set. Add your Supabase connection string in the Render dashboard."
        )

    url = raw.strip().strip('"').strip("'")
    if not url:
        raise DatabaseUrlError(
            "DATABASE_URL is empty. Paste your full Supabase URI in Render → Environment."
        )

    # Allow SQLite URLs (used by the in-memory test suite) to pass through unchanged.
    if url.startswith("sqlite"):
        return url

    if url.startswith("postgres://"):
        url = f"postgresql+psycopg://{url[len('postgres://'):]}"
    elif url.startswith("postgresql://"):
        url = f"postgresql+psycopg://{url[len('postgresql://'):]}"
    elif not url.startswith("postgresql+psycopg://"):
        raise DatabaseUrlError(
            "DATABASE_URL must start with postgresql:// or postgres://. "
            f"Got: {url[:40]}..."
        )

    url = _encode_password_if_needed(url)

    if "supabase.co" in url and "sslmode=" not in url:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}sslmode=require"

    return url


def _encode_password_if_needed(url: str) -> str:
    """Re-encode credentials when special characters break SQLAlchemy URL parsing."""
    try:
        from sqlalchemy.engine.url import make_url

        make_url(url)
        return url
    except Exception:
        pass

    match = re.match(r"^(postgresql\+psycopg://)([^@]+)@(.+)$", url)
    if not match:
        raise DatabaseUrlError(
            "Could not parse DATABASE_URL. Ensure it looks like: "
            "postgresql://postgres.[ref]:YOUR_PASSWORD@db....supabase.co:5432/postgres"
        )

    prefix, credentials, host_part = match.groups()
    if ":" in credentials:
        user, password = credentials.split(":", 1)
    else:
        user, password = credentials, ""

    encoded = f"{quote_plus(user)}:{quote_plus(password)}"
    fixed = f"{prefix}{encoded}@{host_part}"

    from sqlalchemy.engine.url import make_url

    make_url(fixed)
    return fixed


def get_database_url(fallback: str | None = None) -> str:
    raw = os.getenv("DATABASE_URL")
    if raw is None or not raw.strip():
        if fallback:
            return normalize_database_url(fallback)
        raise DatabaseUrlError(
            "DATABASE_URL is not set. Add your Supabase connection string in the Render dashboard."
        )
    return normalize_database_url(raw)
