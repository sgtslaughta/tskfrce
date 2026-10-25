"""
Database configuration and session management.

This module handles SQLAlchemy database configuration, connection pooling,
and session management for the TaaskMaaster application.
"""

from collections.abc import Iterator

from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Database URL configuration
DATABASE_URL = settings.DATABASE_URL


BUSY_TIMEOUT_MS = 5000


def _sqlite_pragmas(dbapi_conn, _record) -> None:
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute(f"PRAGMA busy_timeout={BUSY_TIMEOUT_MS}")
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()


def make_engine(url: str, echo: bool = False):
    """Build an engine: shared connection only for in-memory SQLite, pooled otherwise."""
    if url.startswith("sqlite"):
        args = {"check_same_thread": False}
        if url in ("sqlite://", "sqlite:///:memory:"):
            return create_engine(url, connect_args=args, poolclass=StaticPool, echo=echo)
        eng = create_engine(
            url, connect_args={**args, "timeout": BUSY_TIMEOUT_MS / 1000}, echo=echo
        )
        event.listen(eng, "connect", _sqlite_pragmas)
        return eng
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=10,
        max_overflow=20,
        echo=echo,
    )


engine = make_engine(DATABASE_URL, settings.DEBUG)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create declarative base
Base = declarative_base()


def get_db_session() -> Iterator[Session]:
    """FastAPI dependency yielding a session that is always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def drop_database():
    """
    Drop all database tables.
    """
    try:
        Base.metadata.drop_all(bind=engine)
        logger.info("Database tables dropped successfully")
    except Exception as e:
        logger.error(f"Failed to drop database tables: {e}")
        raise


def get_database_info():
    """
    Get database connection information.
    """
    return {
        "url": DATABASE_URL,
        "driver": engine.driver,
        "dialect": engine.dialect.name,
        "pool_size": engine.pool.size() if hasattr(engine.pool, "size") else None,
        "checked_out": engine.pool.checkedout() if hasattr(engine.pool, "checkedout") else None,
    }


class DatabaseManager:
    """
    Database manager for handling connections and transactions.
    """

    def __init__(self):
        self.engine = engine
        self.SessionLocal = SessionLocal

    def get_session(self):
        """
        Get a database session.
        """
        return self.SessionLocal()

    def health_check(self) -> bool:
        """
        Check if database is healthy and accessible.
        """
        try:
            with self.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

    def get_stats(self) -> dict:
        """
        Get database statistics.
        """
        try:
            pool = self.engine.pool
            return {
                "pool_size": pool.size(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow(),
                "invalid": pool.invalid(),
            }
        except Exception as e:
            logger.error(f"Failed to get database stats: {e}")
            return {}


# Global database manager instance
db_manager = DatabaseManager()


def init_database():
    """
    Initialize database on application startup.
    """
    try:
        logger.info("Initializing database...")

        # Import all models to ensure they are registered with Base metadata
        # This is done here to avoid circular imports
        _import_all_models()

        # Test connection
        if not db_manager.health_check():
            raise Exception("Database health check failed")

        # Schema is managed by Alembic (entrypoint.sh runs `alembic upgrade head`).

        logger.info("Database initialized successfully")

    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise


def _import_all_models():
    """Import all models to register them with SQLAlchemy metadata."""
    try:
        logger.info("Importing models...")

        # Import all models here to register them
        from app.models import (  # noqa: F401
            ChatPhoto,
            Chore,
            ChoreAssignment,
            ChorePhoto,
            ChoreRun,
            ChoreStep,
            ChoreType,
            ChoreTypeNote,
            Device,
            DeviceGroup,
            FamilySettings,
            Notification,
            Override,
            PasswordReset,
            Points,
            Thread,
            ThreadMessage,
            ThreadRead,
            TimeWindow,
            UsedInvite,
            User,
        )

        logger.info("All models imported successfully")

    except ImportError as e:
        logger.warning(f"Some models could not be imported: {e}")
        raise


def close_database():
    """
    Close database connections on application shutdown.
    """
    try:
        engine.dispose()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error(f"Error closing database connections: {e}")
