from collections.abc import Generator
from os import getenv

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


DEFAULT_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/postgres"


def get_database_url() -> str:
    return getenv("DATABASE_URL", DEFAULT_DATABASE_URL)


def get_engine(database_url: str | None = None, *, echo: bool = False) -> Engine:
    url = database_url or get_database_url()
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    engine_kwargs = {
        "echo": echo,
        "pool_pre_ping": not url.startswith("sqlite"),
        "connect_args": connect_args,
    }
    if url in {"sqlite://", "sqlite:///:memory:"}:
        engine_kwargs["poolclass"] = StaticPool
    return create_engine(url, **engine_kwargs)


def get_session_factory(engine: Engine | None = None) -> sessionmaker[Session]:
    return sessionmaker(bind=engine or get_engine(), autoflush=False, expire_on_commit=False)


def get_session() -> Generator[Session, None, None]:
    session_factory = get_session_factory()
    with session_factory() as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise
