"""Migration A: time_windows -> hour_rules, plus device activity tables."""

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
PREV = "k4d5e6f7a8b9"
A = "p0d1e2f3a4b5"
B = "p1d2e3f4a5b6"


def alembic(url, *args):
    subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND,
        env={**os.environ, "DATABASE_URL": url},
        check=True,
    )


@pytest.fixture
def old_db(tmp_path):
    path = tmp_path / "mig.db"
    url = f"sqlite:///{path}"
    alembic(url, "upgrade", PREV)
    con = sqlite3.connect(path)
    for i, name in ((1, "a"), (2, "b")):
        con.execute(
            "INSERT INTO users (id, username, email, hashed_password, role) "
            "VALUES (?, ?, ?, 'x', 'KID')",
            (i, name, f"{name}@x.io"),
        )
    con.execute("INSERT INTO device_groups (id, name) VALUES (1, 'G')")
    con.execute(
        "INSERT INTO devices (mac, name, status, first_seen) "
        "VALUES ('aa:bb:cc:dd:ee:ff', 'Tab', 'assigned', '2026-01-01')"
    )
    rows = [
        ("allowed", "0123456", "07:00", "21:00", 1, None),
        ("allowed", "0123456", "07:00", "21:00", 2, None),
        ("free", "45", "10:00", "12:00", 1, None),
        ("allowed", "01236", "06:00", "08:00", None, 1),
        ("allowed", "01236", "15:00", "20:00", None, 1),
    ]
    con.executemany(
        "INSERT INTO time_windows (kind, days, start, end, kid_id, group_id) VALUES (?,?,?,?,?,?)",
        rows,
    )
    con.commit()
    con.close()
    return path, url


def test_migration_merges_windows(old_db):
    path, url = old_db
    alembic(url, "upgrade", A)
    con = sqlite3.connect(path)
    rules = con.execute(
        "SELECT id, name, category, kind, days, everyone FROM hour_rules ORDER BY id"
    ).fetchall()
    assert [r[1:] for r in rules] == [
        ("Online hours", "other", "allowed", "0123456", 0),
        ("Weekends", "weekend", "free", "45", 0),
        ("School nights", "school_night", "allowed", "01236", 0),
    ]

    def targets(rid):
        return (
            {
                r[0]
                for r in con.execute(
                    "SELECT kid_id FROM hour_rule_targets WHERE rule_id=? AND kid_id IS NOT NULL",
                    (rid,),
                )
            },
            {
                r[0]
                for r in con.execute(
                    "SELECT group_id FROM hour_rule_targets WHERE rule_id=? AND group_id IS NOT NULL",
                    (rid,),
                )
            },
        )

    def times(rid):
        return con.execute(
            "SELECT start, end FROM hour_rule_times WHERE rule_id=? ORDER BY start", (rid,)
        ).fetchall()

    ids = [r[0] for r in rules]
    assert targets(ids[0]) == ({1, 2}, set())
    assert times(ids[0]) == [("07:00", "21:00")]
    assert targets(ids[1]) == ({1}, set())
    assert times(ids[1]) == [("10:00", "12:00")]
    assert targets(ids[2]) == (set(), {1})
    assert times(ids[2]) == [("06:00", "08:00"), ("15:00", "20:00")]
    assert con.execute("SELECT count(*) FROM time_windows").fetchone()[0] == 5
    assert con.execute("SELECT exempt, blocked_since FROM devices").fetchall() == [(0, None)]
    assert con.execute("SELECT icon, chore_lock FROM device_groups").fetchall() == [("devices", 1)]
    assert con.execute("SELECT chores_lock FROM family_settings").fetchall() in ([], [(1,)])
    con.close()


def test_downgrade_a_drops_rules(old_db):
    path, url = old_db
    alembic(url, "upgrade", A)
    alembic(url, "downgrade", PREV)
    con = sqlite3.connect(path)
    tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert not tables & {
        "hour_rules",
        "hour_rule_times",
        "hour_rule_targets",
        "device_events",
        "device_presence",
    }
    assert "exempt" not in {r[1] for r in con.execute("PRAGMA table_info(devices)")}
    assert "icon" not in {r[1] for r in con.execute("PRAGMA table_info(device_groups)")}
    assert "chores_lock" not in {r[1] for r in con.execute("PRAGMA table_info(family_settings)")}
    assert con.execute("SELECT count(*) FROM time_windows").fetchone()[0] == 5
    con.close()


def _window_set(con):
    return {
        tuple(r)
        for r in con.execute('SELECT kind, days, start, "end", kid_id, group_id FROM time_windows')
    }


def test_drop_and_restore_windows(old_db):
    path, url = old_db
    con = sqlite3.connect(path)
    original = _window_set(con)
    con.close()
    alembic(url, "upgrade", "head")
    con = sqlite3.connect(path)
    tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert "time_windows" not in tables
    assert con.execute("SELECT count(*) FROM hour_rules").fetchone()[0] == 3
    con.close()
    alembic(url, "downgrade", A)
    con = sqlite3.connect(path)
    assert len(original) == 5 and _window_set(con) == original
    con.close()
