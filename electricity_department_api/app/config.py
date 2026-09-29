import json
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


# Portal port for the website's links back to Samanvay: from the repo-root
# ports.json locally; built-in default when this folder is deployed on its own.
def _portal_port() -> int:
    try:
        ports = json.loads((Path(__file__).resolve().parents[2] / "ports.json").read_text(encoding="utf-8"))
        return int(ports["services"]["portal"]["port"])
    except Exception:
        return 5001


class Settings(BaseSettings):
    APP_NAME: str = "Electricity Distribution Department API"
    ENVIRONMENT: str = "development"
    # Cloud: the provisioned PostgreSQL connection string. Local default: SQLite file.
    DATABASE_URL: str = "sqlite:///./electricity_department.db"
    # true in production: refuse to start on SQLite instead of silently using it.
    REQUIRE_POSTGRES: bool = False

    # Samanvay portal's full URL (cloud). Unset locally: the website derives it
    # from its own hostname + PORTAL_PORT, as before.
    PORTAL_URL: Optional[str] = None
    PORTAL_PORT: int = _portal_port()
    # Comma-separated origins allowed by CORS, or * (default).
    CORS_ALLOWED_ORIGINS: str = "*"

    # Chaos / Failure Simulation Configuration
    CHAOS_ENABLED: bool = False
    APPLICATION_FAILURE_RATE: float = 0.10
    VERIFY_FAILURE_RATE: float = 0.10
    STATUS_FAILURE_RATE: float = 0.05
    SCHEMA_DRIFT_RATE: float = 0.20
    SIMULATED_DELAY_RATE: float = 0.05
    SIMULATED_DELAY_MS: int = 3000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins(self) -> list[str]:
        items = [o.strip().rstrip("/") for o in self.CORS_ALLOWED_ORIGINS.split(",") if o.strip()]
        return ["*"] if not items or "*" in items else items


settings = Settings()
# Hosts hand out postgres://... or postgresql://... with no driver named. Name the
# installed driver (psycopg2, see requirements.txt) explicitly: SQLAlchemy 2.1+
# otherwise picks psycopg 3 for a bare postgresql:// URL and fails to import it.
for _prefix in ("postgres://", "postgresql://"):
    if settings.DATABASE_URL.startswith(_prefix):
        settings.DATABASE_URL = "postgresql+psycopg2://" + settings.DATABASE_URL[len(_prefix):]
        break
