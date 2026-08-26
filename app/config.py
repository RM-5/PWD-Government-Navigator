from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Disability Navigator API"
    api_prefix: str = "/api"
    database_url: str = "postgresql+psycopg://xicom@localhost:5432/disability_navigator"
    database_echo: bool = False
    database_auto_create: bool = True
    database_auto_seed_demo: bool = True
    database_startup_check: bool = True
    demo_auth_enabled: bool = True
    cors_origins: list[str] | str = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

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
