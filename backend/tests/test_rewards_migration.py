"""Plan E migration: icon data step, new defaults, screen_time_limits."""

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
PREV = "l5e6f7a8b9c0"


def _alembic(url, target):
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", target],
        cwd=BACKEND,
        env={**os.environ, "DATABASE_URL": url},
        check=True,
    )


def test_icon_migration(tmp_path):
    path = tmp_path / "mig.db"
    url = f"sqlite:///{path}"
    _alembic(url, PREV)
    con = sqlite3.connect(path)
    for i, icon in enumerate(["🛏️", "🍦", "🦄", "star", None]):
        con.execute(
            "INSERT INTO rewards (id, name, price, icon, active) VALUES (?, 'r', 5, ?, 1)",
            (i + 1, icon),
        )
    for i, icon in enumerate(["🏅", "verified"]):
        con.execute(
            "INSERT INTO custom_badges (id, name, icon, description, active)"
            " VALUES (?, 'b', ?, '', 1)",
            (i + 1, icon),
        )
    con.execute(
        "INSERT INTO family_settings (id, name, timezone, reset_time, new_devices_blocked,"
        " points_unlock_early) VALUES (1, 'F', 'UTC', '06:00', 1, 0)"
    )
    con.commit()
    con.close()

    _alembic(url, "head")

    con = sqlite3.connect(path)
    icons = [r[0] for r in con.execute("SELECT icon FROM rewards ORDER BY id")]
    assert icons == ["bedtime", "icecream", "redeem", "star", None]
    assert [r[0] for r in con.execute("SELECT icon FROM custom_badges ORDER BY id")] == [
        "military_tech",
        "verified",
    ]
    assert set(con.execute("SELECT visible, needs_approval FROM rewards")) == {(1, 1)}
    assert con.execute(
        "SELECT screen_only_allowed_hours, screen_auto_approve, screen_max_minutes,"
        " quick_replies FROM family_settings"
    ).fetchone() == (1, 0, None, None)
    assert con.execute("SELECT count(*) FROM screen_time_limits").fetchone() == (0,)
    con.close()
