"""
Database configuration for TaaskMaaster.

This module handles database connection configuration and URL generation.
"""

from typing import Optional

from pydantic_settings import BaseSettings


class DatabaseSettings(BaseSettings):
    """Database configuration settings."""

    # Database type (sqlite, postgresql, mysql)
    database_type: str = "sqlite"

    # SQLite configuration
    sqlite_path: str = "taaskmaaster.db"

    # PostgreSQL configuration
    postgres_host: Optional[str] = None
    postgres_port: int = 5432
    postgres_user: Optional[str] = None
    postgres_password: Optional[str] = None
    postgres_database: Optional[str] = None

    # MySQL configuration
    mysql_host: Optional[str] = None
    mysql_port: int = 3306
    mysql_user: Optional[str] = None
    mysql_password: Optional[str] = None
    mysql_database: Optional[str] = None

    # Connection settings
    pool_size: int = 10
    max_overflow: int = 20
    pool_timeout: int = 30
    pool_recycle: int = 3600

    class Config:
        env_prefix = "DB_"
        env_file = ".env"
        extra = "ignore"


def get_database_url() -> str:
    """
    Generate database URL based on configuration.

    Returns:
        Database connection URL string
    """
    settings = DatabaseSettings()

    if settings.database_type == "sqlite":
        return f"sqlite:///./{settings.sqlite_path}"

    elif settings.database_type == "postgresql":
        if not all(
            [
                settings.postgres_host,
                settings.postgres_user,
                settings.postgres_password,
                settings.postgres_database,
            ]
        ):
            raise ValueError("PostgreSQL configuration incomplete")

        postgres_host = settings.postgres_host
        postgres_port = settings.postgres_port
        postgres_user = settings.postgres_user
        postgres_password = settings.postgres_password
        postgres_database = settings.postgres_database

        if postgres_password:
            postgres_password = f":{postgres_password}"
        else:
            postgres_password = ""

        return (
            f"postgresql://{postgres_user}:{postgres_password}"
            f"@{postgres_host}:{postgres_port}/{postgres_database}"
        )

    elif settings.database_type == "mysql":
        if not all(
            [
                settings.mysql_host,
                settings.mysql_user,
                settings.mysql_password,
                settings.mysql_database,
            ]
        ):
            raise ValueError("MySQL configuration incomplete")

        mysql_host = settings.mysql_host
        mysql_port = settings.mysql_port
        mysql_user = settings.mysql_user
        mysql_password = settings.mysql_password
        mysql_database = settings.mysql_database

        if mysql_password:
            mysql_password = f":{mysql_password}"
        else:
            mysql_password = ""

        return (
            f"mysql+pymysql://{mysql_user}:{mysql_password}"
            f"@{mysql_host}:{mysql_port}/{mysql_database}"
        )

    else:
        raise ValueError(
            f"Unsupported database type: {settings.database_type}"
        )


def get_database_settings() -> DatabaseSettings:
    """
    Get database settings instance.

    Returns:
        DatabaseSettings instance
    """
    return DatabaseSettings()
