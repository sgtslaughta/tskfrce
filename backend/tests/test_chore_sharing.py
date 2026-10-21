from datetime import date

from app.lock.reset import chore_counts, run_reset
from app.models.family import get_family
from app.models.gamification import Points
from app.models.task import Task, TaskStatus
from app.models.user import UserRole

from tests.conftest import _headers, _make_user

DAY = date(2026, 10, 20)


def _setup(db):
    get_family(db).last_reset_date = DAY
    db.commit()
    a = _make_user(db, "leo", UserRole.KID)
    b = _make_user(db, "maya", UserRole.KID)
    return a, b, _headers(db, a), _headers(db, b)


def _create(client, ph, kids, mode, **kw):
    body = {
        "title": "Trash",
        "repeat": {"type": "daily"},
        "kid_ids": [k.id for k in kids],
        "mode": mode,
        "points": 25,
        **kw,
    }
    r = client.post("/api/v1/chores/", json=body, headers=ph)
    assert r.status_code == 200, r.text
    return r.json()


def _chores(client, h):
    return client.get("/api/v1/kid/today", headers=h).json()["chores"]


def _pts(db, kid):
    rows = db.query(Points).filter(Points.user_id == kid.id).all()
    return sum(p.amount for p in rows)


def test_each_makes_one_instance_per_kid(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _create(client, parent_headers, [a, b], "each")
    assert len(_chores(client, ha)) == 1 and len(_chores(client, hb)) == 1
    n = db.query(Task).filter(Task.is_recurring.is_(False)).count()
    assert n == 2


def test_each_next_reset_makes_two(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _create(client, parent_headers, [a, b], "each")
    assert run_reset(db, date(2026, 10, 21)) == 2


def test_race_one_shared_instance_winner_gets_points(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    j = _create(client, parent_headers, [a, b], "race")
    assert j["instance"]["mode"] == "race"
    assert len(_chores(client, ha)) == 1 and len(_chores(client, hb)) == 1
    cid = _chores(client, hb)[0]["id"]
    assert client.post(f"/api/v1/kid/chores/{cid}/done", headers=hb).status_code == 200
    r = client.post(f"/api/v1/chores/{cid}/approve", headers=parent_headers)
    assert r.status_code == 200
    assert _pts(db, b) == 25 and _pts(db, a) == 0
    # the loser is not held offline by it
    c = chore_counts(db, a.id, DAY)
    assert (c.total, c.approved) == (1, 1)
    assert _chores(client, ha)[0]["state"] == "done"


def test_race_reopen_for_all(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _create(client, parent_headers, [a, b], "race")
    cid = _chores(client, hb)[0]["id"]
    client.post(f"/api/v1/kid/chores/{cid}/done", headers=hb)
    t = db.get(Task, cid)
    assert t.submitted_by_id == b.id
    t.status, t.submitted_by_id = TaskStatus.TODO, None
    db.commit()
    assert _chores(client, ha)[0]["state"] == "todo"
    assert client.post(f"/api/v1/kid/chores/{cid}/done", headers=ha).status_code == 200
    assert db.get(Task, cid).submitted_by_id == a.id


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


def test_single_kid_legacy_is_one_each_instance(client, db, kid, parent_headers):
    get_family(db).last_reset_date = DAY
    db.commit()
    body = {"title": "x", "repeat": {"type": "daily"}, "kid_id": kid.id}
    j = client.post("/api/v1/chores/", json=body, headers=parent_headers).json()
    assert j["definition"]["kid_ids"] == [kid.id] and j["definition"]["mode"] == "each"
    assert db.query(Task).filter(Task.is_recurring.is_(False)).count() == 1


def test_patch_updates_todo_instance_not_submitted(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    j = _create(client, parent_headers, [a, b], "each")
    did = j["definition"]["id"]
    ids = [c["id"] for c in _chores(client, ha) + _chores(client, hb)]
    client.post(f"/api/v1/kid/chores/{ids[0]}/done", headers=ha)
    r = client.patch(
        f"/api/v1/chores/{did}",
        json={"title": "Bins", "points": 5, "subtasks": ["a"]},
        headers=parent_headers,
    )
    assert r.status_code == 200 and r.json()["title"] == "Bins"
    db.expire_all()
    assert db.get(Task, ids[0]).title == "Trash"
    assert db.get(Task, ids[1]).title == "Bins" and db.get(Task, ids[1]).points == 5
    assert db.get(Task, did).recurrence_pattern["subtasks"] == ["a"]


def test_patch_assignees_applies_next_reset(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    j = _create(client, parent_headers, [a], "each")
    did = j["definition"]["id"]
    r = client.patch(
        f"/api/v1/chores/{did}", json={"kid_ids": [a.id, b.id]}, headers=parent_headers
    )
    assert r.status_code == 200 and r.json()["kid_ids"] == [a.id, b.id]
    assert db.query(Task).filter(Task.is_recurring.is_(False)).count() == 1
    assert run_reset(db, date(2026, 10, 21)) == 2


def test_create_rejects_non_kid(client, db, parent, parent_headers):
    r = client.post(
        "/api/v1/chores/",
        json={"title": "x", "repeat": {"type": "daily"}, "kid_ids": [parent.id]},
        headers=parent_headers,
    )
    assert r.status_code == 404


def test_kid_today_extras_and_taken_by(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _create(client, parent_headers, [a, b], "race", subtasks=["x"], needs_photo=True)
    c = _chores(client, ha)[0]
    assert (c["mode"], c["needs_photo"], c["photo_count_current"]) == ("race", True, 0)
    assert c["subtasks"] == [{"id": c["subtasks"][0]["id"], "title": "x", "done": False}]
    assert c["taken_by"] is None and c["last_note"] is None
    t = db.get(Task, c["id"])
    t.submitted_by_id = b.id
    db.commit()
    assert _chores(client, ha)[0]["taken_by"] == "Maya"
    assert _chores(client, hb)[0]["taken_by"] is None
