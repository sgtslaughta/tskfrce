"""
Database session management for TaaskMaaster.

This module handles SQLAlchemy session creation, configuration,
and dependency injection for FastAPI.
"""

from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

from .config import get_database_settings, get_database_url

# Create database engine
settings = get_database_settings()
engine = create_engine(
    get_database_url(),
    pool_size=settings.pool_size,
    max_overflow=settings.max_overflow,
    pool_timeout=settings.pool_timeout,
    pool_recycle=settings.pool_recycle,
    echo=False,  # Set to True for SQL query logging
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create declarative base
Base = declarative_base()


def get_db_session() -> Generator[Session, None, None]:
    """
    Database session dependency for FastAPI.

    Yields:
        SQLAlchemy session instance
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all database tables."""
    Base.metadata.create_all(bind=engine)


def drop_tables():
    """Drop all database tables."""
    Base.metadata.drop_all(bind=engine)
