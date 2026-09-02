from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Government Interoperability Platform Backend"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "sqlite:///./interop_platform.db"

    # JWT Settings
    JWT_SECRET_KEY: str = "sih26129_super_secret_jwt_key_for_interop_platform_2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Department Connectors
    LAND_API_URL: str = "http://localhost:4000"
    LAND_API_KEY: str = "interop-demo-key-001"

    ELECTRICITY_API_URL: str = "http://localhost:8000"
    ELECTRICITY_API_KEY: str = "elec_live_interop_key_991"

    POLLUTION_API_URL: str = "http://localhost:4002"
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


settings = Settings()
