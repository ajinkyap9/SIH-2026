import json
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


# Department addresses. Cloud: LAND_API_URL / ELECTRICITY_API_URL / POLLUTION_API_URL
# environment variables (full URLs) — BaseSettings reads them first. Local
# development: the defaults below, from the repo-root ports.json. Built-in values
# (same as ports.json) are used only when this folder is deployed without it.
_DEFAULT_PORTS = {
    "host": "127.0.0.1",
    "services": {"portal": {"port": 5001}, "interop": {"port": 8000}, "electricity": {"port": 8001},
                 "land": {"port": 4000}, "pollution": {"port": 4002}},
}
try:
    _PORTS = json.loads((Path(__file__).resolve().parents[2] / "ports.json").read_text(encoding="utf-8"))
except (OSError, ValueError):
    _PORTS = _DEFAULT_PORTS


def _service_url(name: str) -> str:
    return f"http://{_PORTS['host']}:{_PORTS['services'][name]['port']}"



class Settings(BaseSettings):
    APP_NAME: str = "Government Interoperability Platform Backend"
    ENVIRONMENT: str = "development"
    # Cloud: the provisioned PostgreSQL connection string. Local default: SQLite file.
    DATABASE_URL: str = "sqlite:///./interop_platform.db"
    # true in production: refuse to start on SQLite instead of silently using it.
    REQUIRE_POSTGRES: bool = False
    # Comma-separated origins allowed by CORS, or * (default).
    CORS_ALLOWED_ORIGINS: str = "*"

    # JWT Settings
    JWT_SECRET_KEY: str = "sih26129_super_secret_jwt_key_for_interop_platform_2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Department Connectors
    LAND_API_URL: str = _service_url("land")
    LAND_API_KEY: str = "interop-demo-key-001"

    ELECTRICITY_API_URL: str = _service_url("electricity")
    ELECTRICITY_API_KEY: str = "elec_live_interop_key_991"

    POLLUTION_API_URL: str = _service_url("pollution")
    POLLUTION_API_KEY: str = "interop-demo-key-001"

    # Circuit Breakers & Resilience
    CIRCUIT_BREAKER_FAILURE_THRESHOLD: int = 3
    CIRCUIT_BREAKER_RECOVERY_TIME_SEC: int = 30
    HTTP_TIMEOUT_SECONDS: float = 5.0
    HTTP_MAX_RETRIES: int = 2

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
# A trailing slash on a configured URL would produce "//api/..." paths.
for _name in ("LAND_API_URL", "ELECTRICITY_API_URL", "POLLUTION_API_URL"):
    setattr(settings, _name, getattr(settings, _name).rstrip("/"))
