"""Shared pytest fixtures: in-memory SQLite and an in-process API client."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.database import Base, _import_all_models
from app.db.session import get_db_session
from app.main import app, fastapi_app


@pytest.fixture
def db():
    """Fresh in-memory SQLite session per test."""
    _import_all_models()
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def client(db):
    """TestClient whose DB dependencies yield the test session."""

    def override():
        yield db

    fastapi_app.dependency_overrides[get_db] = override
    fastapi_app.dependency_overrides[get_db_session] = override
    try:
        yield TestClient(app, base_url="http://localhost")
    finally:
        fastapi_app.dependency_overrides.clear()
