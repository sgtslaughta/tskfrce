"""
Application configuration settings.

This module contains all configuration settings for the TaaskMaaster application,
including database, authentication, and external service configurations.
"""

from pathlib import Path
from typing import Any

from pydantic import ConfigDict, model_validator, validator
from pydantic_settings import BaseSettings

from app.core.secrets import load_or_create_secrets


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """

    # Application settings
    APP_NAME: str = "TaaskMaaster"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # API settings
    API_V1_STR: str = "/api/v1"
    # Generated at first boot into DATA_DIR/secrets.json unless set via env
    SECRET_KEY: str | None = None
    JWT_SECRET_KEY: str | None = None
    INTERNAL_TOKEN: str | None = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database settings
    DATABASE_URL: str | None = None  # default: sqlite:///{DATA_DIR}/task4ce.db
    DATABASE_ECHO: bool = False

    # CORS settings
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:8000",
    ]

    @model_validator(mode="after")
    def fill_data_dir_defaults(self) -> "Settings":
        """Create DATA_DIR, derive DATABASE_URL, fill unset secrets."""
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        if not self.DATABASE_URL:
            self.DATABASE_URL = f"sqlite:///{self.DATA_DIR}/task4ce.db"
        generated = load_or_create_secrets(self.DATA_DIR)
        for name, value in generated.items():
            if not getattr(self, name):
                setattr(self, name, value)
        return self

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str] | str:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Email settings
    SMTP_TLS: bool = True
    SMTP_PORT: int | None = None
    SMTP_HOST: str | None = None
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAILS_FROM_EMAIL: str | None = None
    EMAILS_FROM_NAME: str | None = None

    # File upload settings
    DATA_DIR: Path = Path("./data")
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: list[str] = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".bmp",
        ".pdf",
        ".doc",
        ".docx",
        ".txt",
        ".rtf",
        ".mp4",
        ".avi",
        ".mov",
        ".wmv",
        ".flv",
        ".mp3",
        ".wav",
        ".flac",
        ".aac",
        ".zip",
        ".rar",
        ".7z",
        ".tar",
        ".gz",
    ]

    # WebSocket settings
    WEBSOCKET_HEARTBEAT_INTERVAL: int = 30
    WEBSOCKET_MAX_CONNECTIONS: int = 1000

    # Rate limiting settings
    RATE_LIMIT_ENABLED: bool = True

    # Logging settings
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    LOG_FILE: str | None = None

    # Security settings
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_DIGITS: bool = True
    PASSWORD_REQUIRE_SYMBOLS: bool = False

    # Session settings
    SESSION_TIMEOUT_MINUTES: int = 1440  # 24 hours
    REMEMBER_ME_DAYS: int = 30

    # Notification settings
    ENABLE_EMAIL_NOTIFICATIONS: bool = True
    ENABLE_PUSH_NOTIFICATIONS: bool = True
    ENABLE_WEBSOCKET_NOTIFICATIONS: bool = True

    # Feature flags
    ENABLE_GAMIFICATION: bool = True
    ENABLE_REAL_TIME_COLLABORATION: bool = True
    ENABLE_ADVANCED_SEARCH: bool = True
    ENABLE_FILE_VERSIONING: bool = True
    ENABLE_AUDIT_LOGGING: bool = True

    # Performance settings
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    DATABASE_POOL_RECYCLE: int = 3600

    # Cache settings
    CACHE_TTL: int = 3600  # 1 hour
    CACHE_MAX_SIZE: int = 1000

    # Pagination settings
    DEFAULT_PAGE_SIZE: int = 50
    MAX_PAGE_SIZE: int = 100

    # Search settings
    SEARCH_INDEX_NAME: str = "taaskmaaster"
    SEARCH_MAX_RESULTS: int = 1000

    # Backup settings
    BACKUP_ENABLED: bool = False
    BACKUP_INTERVAL_HOURS: int = 24
    BACKUP_RETENTION_DAYS: int = 30

    # Monitoring settings
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090
    HEALTH_CHECK_INTERVAL: int = 60

    # External service settings
    OPENAI_API_KEY: str | None = None
    SLACK_WEBHOOK_URL: str | None = None
    DISCORD_WEBHOOK_URL: str | None = None

    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",  # Allow extra environment variables to be ignored
    )


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """
    Get application settings.
    """
    return settings


def update_settings(**kwargs) -> None:
    """
    Update application settings.
    """
    global settings
    for key, value in kwargs.items():
        if hasattr(settings, key):
            setattr(settings, key, value)


def get_database_url() -> str:
    """
    Get database URL with proper formatting.
    """
    return settings.DATABASE_URL


def is_development() -> bool:
    """
    Check if running in development environment.
    """
    return settings.ENVIRONMENT.lower() in ["development", "dev", "local"]


def is_production() -> bool:
    """
    Check if running in production environment.
    """
    return settings.ENVIRONMENT.lower() in ["production", "prod"]


def is_testing() -> bool:
    """
    Check if running in testing environment.
    """
    return settings.ENVIRONMENT.lower() in ["testing", "test"]


def get_cors_origins() -> list[str]:
    """
    Get CORS origins list.
    """
    return settings.BACKEND_CORS_ORIGINS


def validate_settings() -> dict[str, Any]:
    """
    Validate all settings and return validation results.
    """
    results = {"valid": True, "errors": [], "warnings": []}

    # Check required settings
    if not settings.SECRET_KEY:
        results["errors"].append("SECRET_KEY must be set to a secure value")
        results["valid"] = False

    if not settings.DATABASE_URL:
        results["errors"].append("DATABASE_URL must be set")
        results["valid"] = False

    # Check optional but recommended settings
    if is_production() and settings.DEBUG:
        results["warnings"].append("DEBUG should be False in production")

    if is_production() and not settings.SMTP_HOST:
        results["warnings"].append("Email settings should be configured in production")

    return results
