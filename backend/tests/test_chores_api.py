from datetime import date, datetime

from app.lock.reset import run_reset
from app.models.family import get_family
from app.models.task import Task, TaskStatus

BODY = {"title": "Dishes", "repeat": {"type": "daily"}, "needs_photo": True}


def set_day(db, d=date(2026, 10, 20)):
    get_family(db).last_reset_date = d
    db.commit()


def test_create_daily_makes_definition_and_instance(client, db, kid, parent_headers):
    set_day(db)
    r = client.post("/api/v1/chores/", json={**BODY, "kid_id": kid.id}, headers=parent_headers)
    assert r.status_code == 200
    j = r.json()
    assert j["definition"]["needs_photo"] and j["instance"]["due_date"] == "2026-10-20"
    today = client.get("/api/v1/chores/today", headers=parent_headers).json()
    assert len(today[str(kid.id)]) == 1


def test_create_once_is_its_own_instance(client, db, kid, parent_headers):
    set_day(db)
    body = {**BODY, "kid_id": kid.id, "repeat": {"type": "once"}}
    j = client.post("/api/v1/chores/", json=body, headers=parent_headers).json()
    assert j["definition"] is None and j["instance"]["due_date"] == "2026-10-20"


def test_delete_stops_future_instances(client, db, kid, parent_headers):
    set_day(db)
    j = client.post(
        "/api/v1/chores/", json={**BODY, "kid_id": kid.id}, headers=parent_headers
    ).json()
    r = client.delete(f"/api/v1/chores/{j['definition']['id']}", headers=parent_headers)
    assert r.status_code == 204
    assert run_reset(db, date(2026, 10, 21)) == 0
    assert db.get(Task, j["instance"]["id"]).status == TaskStatus.CANCELLED


def _instance(db, parent, kid, status):
    t = Task(
        title="x",
        created_by_id=parent.id,
        assigned_to_id=kid.id,
        due_date=datetime(2026, 10, 20),
        status=status,
    )
    db.add(t)
    db.commit()
    return t


def test_approve_requires_submitted(client, db, parent, kid, parent_headers):
    t = _instance(db, parent, kid, TaskStatus.TODO)
    r = client.post(f"/api/v1/chores/{t.id}/approve", headers=parent_headers)
    assert r.status_code == 409
    assert r.json()["detail"] == "This chore isn't waiting for approval."


def test_approve_marks_done(client, db, parent, kid, parent_headers):
    t = _instance(db, parent, kid, TaskStatus.SUBMITTED_FOR_APPROVAL)
    assert client.post(f"/api/v1/chores/{t.id}/approve", headers=parent_headers).status_code == 200
    db.refresh(t)
    assert t.status == TaskStatus.DONE and t.approved_by_id == parent.id
    assert t.approved_at and t.completed_at


def test_kid_cannot_approve(client, db, parent, kid, kid_headers):
    t = _instance(db, parent, kid, TaskStatus.SUBMITTED_FOR_APPROVAL)
    assert client.post(f"/api/v1/chores/{t.id}/approve", headers=kid_headers).status_code == 403
