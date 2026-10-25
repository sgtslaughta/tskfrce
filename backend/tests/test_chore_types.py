"""Chore types: seeded by the migration and backfilled onto existing chores."""

import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, text

BACKEND = Path(__file__).resolve().parent.parent

SEEDED = [
    ("Cleaning", "cleaning_services"),
    ("Schoolwork", "school"),
    ("Pets", "pets"),
    ("Kitchen", "restaurant"),
    ("Outdoor", "yard"),
    ("Practice", "music_note"),
    ("Personal", "self_care"),
    ("Other", "task_alt"),
]


def _alembic(url, rev):
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", rev],
        cwd=BACKEND,
        env={**os.environ, "DATABASE_URL": url},
        check=True,
    )


def test_seeded_types(tmp_path):
    url = f"sqlite:///{tmp_path / 'm.db'}"
    _alembic(url, "head")
    with create_engine(url).connect() as c:
        rows = c.execute(text("SELECT name, glyph FROM chore_types ORDER BY position")).all()
        assert [tuple(r) for r in rows] == SEEDED
        assert c.execute(text("SELECT count(*) FROM chore_type_notes")).scalar() == 19


def test_backfill_type_by_title(tmp_path):
    url = f"sqlite:///{tmp_path / 'm.db'}"
    _alembic(url, "g9c0d1e2f3g4")
    eng = create_engine(url)
    with eng.begin() as c:
        c.execute(
            text(
                "INSERT INTO users (id, username, email, hashed_password, full_name, role)"
                " VALUES (1, 'p', 'p@x', 'x', 'P', 'PARENT')"
            )
        )
        for i, t in enumerate(["Feed the dog", "Unload dishwasher", "Mystery"], 1):
            c.execute(
                text(
                    "INSERT INTO chores (id, title, points, needs_photo, created_by_id)"
                    " VALUES (:i, :t, 10, 0, 1)"
                ),
                {"i": i, "t": t},
            )
    _alembic(url, "head")
    with eng.connect() as c:
        got = c.execute(
            text(
                "SELECT c.title, t.name FROM chores c JOIN chore_types t ON t.id=c.type_id"
                " ORDER BY c.id"
            )
        ).all()
    assert [tuple(r) for r in got] == [
        ("Feed the dog", "Pets"),
        ("Unload dishwasher", "Kitchen"),
        ("Mystery", "Other"),
    ]


def test_seed_matches_expected():
    from app.services.chore_types import SEED

    assert [(n, g) for n, g, _ in SEED] == SEEDED
    assert sum(len(notes) for _, _, notes in SEED) == 19


def test_other_id_survives_rename(db):
    from app.models.chore_type import ChoreType
    from app.services.chore_types import other_id

    oid = other_id(db)
    db.query(ChoreType).filter_by(id=oid).update({"name": "Misc"})
    db.commit()
    assert other_id(db) == oid
    assert db.get(ChoreType, oid).glyph == "task_alt"
