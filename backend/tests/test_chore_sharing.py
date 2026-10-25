from datetime import date

from app.models.chores import ChoreRun
from app.models.family import get_family
from app.models.points import Points
from app.models.user import UserRole
from app.services import chores as svc

from tests.conftest import _headers, _make_user
from tests.factories import api_chore

DAY = date(2026, 10, 20)


def _setup(db):
    get_family(db).last_reset_date = DAY
    db.commit()
    a = _make_user(db, "leo", UserRole.KID)
    b = _make_user(db, "maya", UserRole.KID)
    return a, b, _headers(db, a), _headers(db, b)


def _create(client, ph, kids, mode, **kw):
    return api_chore(client, ph, kids, mode, **kw)


def _chores(client, h):
    return client.get("/api/v1/kid/today", headers=h).json()["chores"]


def _pts(db, kid):
    rows = db.query(Points).filter(Points.user_id == kid.id).all()
    return sum(p.amount for p in rows)


def test_each_makes_one_instance_per_kid(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _create(client, parent_headers, [a, b], "each")
    assert len(_chores(client, ha)) == 1 and len(_chores(client, hb)) == 1
    assert db.query(ChoreRun).count() == 2


def test_each_next_reset_makes_two(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _create(client, parent_headers, [a, b], "each")
    assert svc.run_reset(db, date(2026, 10, 21)) == 2


def test_race_one_shared_instance_winner_gets_points(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _create(client, parent_headers, [a, b], "race")
    assert (
        client.get("/api/v1/chores/today", headers=parent_headers).json()[str(a.id)][0]["mode"]
        == "race"
    )
    assert len(_chores(client, ha)) == 1 and len(_chores(client, hb)) == 1
    cid = _chores(client, hb)[0]["id"]
    assert client.post(f"/api/v1/kid/chores/{cid}/done", headers=hb).status_code == 200
    r = client.post(f"/api/v1/chores/{cid}/approve", headers=parent_headers)
    assert r.status_code == 200
    assert _pts(db, b) == 25 and _pts(db, a) == 0
    # the loser is not held offline by it
    assert svc.counts(db, a.id, DAY) == (1, 1)
    assert _chores(client, ha)[0]["state"] == "done"


def test_race_reopen_for_all(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _create(client, parent_headers, [a, b], "race")
    cid = _chores(client, hb)[0]["id"]
    client.post(f"/api/v1/kid/chores/{cid}/done", headers=hb)
    t = db.get(ChoreRun, cid)
    assert t.submitted_by_id == b.id
    t.status, t.submitted_by_id = "todo", None
    db.commit()
    assert _chores(client, ha)[0]["state"] == "todo"
    assert client.post(f"/api/v1/kid/chores/{cid}/done", headers=ha).status_code == 200
    assert db.get(ChoreRun, cid).submitted_by_id == a.id


def test_team_splits_points_once(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _create(client, parent_headers, [a, b], "team")
    cid = _chores(client, ha)[0]["id"]
    client.post(f"/api/v1/kid/chores/{cid}/done", headers=ha)
    assert client.post(f"/api/v1/chores/{cid}/approve", headers=parent_headers).status_code == 200
    assert _pts(db, a) == 12 and _pts(db, b) == 12
    again = client.post(f"/api/v1/chores/{cid}/approve", headers=parent_headers)
    assert again.status_code == 409
    assert db.query(Points).count() == 2


def test_single_kid_race_is_stored_as_each(client, db, kid, parent_headers):
    get_family(db).last_reset_date = DAY
    db.commit()
    _, asg = _create(client, parent_headers, [kid], "race")
    assert asg["kid_ids"] == [kid.id] and asg["mode"] == "each"
    assert db.query(ChoreRun).filter(ChoreRun.kid_id == kid.id).count() == 1


def test_assignment_needs_a_kid(client, db, parent_headers):
    chore = client.post("/api/v1/chores/", json={"title": "x"}, headers=parent_headers).json()
    url = f"/api/v1/chores/{chore['id']}/assignments"
    body = {"kid_ids": [], "repeat": {"type": "daily"}}
    assert client.post(url, json=body, headers=parent_headers).status_code == 422


def test_chore_edit_reaches_every_run(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    chore, _ = _create(client, parent_headers, [a, b], "each")
    ids = [c["id"] for c in _chores(client, ha) + _chores(client, hb)]
    client.post(f"/api/v1/kid/chores/{ids[0]}/done", headers=ha)
    r = client.patch(
        f"/api/v1/chores/{chore['id']}",
        json={"title": "Bins", "points": 5, "steps": ["a"]},
        headers=parent_headers,
    )
    assert r.status_code == 200 and r.json()["title"] == "Bins"
    assert [s["title"] for s in r.json()["steps"]] == ["a"]
    assert _chores(client, ha)[0]["title"] == "Bins" and _chores(client, ha)[0]["points"] == 5
    assert _chores(client, hb)[0]["title"] == "Bins"
    assert db.get(ChoreRun, ids[0]).status == "submitted"  # submission stands


def test_patch_assignment_kids_applies_now_and_next_reset(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _, asg = _create(client, parent_headers, [a], "each")
    r = client.patch(
        f"/api/v1/assignments/{asg['id']}",
        json={"kid_ids": [a.id, b.id]},
        headers=parent_headers,
    )
    assert r.status_code == 200 and r.json()["kid_ids"] == [a.id, b.id]
    assert db.query(ChoreRun).count() == 2  # b joins today
    assert svc.run_reset(db, date(2026, 10, 21)) == 2
    assert (
        client.patch(
            f"/api/v1/assignments/{asg['id']}", json={"kid_ids": []}, headers=parent_headers
        ).status_code
        == 422
    )


def test_create_rejects_non_kid(client, db, parent, parent_headers):
    chore = client.post("/api/v1/chores/", json={"title": "x"}, headers=parent_headers).json()
    r = client.post(
        f"/api/v1/chores/{chore['id']}/assignments",
        json={"repeat": {"type": "daily"}, "kid_ids": [parent.id]},
        headers=parent_headers,
    )
    assert r.status_code == 404


def test_kid_today_extras_and_taken_by(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _create(client, parent_headers, [a, b], "race", steps=["x"], needs_photo=True)
    c = _chores(client, ha)[0]
    assert (c["mode"], c["needs_photo"], c["photo_count_current"]) == ("race", True, 0)
    (st,) = c["subtasks"]
    assert (st["title"], st["done"], st["locked"], st["after_previous"]) == (
        "x",
        False,
        False,
        False,
    )
    assert c["taken_by"] is None and c["last_note"] is None
    t = db.get(ChoreRun, c["id"])
    t.submitted_by_id = b.id
    db.commit()
    assert _chores(client, ha)[0]["taken_by"] == "Maya"
    assert _chores(client, hb)[0]["taken_by"] is None
