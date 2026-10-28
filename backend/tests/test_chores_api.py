from datetime import date

from app.models.chores import Chore, ChoreRun
from app.models.family import get_family
from app.services import chores as svc

from tests.factories import api_chore, make_run

D = date(2026, 10, 20)


def set_day(db, d=D):
    get_family(db).last_reset_date = d
    db.commit()


def test_assignment_makes_todays_run(client, db, kid, parent_headers):
    set_day(db)
    chore, _ = api_chore(client, parent_headers, [kid], needs_photo=True, title="Dishes")
    assert chore["needs_photo"] and chore["title"] == "Dishes"
    today = client.get("/api/v1/chores/today", headers=parent_headers).json()
    (row,) = today[str(kid.id)]
    assert row["due_date"] == "2026-10-20" and row["needs_photo"] and row["status"] == "todo"


def test_chore_without_assignment_has_no_runs(client, db, kid, parent_headers):
    set_day(db)
    r = client.post("/api/v1/chores/", json={"title": "Dishes"}, headers=parent_headers)
    assert r.status_code == 200 and r.json()["assignments"] == []
    assert db.query(ChoreRun).count() == 0


def test_once_assignment_runs_once(client, db, kid, parent_headers):
    set_day(db)
    _, a = api_chore(client, parent_headers, [kid], repeat={"type": "once"})
    assert a["on_date"] == "2026-10-20"
    assert svc.run_reset(db, date(2026, 10, 21)) == 0
    assert db.query(ChoreRun).count() == 1


def test_delete_with_history_archives_and_stops_future_runs(client, db, kid, parent_headers):
    set_day(db)
    chore, _ = api_chore(client, parent_headers, [kid])
    r = client.delete(f"/api/v1/chores/{chore['id']}", headers=parent_headers)
    assert r.status_code == 204
    assert svc.run_reset(db, date(2026, 10, 21)) == 0
    c = db.get(Chore, chore["id"])
    assert c.archived_at is not None
    assert db.query(ChoreRun).one().status == "cancelled"


def test_delete_without_runs_removes_it(client, db, kid, parent_headers):
    set_day(db)  # Tuesday
    chore, _ = api_chore(client, parent_headers, [kid], repeat={"type": "weekly", "days": [3]})
    assert client.delete(f"/api/v1/chores/{chore['id']}", headers=parent_headers).status_code == 204
    assert db.get(Chore, chore["id"]) is None


def test_approve_requires_submitted(client, db, parent, kid, parent_headers):
    t = make_run(db, parent, kid, status="todo")
    r = client.post(f"/api/v1/chores/{t.id}/approve", headers=parent_headers)
    assert r.status_code == 409
    assert r.json()["detail"] == "This chore isn't waiting for approval."


def test_approve_marks_done(client, db, parent, kid, parent_headers):
    t = make_run(db, parent, kid, status="submitted")
    assert client.post(f"/api/v1/chores/{t.id}/approve", headers=parent_headers).status_code == 200
    db.refresh(t)
    assert t.status == "done" and t.approved_by_id == parent.id
    assert t.approved_at and t.completed_at


def test_parent_marks_todo_done(client, db, parent, kid, parent_headers):
    t = make_run(db, parent, kid, status="todo", steps=("a", "b"))
    assert client.post(f"/api/v1/chores/{t.id}/done", headers=parent_headers).status_code == 200
    db.refresh(t)
    assert t.status == "done" and t.approved_by_id == parent.id
    assert len(t.ticks) == 2
    assert client.post(f"/api/v1/chores/{t.id}/done", headers=parent_headers).status_code == 409


def test_parent_unticks_done_chore(client, db, parent, kid, parent_headers):
    from app.models.points import Points

    t = make_run(db, parent, kid, status="todo", steps=("a",))
    client.post(f"/api/v1/chores/{t.id}/done", headers=parent_headers)
    assert db.query(Points).filter(Points.run_id == t.id).count() > 0
    assert client.post(f"/api/v1/chores/{t.id}/undo", headers=parent_headers).status_code == 200
    db.refresh(t)
    assert t.status == "todo" and not t.ticks and t.approved_by_id is None
    assert db.query(Points).filter(Points.run_id == t.id).count() == 0
    assert client.post(f"/api/v1/chores/{t.id}/undo", headers=parent_headers).status_code == 409


def test_kid_cannot_approve(client, db, parent, kid, kid_headers):
    t = make_run(db, parent, kid, status="submitted")
    assert client.post(f"/api/v1/chores/{t.id}/approve", headers=kid_headers).status_code == 403


def test_delete_cancels_submitted_run(client, db, parent, kid, parent_headers):
    """Deleting a chore must not keep a kid locked by it."""
    set_day(db)
    chore, _ = api_chore(client, parent_headers, [kid])
    run = db.query(ChoreRun).one()
    run.status = "submitted"
    db.commit()
    client.delete(f"/api/v1/chores/{chore['id']}", headers=parent_headers)
    db.refresh(run)
    assert run.status == "cancelled"


def test_approve_unknown_run_is_404(client, parent_headers):
    assert client.post("/api/v1/chores/9999/approve", headers=parent_headers).status_code == 404


def test_today_works_on_fresh_install(client, db, kid, parent_headers):
    api_chore(client, parent_headers, [kid])
    today = client.get("/api/v1/chores/today", headers=parent_headers).json()
    assert len(today[str(kid.id)]) == 1


def test_library_lists_chores_for_a_kid(client, db, kid, parent_headers, kid_headers):
    set_day(db)
    chore, a = api_chore(client, parent_headers, [kid], title="Dishes", needs_photo=True)
    api_chore(client, parent_headers, [kid], title="Once", repeat={"type": "once"})
    client.post("/api/v1/chores/", json={"title": "Unused"}, headers=parent_headers)
    rows = client.get(f"/api/v1/chores/?kid_id={kid.id}", headers=parent_headers).json()
    assert [r["title"] for r in rows] == ["Dishes", "Once"]
    want = {
        "id": chore["id"],
        "title": "Dishes",
        "points": 25,
        "needs_photo": True,
        "steps": [],
        "archived": False,
    }
    assert {k: rows[0][k] for k in want} == want
    asg = rows[0]["assignments"][0]
    assert asg["kid_ids"] == [kid.id] and asg["repeat"] == {"type": "daily", "days": []}
    assert len(client.get("/api/v1/chores/", headers=parent_headers).json()) == 3
    assert client.get("/api/v1/chores/", headers=kid_headers).status_code == 403
    assert client.get("/api/v1/chores/definitions", headers=parent_headers).status_code != 200


def test_chore_thread_says_who(client, db, parent, kid, parent_headers):
    t = make_run(db, parent, kid, status="todo")
    r = client.get(f"/api/v1/chat/threads/chore/{t.id}", headers=parent_headers)
    assert r.status_code == 200
    assert r.json()["who"] == (kid.full_name or kid.username)


def test_thread_list_says_which_kids_a_chore_is_for(client, db, parent, kid, parent_headers):
    t = make_run(db, parent, kid, status="todo")
    tid = client.get(f"/api/v1/chat/threads/chore/{t.id}", headers=parent_headers).json()["id"]
    client.post(f"/api/v1/chat/threads/{tid}/messages", json={"body": "hi"}, headers=parent_headers)
    rows = client.get("/api/v1/chat/threads", headers=parent_headers).json()["threads"]
    assert next(r for r in rows if r["kind"] == "chore")["kid_ids"] == [kid.id]


def test_delete_archived_chore_is_ok_and_unknown_is_404(client, db, kid, parent_headers):
    set_day(db)
    chore, _ = api_chore(client, parent_headers, [kid])
    assert client.delete(f"/api/v1/chores/{chore['id']}", headers=parent_headers).status_code == 204
    assert client.delete(f"/api/v1/chores/{chore['id']}", headers=parent_headers).status_code == 204
    assert db.get(Chore, chore["id"]).archived_at is not None
    assert client.delete("/api/v1/chores/99999", headers=parent_headers).status_code == 404
