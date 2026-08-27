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


def apply_schema_patches() -> None:
    """Patch existing databases when new enum values or columns are added."""
    with engine.connect() as connection:
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_name') AND NOT EXISTS (
                        SELECT 1 FROM pg_enum e
                        JOIN pg_type t ON e.enumtypid = t.oid
                        WHERE t.typname = 'role_name' AND e.enumlabel = 'cpgrams_officer'
                    ) THEN
                        ALTER TYPE role_name ADD VALUE 'cpgrams_officer';
                    END IF;
                END$$;
                """
            )
        )
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'grievance_type') THEN
                        CREATE TYPE grievance_type AS ENUM ('cpgrams', 'rights_violation');
                    END IF;
                END$$;
                """
            )
        )
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_name = 'grievances'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'grievances' AND column_name = 'grievance_type'
                    ) THEN
                        ALTER TABLE grievances
                            ADD COLUMN grievance_type grievance_type NOT NULL DEFAULT 'cpgrams';
                        CREATE INDEX ix_grievances_grievance_type ON grievances (grievance_type);
                    END IF;
                END$$;
                """
            )
        )
        connection.commit()


def seed_demo_database() -> None:
    from seed.seed_demo_data import seed

    with SessionLocal() as session:
        seed(session)


def initialize_database() -> None:
    if settings.database_startup_check:
        ping_database()
    if settings.database_auto_create:
        create_database_schema()
        apply_schema_patches()
    if settings.database_auto_seed_demo and settings.demo_auth_enabled:
        seed_demo_database()
