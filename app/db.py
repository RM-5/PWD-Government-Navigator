from collections.abc import Generator

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from database.base import Base
from database.session import get_engine, get_session_factory
import models.schema  # noqa: F401


settings = get_settings()
engine = get_engine(settings.database_url, echo=settings.database_echo)
SessionLocal = get_session_factory(engine)


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise


def ping_database() -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


def create_database_schema() -> None:
    Base.metadata.create_all(bind=engine)


def seed_demo_database() -> None:
    from seed.seed_demo_data import seed

    with SessionLocal() as session:
        seed(session)


def initialize_database() -> None:
    if settings.database_startup_check:
        ping_database()
    if settings.database_auto_create:
        create_database_schema()
    if settings.database_auto_seed_demo and settings.demo_auth_enabled:
        seed_demo_database()
