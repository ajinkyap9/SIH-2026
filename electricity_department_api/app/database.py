from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

# Handle SQLite connect args
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    if settings.REQUIRE_POSTGRES:
        raise RuntimeError("REQUIRE_POSTGRES is set but DATABASE_URL is SQLite - set DATABASE_URL to the PostgreSQL connection string.")
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,   # drop dead connections after a database restart
    echo=False
)
print(f"[Electricity API] Database: {engine.url.get_backend_name()} ({engine.url.host or engine.url.database})", flush=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency for obtaining a SQLAlchemy session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
