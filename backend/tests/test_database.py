"""Real file-backed SQLite behavior: pragmas, concurrent setup, error mapping."""

import pytest
from app.core.database import Base, _import_all_models, make_engine
from app.models.family import FamilySettings
from app.models.user import User, UserRole
from sqlalchemy import text, update
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def file_engine(tmp_path):
    _import_all_models()
    eng = make_engine(f"sqlite:///{tmp_path / 't.db'}")
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


def test_file_sqlite_has_wal_and_fk_on(file_engine):
    with file_engine.connect() as c:
        assert c.execute(text("PRAGMA journal_mode")).scalar() == "wal"
        assert c.execute(text("PRAGMA foreign_keys")).scalar() == 1
        assert c.execute(text("PRAGMA busy_timeout")).scalar() == 5000


def _claim(db, name):
    """Mirror of the setup compare-and-set in app/api/setup.py."""
    u = User(username=name, email=f"{name}@x.local", hashed_password="x", role=UserRole.PARENT)
    db.add(u)
    db.flush()
    won = db.execute(
        update(FamilySettings)
        .where(FamilySettings.id == 1, FamilySettings.owner_id.is_(None))
        .values(owner_id=u.id)
    ).rowcount
    return u.id, won


def test_two_sessions_setup_yields_one_owner(file_engine):
    S = sessionmaker(bind=file_engine, autoflush=False)
    with S() as seed:
        seed.add(FamilySettings(id=1))
        seed.commit()
    a, b = S(), S()
    try:
        uid_a, won_a = _claim(a, "a")  # A writes first and holds the write lock
        assert won_a == 1
        a.commit()
        _, won_b = _claim(b, "b")  # B starts after A committed: must lose
        assert won_b == 0
        b.rollback()
    finally:
        a.close()
        b.close()
    with S() as check:
        assert check.get(FamilySettings, 1).owner_id == uid_a
        assert check.query(User).count() == 1
