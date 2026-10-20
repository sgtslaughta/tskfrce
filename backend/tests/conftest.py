"""Shared pytest fixtures: in-memory SQLite and an in-process API client."""

import os
import tempfile

# Keep generated secrets/db out of the real ./data (must precede app imports)
os.environ.setdefault("DATA_DIR", tempfile.mkdtemp(prefix="task4ce-test-"))

import pytest  # noqa: E402
from app.api.deps import get_db  # noqa: E402
from app.core.database import Base, _import_all_models, get_db_session  # noqa: E402
from app.main import app, fastapi_app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402


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
