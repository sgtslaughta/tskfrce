"""Chore library: chores, steps, assignments and how edits reach runs."""

from datetime import date, timedelta

from app.models.chores import Chore, ChoreAssignment, ChoreRun, ChoreStep
from app.models.family import get_family
from app.models.points import Points
from app.models.user import UserRole

from tests.conftest import _headers, _make_user
from tests.factories import api_chore

DAY = date(2026, 10, 20)  # Tuesday


def _day(db):
    get_family(db).last_reset_date = DAY
    db.commit()


def _two_kids(db):
    a = _make_user(db, "leo", UserRole.KID)
    b = _make_user(db, "maya", UserRole.KID)
    return a, b, _headers(db, a), _headers(db, b)


def _mk(client, ph, **body):
    r = client.post("/api/v1/chores/", json={"title": "Dishes", **body}, headers=ph)
    assert r.status_code == 200, r.text
    return r.json()


def test_create_chore_with_steps_makes_no_runs(client, db, parent_headers):
    _day(db)
    c = _mk(client, parent_headers, steps=["rinse", "stack"], points=7, needs_photo=True)
    assert [s["title"] for s in c["steps"]] == ["rinse", "stack"]
    assert (c["points"], c["needs_photo"], c["assignments"], c["archived"]) == (7, True, [], False)
    assert db.query(ChoreRun).count() == 0
    assert (
        client.post("/api/v1/chores/", json={"title": ""}, headers=parent_headers).status_code
        == 422
    )


def test_assign_two_kids_each_makes_two_runs(client, db, parent_headers):
    _day(db)
    a, b, ha, hb = _two_kids(db)
    api_chore(client, parent_headers, [a, b], "each")
    assert sorted(r.kid_id for r in db.query(ChoreRun)) == [a.id, b.id]


def test_assignment_validation(client, db, kid, parent_headers):
    _day(db)
    c = _mk(client, parent_headers)
    url = f"/api/v1/chores/{c['id']}/assignments"
    ok = {"kid_ids": [kid.id], "repeat": {"type": "daily"}}
    assert client.post(url, json={**ok, "kid_ids": []}, headers=parent_headers).status_code == 422
    assert (
        client.post(url, json={**ok, "due_time": "9am"}, headers=parent_headers).status_code == 422
    )
    weekly = {**ok, "repeat": {"type": "weekly", "days": []}}
    assert client.post(url, json=weekly, headers=parent_headers).status_code == 422
    past = {**ok, "repeat": {"type": "once"}, "on_date": "2026-10-01"}
    assert client.post(url, json=past, headers=parent_headers).status_code == 422
    assert (
        client.post(url, json={**ok, "kid_ids": [999]}, headers=parent_headers).status_code == 404
    )
    assert db.query(ChoreAssignment).count() == 0


def test_once_assignment_date_is_editable_and_reuses_the_chore(client, db, kid, parent_headers):
    _day(db)
    c, a = api_chore(client, parent_headers, [kid], repeat={"type": "once"})
    assert a["on_date"] == "2026-10-20" and db.query(ChoreRun).count() == 1
    later = (DAY + timedelta(days=3)).isoformat()
    r = client.patch(
        f"/api/v1/assignments/{a['id']}", json={"on_date": later}, headers=parent_headers
    )
    assert r.status_code == 200 and r.json()["on_date"] == later
    assert db.query(ChoreRun).count() == 1  # the existing run is untouched
    assert db.query(ChoreRun).one().day == DAY


def test_copy_duplicates_chore_and_steps_only(client, db, kid, parent_headers):
    _day(db)
    c = _mk(client, parent_headers, steps=["a", "b"], points=9)
    client.post(
        f"/api/v1/chores/{c['id']}/assignments",
        json={"kid_ids": [kid.id], "repeat": {"type": "daily"}},
        headers=parent_headers,
    )
    r = client.post(f"/api/v1/chores/{c['id']}/copy", headers=parent_headers)
    assert r.status_code == 200
    n = r.json()
    assert n["id"] != c["id"] and n["points"] == 9 and n["assignments"] == []
    assert [s["title"] for s in n["steps"]] == ["a", "b"]
    assert db.query(ChoreRun).count() == 1


def test_edit_while_submitted_reaches_kid_and_parent(client, db, kid, parent_headers, kid_headers):
    """Review focus 2: rename + new step while a run is submitted."""
    _day(db)
    c, _ = api_chore(client, parent_headers, [kid], title="Dishes", points=10, steps=["rinse"])
    kid_chore = client.get("/api/v1/kid/today", headers=kid_headers).json()["chores"][0]
    rid, sid = kid_chore["id"], kid_chore["subtasks"][0]["id"]
    client.post(
        f"/api/v1/kid/chores/{rid}/subtasks/{sid}", json={"done": True}, headers=kid_headers
    )
    assert client.post(f"/api/v1/kid/chores/{rid}/done", headers=kid_headers).status_code == 200
    r = client.patch(
        f"/api/v1/chores/{c['id']}",
        json={"title": "Dishes and pans", "points": 30, "steps": ["rinse", "dry"]},
        headers=parent_headers,
    )
    assert r.status_code == 200
    kid_chore = client.get("/api/v1/kid/today", headers=kid_headers).json()["chores"][0]
    assert kid_chore["title"] == "Dishes and pans" and kid_chore["state"] == "needs_you"
    assert [(s["title"], s["done"]) for s in kid_chore["subtasks"]] == [
        ("rinse", True),
        ("dry", False),
    ]
    today = client.get("/api/v1/today", headers=parent_headers).json()
    (need,) = today["needs_you"]
    assert need["title"] == "Dishes and pans" and need["subtasks_total"] == 2
    assert client.post(f"/api/v1/chores/{rid}/approve", headers=parent_headers).status_code == 200
    assert [p.amount for p in db.query(Points).filter_by(user_id=kid.id)] == [30]


def test_removing_a_step_drops_its_ticks_and_keeps_order(
    client, db, kid, parent_headers, kid_headers
):
    _day(db)
    c, _ = api_chore(client, parent_headers, [kid], steps=["a", "b", "c"])
    run = client.get("/api/v1/kid/today", headers=kid_headers).json()["chores"][0]
    a_id = run["subtasks"][0]["id"]
    client.post(
        f"/api/v1/kid/chores/{run['id']}/subtasks/{a_id}", json={"done": True}, headers=kid_headers
    )
    r = client.patch(
        f"/api/v1/chores/{c['id']}", json={"steps": ["c", "a"]}, headers=parent_headers
    )
    assert [s["title"] for s in r.json()["steps"]] == ["c", "a"]
    assert r.json()["steps"][1]["id"] == a_id  # kept step keeps its tick
    assert [s.position for s in db.query(ChoreStep).order_by(ChoreStep.position)] == [0, 1]
    got = client.get("/api/v1/kid/today", headers=kid_headers).json()["chores"][0]["subtasks"]
    assert [(s["title"], s["done"]) for s in got] == [("c", False), ("a", True)]


def test_delete_with_history_archives_and_history_renders(client, db, kid, parent, parent_headers):
    _day(db)
    c, a = api_chore(client, parent_headers, [kid], title="Dishes")
    run = db.query(ChoreRun).one()
    run.status, run.approved_by_id = "done", parent.id
    db.commit()
    assert client.delete(f"/api/v1/chores/{c['id']}", headers=parent_headers).status_code == 204
    assert db.get(Chore, c["id"]).archived_at is not None
    assert not db.get(ChoreAssignment, a["id"]).active
    assert client.get("/api/v1/chores/", headers=parent_headers).json() == []
    arch = client.get("/api/v1/chores/?archived=true", headers=parent_headers).json()
    assert arch[0]["archived"] is True
    k = client.get("/api/v1/today", headers=parent_headers).json()["kids"][0]
    assert k["chores"][0]["title"] == "Dishes" and k["chores"][0]["state"] == "done"


def test_delete_assignment_with_runs_retires_it(client, db, kid, parent_headers):
    _day(db)
    c, a = api_chore(client, parent_headers, [kid])
    assert (
        client.delete(f"/api/v1/assignments/{a['id']}", headers=parent_headers).status_code == 204
    )
    rows = client.get("/api/v1/chores/", headers=parent_headers).json()
    assert rows[0]["assignments"] == []
    assert db.query(ChoreRun).one().status == "cancelled"
    c2, a2 = api_chore(
        client, parent_headers, [kid], title="Other", repeat={"type": "weekly", "days": [3]}
    )
    assert (
        client.delete(f"/api/v1/assignments/{a2['id']}", headers=parent_headers).status_code == 204
    )
    assert db.get(ChoreAssignment, a2["id"]) is None


def test_delete_kid_with_runs_photos_and_chat(client, db, parent, kid, parent_headers, kid_headers):
    _day(db)
    api_chore(client, parent_headers, [kid])
    rid = db.query(ChoreRun).one().id
    client.post(f"/api/v1/kid/chores/{rid}/done", headers=kid_headers)
    client.post(f"/api/v1/chores/{rid}/approve", headers=parent_headers)
    assert client.delete(f"/api/v1/kids/{kid.id}", headers=parent_headers).status_code == 200
    assert db.query(ChoreRun).count() == 0 and db.query(Points).count() == 0
