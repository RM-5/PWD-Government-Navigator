from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Disability Navigator API"
    api_prefix: str = "/api"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/postgres"
    database_echo: bool = False
    database_auto_create: bool = True
    database_auto_seed_demo: bool = True
    database_startup_check: bool = True
    database_run_migrations: bool = False
    demo_auth_enabled: bool = True
    cors_origins: list[str] | str = ["http://localhost:3000", "http://127.0.0.1:3000"]
    cors_allow_vercel: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value):
        if isinstance(value, str):
            # Supabase and other hosts often provide postgresql:// — SQLAlchemy needs the psycopg driver.
            if value.startswith("postgresql://"):
                return value.replace("postgresql://", "postgresql+psycopg://", 1)
            # Ensure SSL for Supabase direct connections when not already specified.
            if "supabase.co" in value and "sslmode=" not in value:
                separator = "&" if "?" in value else "?"
                return f"{value}{separator}sslmode=require"
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            if value.startswith("[") and value.endswith("]"):
                import json
                try:
                    return json.loads(value)
                except Exception:
                    pass
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
