from datetime import date, datetime

from app.models.family import get_family
from app.models.points import Points, PointsType
from app.services.economy import bonus_for, deadline_utc

from tests.factories import make_run

D = datetime(2026, 10, 21, 17, 0)


def test_bonus_for():
    assert bonus_for(datetime(2026, 10, 21, 15, 59), D, 6) == 6
    assert bonus_for(datetime(2026, 10, 21, 16, 30), D, 6) == 3
    assert bonus_for(D, D, 6) == 3
    assert bonus_for(datetime(2026, 10, 21, 17, 1), D, 6) == 0
    assert bonus_for(D, None, 6) == 0
    assert bonus_for(datetime(2026, 10, 21, 15, 0), D, 0) == 0


def test_deadline_uses_family_timezone(db):
    fam = get_family(db)
    fam.timezone = "America/New_York"
    assert deadline_utc(fam, date(2026, 10, 21), "17:00") == datetime(2026, 10, 21, 21, 0)
    assert deadline_utc(fam, date(2026, 10, 21), None) is None


def test_deadline_before_reset_ends_the_chore_day(db):
    """The chore day runs reset to reset: 05:15 with a 06:00 reset is the next morning."""
    fam = get_family(db)
    fam.timezone, fam.reset_time = "UTC", "06:00"
    assert deadline_utc(fam, date(2026, 10, 27), "05:15") == datetime(2026, 10, 28, 5, 15)
    assert deadline_utc(fam, date(2026, 10, 27), "06:00") == datetime(2026, 10, 27, 6, 0)
    assert deadline_utc(fam, date(2026, 10, 27), "23:00") == datetime(2026, 10, 27, 23, 0)


def _submitted(db, parent, kid, due_time=None, at=None, points=15):
    return make_run(
        db,
        parent,
        kid,
        status="submitted",
        day=date(2026, 10, 21),
        submitted_at=at or datetime(2026, 10, 21, 12, 0),
        points=points,
        due_time=due_time,
    )


def _rows(db, kid):
    return db.query(Points).filter(Points.user_id == kid.id).all()


def test_approve_awards_points_once(client, db, parent, kid, parent_headers, kid_headers):
    t = _submitted(db, parent, kid)
    url = f"/api/v1/chores/{t.id}/approve"
    assert client.post(url, headers=parent_headers).status_code == 200
    rows = _rows(db, kid)
    assert [(r.points_type, r.amount) for r in rows] == [(PointsType.TASK_COMPLETION, 15)]
    assert rows[0].run_id == t.id
    assert client.get("/api/v1/kid/today", headers=kid_headers).json()["points_balance"] == 15
    assert client.post(url, headers=parent_headers).status_code == 409
    assert len(_rows(db, kid)) == 1


def test_approve_awards_capped_bonus(client, db, parent, kid, parent_headers, kid_headers):
    t = _submitted(db, parent, kid, due_time="17:00", at=datetime(2026, 10, 21, 15, 0))
    client.post(f"/api/v1/chores/{t.id}/approve", headers=parent_headers)
    types = sorted(r.points_type.value for r in _rows(db, kid))
    assert types == ["bonus", "task_completion"]
    assert client.get("/api/v1/kid/today", headers=kid_headers).json()["points_balance"] == 20


def test_family_settings_roundtrip(client, parent_headers):
    r = client.patch(
        "/api/v1/family",
        json={"early_bonus_cap": 8, "screen_time_price": 30},
        headers=parent_headers,
    )
    assert r.status_code == 200
    j = client.get("/api/v1/family", headers=parent_headers).json()
    assert (j["early_bonus_cap"], j["screen_time_price"]) == (8, 30)
    bad = client.patch("/api/v1/family", json={"early_bonus_cap": 51}, headers=parent_headers)
    assert bad.status_code == 422


def test_points_come_from_the_chore_at_approval(client, db, parent, kid, parent_headers):
    t = _submitted(db, parent, kid)
    t.assignment.chore.points = 40  # edited while the run was waiting
    db.commit()
    client.post(f"/api/v1/chores/{t.id}/approve", headers=parent_headers)
    assert [r.amount for r in _rows(db, kid)] == [40]
