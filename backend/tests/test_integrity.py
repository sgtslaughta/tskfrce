"""Integrity fixes: CHECKs, badge/flair/address tables, and the data migration."""

import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest
from app.models.badge import BadgeAward, CustomBadge
from app.models.chat import Thread, ThreadMessage
from app.models.flair import KidFlair
from app.models.gamification import Points, PointsType
from app.models.lock import Device
from app.models.reward import Redemption, Reward
from app.services import badges as bd
from sqlalchemy.exc import IntegrityError

from .conftest import _headers, _make_user  # noqa: F401
from .test_internal_api import BODY, URL, tok

BACKEND = Path(__file__).resolve().parent.parent
OLD, NEW = "b9c0d1e2f3a4", "c9d0e1f2a3b4"


def _rejects(db, row):
    db.add(row)
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


def test_redemption_checks(db, kid):
    rw = Reward(name="Movie", price=5)
    db.add(rw)
    db.flush()
    ok = {"kid_id": kid.id, "cost": 5}
    _rejects(db, Redemption(**ok, kind="bogus", minutes=15))
    _rejects(db, Redemption(**ok, kind="reward", reward_id=rw.id, status="bogus"))
    _rejects(db, Redemption(**ok, kind="reward"))  # reward needs reward_id
    _rejects(db, Redemption(**ok, kind="screen_time"))  # screen time needs minutes
    _rejects(db, Redemption(**ok, kind="screen_time", minutes=15, reward_id=rw.id))
    db.add(Redemption(**ok, kind="screen_time", minutes=15))
    db.flush()


def test_thread_and_message_checks(db, kid):
    _rejects(db, Thread(kind="bogus"))
    _rejects(db, Thread(kind="chore"))  # chore threads need a run
    _rejects(db, Thread(kind="private"))  # private threads need a kid
    t = Thread(kind="family")
    db.add(t)
    db.commit()
    _rejects(db, ThreadMessage(thread_id=t.id, kind="bogus"))
    db.add(ThreadMessage(thread_id=t.id, kind="system"))
    db.flush()


def test_points_reason_check(db, kid):
    pt = PointsType.BONUS
    _rejects(db, Points(user_id=kid.id, points_type=pt, amount=1, reason="bogus"))
    db.add(Points(user_id=kid.id, points_type=pt, amount=1, reason="bonus"))
    db.flush()


def test_flair_slot_check(db, kid):
    _rejects(db, KidFlair(kid_id=kid.id, slot="bogus", item_id="x"))


def test_badge_award_needs_exactly_one(db, kid):
    cb = CustomBadge(name="Walker", icon="x")
    db.add(cb)
    db.flush()
    _rejects(db, BadgeAward(kid_id=kid.id, tier=1))
    _rejects(db, BadgeAward(kid_id=kid.id, tier=1, badge_key="first_blood", custom_badge_id=cb.id))


def test_redemptions_status_filter_validated(client, parent_headers):
    assert client.get("/api/v1/redemptions?status=bogus", headers=parent_headers).status_code == 422
    assert (
        client.get("/api/v1/redemptions?status=denied", headers=parent_headers).status_code == 200
    )


def test_custom_badge_award_survives_deactivation(client, db, kid, parent_headers):
    bid = client.post(
        "/api/v1/custom-badges", json={"name": "Walker", "icon": "🐕"}, headers=parent_headers
    ).json()["id"]
    client.post(
        f"/api/v1/custom-badges/{bid}/award", json={"kid_id": kid.id}, headers=parent_headers
    )
    a = db.query(BadgeAward).one()
    assert a.custom_badge_id == bid and a.badge_key is None
    client.delete(f"/api/v1/custom-badges/{bid}", headers=parent_headers)
    shown = bd.badges_for(db, kid.id)
    assert shown[0]["name"] == "Walker" and shown[0]["key"] == f"custom:{bid}"


def test_flair_put_round_trips_via_table(client, db, kid, kid_headers):
    r = client.put(
        "/api/v1/kid/flair", json={"slot": "title", "id": "title-basic"}, headers=kid_headers
    )
    assert r.status_code == 200
    assert db.query(KidFlair.slot, KidFlair.item_id).all() == [("title", "title-basic")]
    got = client.get("/api/v1/kid/flair", headers=kid_headers).json()["equipped"]
    assert got["title"] == "title-basic"


def test_seen_replaces_ipv6_rows_and_kid_lookup(client, db):
    body = {**BODY, "ipv6": ["fe80::1", "fe80::2"]}
    client.post(URL, json=body, headers=tok())
    client.post(URL, json={**BODY, "ipv6": ["fe80::2", "fe80::3"]}, headers=tok())
    db.expire_all()
    dev = db.query(Device).one()
    assert sorted(dev.ipv6) == ["fe80::2", "fe80::3"]
    from app.api.kid import request_device

    assert request_device(db, "fe80::3").id == dev.id
    assert request_device(db, "fe80::1") is None


def test_deleting_device_removes_addresses(db):
    d = Device(mac="aa:bb:cc:dd:ee:09", name="x")
    d.ipv6 = ["fe80::9"]
    db.add(d)
    db.commit()
    db.delete(d)
    db.commit()
    assert (
        db.execute(__import__("sqlalchemy").text("SELECT count(*) FROM device_ipv6")).scalar() == 0
    )


def _alembic(url: str, rev: str) -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", rev],
        cwd=BACKEND,
        env={**os.environ, "DATABASE_URL": url},
        check=True,
        capture_output=True,
    )


def test_migration_carries_values_over(tmp_path):
    path = tmp_path / "m.db"
    url = f"sqlite:///{path}"
    _alembic(url, OLD)
    c = sqlite3.connect(path)
    c.execute(
        "INSERT INTO users (id, username, email, hashed_password, role, flair) VALUES"
        " (1,'ann','a@x.io','x','KID',?)",
        (json.dumps({"card": "card-grid", "bogus": "x"}),),
    )
    c.execute(
        "INSERT INTO custom_badges (id, name, icon, description, active) VALUES (7,'W','x','',1)"
    )
    c.executemany(
        "INSERT INTO badge_awards (kid_id, badge_key, tier, seen_by_kid) VALUES (1,?,?,0)",
        [("custom:7", 2), ("custom:99", 1), ("first_blood", 1)],
    )
    c.execute(
        "INSERT INTO devices (id, mac, name, status, first_seen, ipv6) VALUES"
        " (1,'aa:bb:cc:dd:ee:01','d','assigned','2026-01-01',?)",
        (json.dumps(["fe80::1", "fe80::2"]),),
    )
    c.executemany(
        "INSERT INTO points (user_id, points_type, amount, description, reference_id,"
        " reference_type) VALUES (1,?,?,?,NULL,NULL)",
        [
            ("TASK_COMPLETION", 5, "Dishes"),
            ("BONUS", 2, "Early bonus: Dishes"),
            ("BONUS", 3, "Great job"),
            ("REDEMPTION", -4, "Reward"),
            ("PENALTY", -1, "oops"),
        ],
    )
    c.execute("INSERT INTO threads (kind) VALUES ('chore')")  # points at nothing: dropped
    c.execute("INSERT INTO threads (kind) VALUES ('family')")
    c.commit()
    c.close()

    _alembic(url, NEW)
    c = sqlite3.connect(path)
    assert c.execute(
        "SELECT badge_key, custom_badge_id, tier FROM badge_awards ORDER BY id"
    ).fetchall() == [
        (None, 7, 2),
        ("first_blood", None, 1),
    ]
    assert c.execute("SELECT kid_id, slot, item_id FROM kid_flair").fetchall() == [
        (1, "card", "card-grid")
    ]
    assert c.execute("SELECT address FROM device_ipv6 ORDER BY address").fetchall() == [
        ("fe80::1",),
        ("fe80::2",),
    ]
    assert [r[0] for r in c.execute("SELECT reason FROM points ORDER BY id")] == [
        "chore",
        "early_bonus",
        "bonus",
        "redemption",
        "adjustment",
    ]
    assert c.execute("SELECT kind FROM threads").fetchall() == [("family",)]
    cols = {r[1] for r in c.execute("PRAGMA table_info(points)")}
    assert not cols & {"reference_id", "reference_type"}
    assert "flair" not in {r[1] for r in c.execute("PRAGMA table_info(users)")}
    assert "ipv6" not in {r[1] for r in c.execute("PRAGMA table_info(devices)")}
