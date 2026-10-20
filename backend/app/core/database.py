"""
Database configuration and session management.

This module handles SQLAlchemy database configuration, connection pooling,
and session management for the TaaskMaaster application.
"""

import os
from typing import Any
from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Database URL configuration
DATABASE_URL = settings.DATABASE_URL

# Create SQLAlchemy engine
if DATABASE_URL.startswith("sqlite"):
    # SQLite configuration
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=settings.DEBUG
    )
else:
    # PostgreSQL/MySQL configuration
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=10,
        max_overflow=20,
        echo=settings.DEBUG
    )

# Create SessionLocal class
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Create declarative base
Base = declarative_base()

# Metadata for migrations
metadata = MetaData()


def create_database():
    """
    Create database tables.
    """
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise


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
        "pool_size": engine.pool.size() if hasattr(engine.pool, 'size') else None,
        "checked_out": engine.pool.checkedout() if hasattr(engine.pool, 'checkedout') else None,
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
        
        # Create tables if they don't exist
        create_database()
        
        logger.info("Database initialized successfully")
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise


def _import_all_models():
    """Import all models to register them with SQLAlchemy metadata."""
    try:
        logger.info("Importing models...")
        
        # Import all models here to register them
        from app.models import (
            User, Task, TaskTemplate, TaskCategory, TaskTag, TaskDependency,
            Goal, GoalProgress, Achievement, UserAchievement, Points, Leaderboard,
            MediaAttachment, TaskComment, CommentReaction, CommentMention,
            DirectMessage, MessageReaction, Conversation, ConversationSettings
        )
        
        # Import additional models that might exist
        try:
            from app.models import CommentAuditTrail, TaskStatusHistory, UserStatus
        except ImportError:
            logger.info("Optional models (CommentAuditTrail, TaskStatusHistory, UserStatus) not found, skipping")
            
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
