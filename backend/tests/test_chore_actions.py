from datetime import date, timedelta

from app.models.chores import ChoreRun
from app.models.family import get_family
from app.models.user import UserRole
from app.services import chores as svc
from app.services import progression

from tests.conftest import _make_user
from tests.factories import api_chore

DAY = date(2026, 10, 20)
KID_TODAY = "/api/v1/today"


def _setup(db, client, ph, repeat, n=1):
    get_family(db).last_reset_date = DAY
    db.commit()
    kid = _make_user(db, "leo", UserRole.KID)
    for i in range(n):
        api_chore(client, ph, [kid], repeat=repeat, title=f"Chore {i}")
    return kid, [r.id for r in db.query(ChoreRun).order_by(ChoreRun.id)]


def _kid_row(client, ph):
    return client.get(KID_TODAY, headers=ph).json()["kids"][0]


def test_move_once_chore(client, db, parent_headers):
    _, ids = _setup(db, client, parent_headers, {"type": "once", "on_date": DAY.isoformat()})
    day = svc.today(db)
    c = _kid_row(client, parent_headers)["chores"][0]
    assert c["can_move"] is True
    r = client.post(f"/api/v1/chores/{ids[0]}/move", headers=parent_headers)
    assert r.status_code == 200
    run = db.get(ChoreRun, ids[0])
    assert run.day == day + timedelta(days=1)
    assert _kid_row(client, parent_headers)["chores"] == []
    svc.generate(db, day + timedelta(days=1))
    assert db.query(ChoreRun).count() == 1


def test_move_daily_refused(client, db, parent_headers):
    _, ids = _setup(db, client, parent_headers, {"type": "daily"})
    assert _kid_row(client, parent_headers)["chores"][0]["can_move"] is False
    assert (
        client.get(f"/api/v1/chores/{ids[0]}", headers=parent_headers).json()["can_move"] is False
    )
    r = client.post(f"/api/v1/chores/{ids[0]}/move", headers=parent_headers)
    assert (r.status_code, r.json()["detail"]) == (
        409,
        "It's already on tomorrow's list. Try Skip today.",
    )


def test_skip_keeps_streak_and_unlocks(client, db, parent_headers):
    kid, ids = _setup(db, client, parent_headers, {"type": "daily"}, n=2)
    day = svc.today(db)
    assert client.post(f"/api/v1/chores/{ids[0]}/done", headers=parent_headers).status_code == 200
    assert client.post(f"/api/v1/chores/{ids[1]}/skip", headers=parent_headers).status_code == 200
    k = _kid_row(client, parent_headers)
    assert (k["done"], k["total"]) == (1, 1)
    assert {c["state"] for c in k["chores"]} == {"done", "skipped"}
    assert db.get(ChoreRun, ids[1]).status == "skipped"
    assert progression.chore_days(db, kid.id, day)[day] is True
    svc.run_reset(db, day + timedelta(days=1))
    assert db.get(ChoreRun, ids[1]).status == "skipped"  # not cancelled by reset


def test_undo_skip(client, db, parent_headers):
    _, ids = _setup(db, client, parent_headers, {"type": "daily"})
    client.post(f"/api/v1/chores/{ids[0]}/skip", headers=parent_headers)
    r = client.post(f"/api/v1/chores/{ids[0]}/undo", headers=parent_headers)
    assert r.status_code == 200
    assert db.get(ChoreRun, ids[0]).status == "todo"
    k = _kid_row(client, parent_headers)
    assert (k["done"], k["total"]) == (0, 1)
