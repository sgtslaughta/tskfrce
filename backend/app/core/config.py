"""
Application configuration settings.

This module contains all configuration settings for the TaaskMaaster application,
including database, authentication, and external service configurations.
"""

import os
from typing import Any

try:
    from pydantic import ConfigDict, validator
    from pydantic_settings import BaseSettings

    PYDANTIC_V2 = True
except ImportError:
    # Fallback for older pydantic versions
    from pydantic import BaseSettings, validator

    PYDANTIC_V2 = False


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
    SECRET_KEY: str = "your-secret-key-here"
    JWT_SECRET_KEY: str = "your-jwt-secret-key-here"  # Add missing JWT secret key
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database settings
    DATABASE_URL: str = "sqlite:///./taaskmaaster.db"
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
    UPLOAD_DIR: str = "uploads"
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

    # MinIO/S3 settings
    MINIO_ENDPOINT: str | None = None
    MINIO_ACCESS_KEY: str | None = None
    MINIO_SECRET_KEY: str | None = None
    MINIO_BUCKET: str = "taaskmaaster"
    MINIO_SECURE: bool = False

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

    if PYDANTIC_V2:
        model_config = ConfigDict(
            env_file=".env",
            case_sensitive=True,
            extra="ignore",  # Allow extra environment variables to be ignored
        )
    else:

        class Config:
            env_file = ".env"
            case_sensitive = True
            extra = "ignore"


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


def get_upload_path() -> str:
    """
    Get the full path to upload directory.
    """
    upload_dir = os.path.abspath(settings.UPLOAD_DIR)
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir


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
    if not settings.SECRET_KEY or settings.SECRET_KEY == "your-secret-key-here":
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
