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


def test_list_types_with_universal_free(client, parent_headers):
    from app.services.chore_types import UNIVERSAL, notes_for

    r = client.get("/api/v1/chore-types", headers=parent_headers)
    types = r.json()
    assert len(types) == 8 and types[0]["name"] == "Cleaning"
    assert [n["label"] for n in types[0]["notes"]] == [
        "Out of supplies",
        "Did part of it",
        "Too messy for one go",
    ]
    labels = {n["label"] for t in types for n in t["notes"]}
    assert not labels & {u[0] for u in UNIVERSAL}
    assert len(UNIVERSAL) == 3 and notes_for.__name__ == "notes_for"


def test_notes_for_puts_universal_last(db):
    from app.models.chore_type import ChoreType
    from app.services.chore_types import notes_for

    notes = notes_for(db.query(ChoreType).filter_by(name="Personal").one())
    assert [(n["label"], n["universal"]) for n in notes] == [
        ("Don't feel well", False),
        ("Need help", True),
        ("Ran out of time", True),
        ("Can't do it today", True),
    ]


def test_create_rename_reorder_notes(client, parent_headers):
    h = parent_headers
    r = client.post(
        "/api/v1/chore-types",
        json={"name": "Garden", "glyph": "eco", "notes": ["a", "b"]},
        headers=h,
    )
    assert r.status_code == 200
    t = r.json()
    assert (t["builtin"], t["chore_count"]) == (False, 0)
    assert [(n["label"], n["glyph"]) for n in t["notes"]] == [("a", "eco"), ("b", "eco")]
    dup = client.post("/api/v1/chore-types", json={"name": "garden", "glyph": "x"}, headers=h)
    assert (dup.status_code, dup.json()["detail"]) == (409, "There's already a type called garden.")
    r = client.patch(
        f"/api/v1/chore-types/{t['id']}", json={"name": "Yard work", "notes": ["b", "a"]}, headers=h
    )
    assert r.json()["name"] == "Yard work"
    assert [n["label"] for n in r.json()["notes"]] == ["b", "a"]
    assert client.get("/api/v1/chore-types", headers=h).json()[-1]["id"] == t["id"]
    too_many = {"name": "X", "glyph": "x", "notes": ["n"] * 9}
    assert client.post("/api/v1/chore-types", json=too_many, headers=h).status_code == 422


def test_delete_type_rules(client, db, parent_headers):
    from app.models.chores import Chore
    from app.services.chore_types import other_id

    h = parent_headers
    t = client.post(
        "/api/v1/chore-types", json={"name": "Garden", "glyph": "eco"}, headers=h
    ).json()
    c = client.post("/api/v1/chores/", json={"title": "Weed", "type_id": t["id"]}, headers=h).json()
    assert c["type_id"] == t["id"]
    assert client.delete(f"/api/v1/chore-types/{t['id']}", headers=h).status_code == 204
    db.expire_all()
    assert db.get(Chore, c["id"]).type_id == other_id(db)
    builtin = client.get("/api/v1/chore-types", headers=h).json()[0]
    r = client.delete(f"/api/v1/chore-types/{builtin['id']}", headers=h)
    assert r.status_code == 409
    assert r.json()["detail"] == "Built-in types can't be deleted. Rename it instead."


def test_kid_cannot_edit_types(client, kid_headers):
    assert client.get("/api/v1/chore-types", headers=kid_headers).status_code == 403
    r = client.post("/api/v1/chore-types", json={"name": "X", "glyph": "x"}, headers=kid_headers)
    assert r.status_code == 403
    assert client.delete("/api/v1/chore-types/1", headers=kid_headers).status_code == 403
