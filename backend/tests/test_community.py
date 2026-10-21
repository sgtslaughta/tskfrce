from datetime import UTC, datetime

from app.models.family import get_family
from app.models.gamification import Points, PointsType
from app.models.user import UserRole
from app.services import progression as pr

from tests.conftest import _headers, _make_user


def _pts(db, kid, amount, when, kind=PointsType.TASK_COMPLETION):
    db.add(Points(user_id=kid.id, points_type=kind, amount=amount, created_at=when))
    db.commit()


def _setup(db):
    fam = get_family(db)
    fam.timezone = "America/Chicago"
    db.commit()
    return fam


def test_week_boundary_chicago(db):
    fam = _setup(db)
    kid = _make_user(db, "leo", UserRole.KID)
    # Sun 2026-10-18 23:30 CDT = Mon 04:30 UTC; Mon 2026-10-19 00:10 CDT = 05:10 UTC
    _pts(db, kid, 10, datetime(2026, 10, 19, 4, 30))
    _pts(db, kid, 7, datetime(2026, 10, 19, 5, 10))
    old = pr.leaderboard(db, fam, datetime(2026, 10, 18, 12, 0, tzinfo=UTC))
    new = pr.leaderboard(db, fam, datetime(2026, 10, 20, 12, 0, tzinfo=UTC))
    assert old["week_start"] == "2026-10-12" and old["rows"][0]["score"] == 10
    assert new["week_start"] == "2026-10-19" and new["rows"][0]["score"] == 7


def test_spending_ignored_and_ties_share_rank(db):
    fam = _setup(db)
    a = _make_user(db, "amy", UserRole.KID)
    b = _make_user(db, "ben", UserRole.KID)
    c = _make_user(db, "cal", UserRole.KID)
    when = datetime(2026, 10, 20, 15, 0)
    _pts(db, a, 20, when)
    _pts(db, a, -15, when, PointsType.REDEMPTION)
    _pts(db, b, 20, when)
    rows = pr.leaderboard(db, fam, datetime(2026, 10, 20, 16, 0, tzinfo=UTC))["rows"]
    assert [(r["name"], r["score"], r["rank"]) for r in rows] == [
        ("Amy", 20, 1),
        ("Ben", 20, 1),
        ("Cal", 0, 3),
    ]
    assert {"level", "title", "avatar", "kid_id"} <= rows[0].keys()
    assert c.id in [r["kid_id"] for r in rows]


def test_kid_sees_siblings_without_private_data(client, db):
    _setup(db)
    leo = _make_user(db, "leo", UserRole.KID)
    amy = _make_user(db, "amy", UserRole.KID)
    h = _headers(db, leo)
    r = client.get("/api/v1/profiles", headers=h)
    assert r.status_code == 200 and len(r.json()) == 2
    one = client.get(f"/api/v1/profiles/{amy.id}", headers=h).json()
    assert one["kid_id"] == amy.id and "streak" in one and "badges" in one
    for body in (one, *r.json()):
        assert not {"points_balance", "chores", "devices", "requests"} & body.keys()
    assert client.get("/api/v1/leaderboard", headers=h).status_code == 200


def test_profile_404_and_unauth(client, db, parent):
    _setup(db)
    assert client.get("/api/v1/profiles/999", headers=_headers(db, parent)).status_code == 404
    assert client.get("/api/v1/leaderboard").status_code == 401
    assert client.get("/api/v1/profiles").status_code == 401
