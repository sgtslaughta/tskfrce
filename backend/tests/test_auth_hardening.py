"""Task 7A: identity comes only from a verified JWT; kids can't act as parents or others."""

import json

import pytest
from app.core.config import settings
from app.models.task import Task
from app.models.user import UserRole
from starlette.websockets import WebSocketDisconnect

from tests.conftest import _headers, _make_user


@pytest.fixture
def kid2(db):
    return _make_user(db, "sally", UserRole.KID)


def test_x_user_data_header_alone_is_401(client, parent):
    spoof = {"X-User-Data": json.dumps({"user_id": parent.id, "id": parent.id})}
    assert client.get("/api/v1/notifications", headers=spoof).status_code == 401
    assert client.get("/api/v1/auth/me", headers=spoof).status_code == 401


def test_bearer_token_still_works(client, parent_headers):
    assert client.get("/api/v1/notifications", headers=parent_headers).status_code == 200


def test_kid_cannot_award_points(client, kid, kid_headers, parent_headers):
    q = f"/api/v1/gamification/points/award?user_id={kid.id}&amount=10&points_type=bonus"
    assert client.post(q, headers=kid_headers).status_code == 403
    assert client.post(q, headers=parent_headers).status_code == 201


def test_kid_reads_only_own_points(client, kid, kid2, kid_headers, parent_headers):
    own = client.get(f"/api/v1/gamification/points/summary/{kid.id}", headers=kid_headers)
    assert own.status_code == 200
    other = f"/api/v1/gamification/points/summary/{kid2.id}"
    assert client.get(other, headers=kid_headers).status_code == 403
    assert client.get(other, headers=parent_headers).status_code == 200
    assert client.get(other).status_code == 401


def test_kid_cannot_promote_self_to_parent(client, db, kid, kid_headers):
    r = client.put(f"/api/v1/users/{kid.id}", json={"role": "parent"}, headers=kid_headers)
    assert r.status_code == 403
    for field in ({"is_active": False}, {"is_superuser": True}):
        assert (
            client.put(f"/api/v1/users/{kid.id}", json=field, headers=kid_headers).status_code
            == 403
        )
    db.refresh(kid)
    assert kid.role == UserRole.KID and not kid.is_superuser


def test_kid_can_update_own_name(client, kid, kid_headers):
    r = client.put(f"/api/v1/users/{kid.id}", json={"full_name": "Tim"}, headers=kid_headers)
    assert r.status_code == 200 and r.json()["full_name"] == "Tim"


def test_user_cannot_update_other_user(client, parent, kid, kid_headers):
    r = client.put(f"/api/v1/users/{parent.id}", json={"full_name": "x"}, headers=kid_headers)
    assert r.status_code == 403


def test_parent_can_change_role(client, kid, parent_headers):
    r = client.put(f"/api/v1/users/{kid.id}", json={"role": "parent"}, headers=parent_headers)
    assert r.status_code == 200 and r.json()["role"] == "parent"


def test_websocket_without_token_rejected(client, parent):
    for url in (
        "ws://localhost/ws/notifications",
        "ws://localhost/ws/messaging",
        f"ws://localhost/ws/notifications?user_data={json.dumps({'user_id': parent.id})}",
        "ws://localhost/ws/notifications?token=garbage",
    ):
        with pytest.raises(WebSocketDisconnect) as e:
            with client.websocket_connect(url):
                pass
        assert e.value.code == 4401, url


def test_websocket_with_token_accepted(client, parent_headers):
    token = parent_headers["Authorization"].split()[1]
    with client.websocket_connect(f"ws://localhost/ws/notifications?token={token}") as ws:
        ws.send_text(json.dumps({"type": "heartbeat", "timestamp": 1}))
        assert ws.receive_json()["type"] == "heartbeat_ack"


@pytest.fixture
def media_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DATA_DIR", tmp_path)


def _upload(c, headers, task_id=None):
    data = {"task_id": str(task_id)} if task_id else {}
    r = c.post(
        "/api/v1/media/upload",
        files={"file": ("a.txt", b"secret", "text/plain")},
        data=data,
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["file_path"]


def test_other_kid_cannot_fetch_file(client, db, media_dir, kid, kid2, kid_headers, parent_headers):
    key = _upload(client, kid_headers)
    url = f"/api/v1/media/files/{key}"
    assert client.get(url, headers=kid_headers).content == b"secret"
    assert client.get(url, headers=_headers(db, kid2)).status_code == 404
    assert client.get(url, headers=parent_headers).status_code == 200


def test_task_viewer_can_fetch_task_file(client, db, media_dir, parent, kid, kid2, parent_headers):
    task = Task(title="t", created_by_id=parent.id, assigned_to_id=kid.id)
    db.add(task)
    db.commit()
    key = _upload(client, parent_headers, task.id)
    url = f"/api/v1/media/files/{key}"
    assert client.get(url, headers=_headers(db, kid)).status_code == 200
    assert client.get(url, headers=_headers(db, kid2)).status_code == 404


def test_upload_is_owned_by_caller(client, media_dir, kid, kid_headers):
    _upload(client, kid_headers)
    atts = client.get("/api/v1/media/attachments", headers=kid_headers).json()["attachments"]
    assert [a["user_id"] for a in atts] == [kid.id]


def test_mention_search_never_returns_email(client, parent, kid, kid_headers):
    r = client.get(
        "/api/v1/mentions/suggestions",
        params={"context_type": "general", "search": "mo"},
        headers=kid_headers,
    )
    assert r.status_code == 200
    body = r.json()["suggestions"]
    assert [s["username"] for s in body] == ["mom"]
    assert "email" not in r.text and "@family.local" not in r.text
    by_mail = client.get(
        "/api/v1/mentions/suggestions",
        params={"context_type": "general", "search": "family.local"},
        headers=kid_headers,
    )
    assert by_mail.json()["suggestions"] == []
    wild = client.get(
        "/api/v1/mentions/suggestions",
        params={"context_type": "general", "search": "%"},
        headers=kid_headers,
    )
    assert wild.json()["suggestions"] == []


def test_kid_cannot_view_unrelated_task(db, parent, kid, kid2):
    from app.services.permission_service import Permission, PermissionService

    task = Task(title="t", created_by_id=parent.id, assigned_to_id=kid.id)
    db.add(task)
    db.commit()
    ps = PermissionService(db)
    assert ps.has_permission(kid.id, Permission.TASK_VIEW, task.id, "task")
    assert not ps.has_permission(kid2.id, Permission.TASK_VIEW, task.id, "task")
    assert not ps.has_permission(kid2.id, Permission.COMMENT_CREATE, task.id, "task")
    assert ps.has_permission(parent.id, Permission.TASK_VIEW, task.id, "task")
    assert not ps.has_permission(kid.id, Permission.TASK_VIEW, task.id, "spaceship")


def test_comment_bulk_create_capped_at_50(client, kid_headers):
    r = client.post("/api/v1/comments/bulk/create", json=[{}] * 51, headers=kid_headers)
    assert r.status_code == 400


SETUP = {
    "family_name": "F",
    "parent": {"username": "mom", "password": "pw-123456", "full_name": "M"},
}


def test_register_closed_after_setup(client):
    assert client.post("/api/v1/setup", json=SETUP).status_code == 201
    r = client.post(
        "/api/v1/auth/register",
        json={"username": "evil", "password": "pw-123456", "full_name": "E"},
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "Ask a parent to add you."


def test_parent_invite_creates_parent_once(client, db, kid_headers, parent_headers):
    assert (
        client.post(
            "/api/v1/users/invite", json={"username": "dad"}, headers=kid_headers
        ).status_code
        == 403
    )
    r = client.post("/api/v1/users/invite", json={"username": "dad"}, headers=parent_headers)
    assert r.status_code == 201
    token = r.json()["token"]
    body = {"token": token, "password": "pw-123456", "full_name": "Dad"}
    first = client.post("/api/v1/auth/register", json=body)
    assert first.status_code == 201, first.text
    from app.models.user import User

    dad = db.query(User).filter(User.username == "dad").one()
    assert dad.role == UserRole.PARENT
    assert client.post("/api/v1/auth/register", json=body).status_code == 403


def test_login_rate_limited_after_10_tries(client, parent):
    bad = {"username": "mom", "password": "wrong-pass"}
    for _ in range(10):
        assert client.post("/api/v1/auth/login", json=bad).status_code == 401
    r = client.post("/api/v1/auth/login", json={"username": "mom", "password": "pw-12345"})
    assert r.status_code == 429
    assert r.json()["detail"] == "Too many tries. Wait a minute and try again."


def test_login_uses_configured_expiry(client, parent):
    r = client.post("/api/v1/auth/login", json={"username": "mom", "password": "pw-12345"})
    assert r.json()["expires_in"] == settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


def test_setup_rate_limited_after_5_tries(client):
    for _ in range(5):
        client.post("/api/v1/setup", json={})
    assert client.post("/api/v1/setup", json=SETUP).status_code == 429


@pytest.fixture
def kid_task(db, parent, kid):
    task = Task(title="dishes", created_by_id=parent.id, assigned_to_id=kid.id, points=5)
    db.add(task)
    db.commit()
    return task


def test_kid_cannot_set_own_task_done_via_tasks_api(client, db, kid_task, kid_headers):
    def upd(updates):
        return client.post(
            "/api/v1/tasks/update",
            json={"task_id": kid_task.id, "updates": updates},
            headers=kid_headers,
        )

    for updates in (
        {"status": "done"},
        {"approved_by_id": kid_task.assigned_to_id},
        {"approved_at": "2026-10-20T00:00:00"},
        {"assigned_to_id": kid_task.created_by_id},
        {"points": 999},
    ):
        r = upd(updates)
        assert r.status_code == 403, updates
        assert r.json()["detail"] == "Only parents can do this."
    complete = client.post(
        "/api/v1/tasks/complete", json={"task_id": kid_task.id}, headers=kid_headers
    )
    assert complete.status_code == 403
    bulk = {"task_ids": [kid_task.id], "updates": {"status": "done"}}
    assert (
        client.post("/api/v1/tasks/bulk-update", json=bulk, headers=kid_headers).status_code == 403
    )
    assert upd({"status": "submitted_for_approval"}).status_code == 200
    db.refresh(kid_task)
    assert kid_task.status == "submitted_for_approval" and kid_task.approved_by_id is None


def test_kid_cannot_touch_other_kids_task(client, kid_task, db, kid2):
    r = client.post(
        "/api/v1/tasks/update",
        json={"task_id": kid_task.id, "updates": {"status": "in_progress"}},
        headers=_headers(db, kid2),
    )
    assert r.status_code == 403


def test_kid_cannot_approve_via_workflow(client, db, kid, kid_task, kid_headers, parent_headers):
    def move(new_status, headers, force=False):
        body = {"task_id": kid_task.id, "new_status": new_status, "force": force}
        return client.post("/api/v1/workflow/transition", json=body, headers=headers)

    assert move("in_progress", kid_headers).status_code == 200
    assert move("submitted_for_approval", kid_headers).status_code == 200
    assert move("done", kid_headers).status_code == 403
    assert move("done", kid_headers, force=True).status_code == 403
    approve = {"task_id": kid_task.id}
    assert (
        client.post("/api/v1/workflow/approve", json=approve, headers=kid_headers).status_code
        == 403
    )
    # a kid who created the task still can't approve it
    own = Task(
        title="mine", created_by_id=kid.id, assigned_to_id=kid.id, status="submitted_for_approval"
    )
    db.add(own)
    db.commit()
    r = client.post("/api/v1/workflow/approve", json={"task_id": own.id}, headers=kid_headers)
    assert r.status_code == 403
    ok = client.post("/api/v1/workflow/approve", json=approve, headers=parent_headers)
    assert ok.status_code == 200, ok.text
    db.refresh(kid_task)
    assert kid_task.status == "done"


def test_kid_cannot_create_points_task(client, parent, kid, kid_headers):
    def create(**extra):
        return client.post("/api/v1/tasks/", json={"title": "t", **extra}, headers=kid_headers)

    for extra in ({"points": 5}, {"reward_value": 1}, {"assigned_to_id": parent.id}):
        r = create(**extra)
        assert r.status_code == 403, extra
        assert r.json()["detail"] == "Only parents can do this."
    assert create(assigned_to_id=kid.id).status_code == 201


def test_parent_only_maintenance_routes(client, kid_headers, parent_headers):
    for path in (
        "/api/v1/tasks/recurring/create",
        "/api/v1/presence/cleanup",
    ):
        assert client.post(path).status_code == 401, path
        assert client.post(path, headers=kid_headers).status_code == 403, path
    assert client.post("/api/v1/tasks/recurring/create", headers=parent_headers).status_code == 200


def test_read_routes_require_login(client, kid_headers):
    for path in ("/api/v1/tasks/tags", "/api/v1/tasks/reward-types", "/ws/stats"):
        assert client.get(path).status_code == 401, path
        assert client.get(path, headers=kid_headers).status_code == 200, path


def test_kid_cannot_change_own_username_or_email(client, kid, kid_headers):
    for field in ({"username": "boss"}, {"email": "x@example.com"}, {"timezone": "UTC"}):
        r = client.put(f"/api/v1/users/{kid.id}", json=field, headers=kid_headers)
        assert r.status_code == 403, field


def test_refresh_token_rejected_as_bearer(client, db, parent):
    from app.core.auth import AuthService

    token = AuthService(db).create_refresh_token({"sub": str(parent.id)})
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_invite_token_rejected_as_bearer(client, db, parent):
    from app.core.auth import AuthService

    token = AuthService(db).create_invite_token(str(parent.id), parent.id)
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_invite_reuse_rejected_even_if_user_removed(client, db, parent_headers):
    from app.models.user import User

    token = client.post(
        "/api/v1/users/invite", json={"username": "dad"}, headers=parent_headers
    ).json()["token"]
    body = {"token": token, "password": "pw-123456"}
    assert client.post("/api/v1/auth/register", json=body).status_code == 201
    db.query(User).filter(User.username == "dad").delete()
    db.commit()
    assert client.post("/api/v1/auth/register", json=body).status_code == 403


def _chore(db, parent, kid, **kw):
    t = Task(
        title="Dishes",
        created_by_id=parent.id,
        assigned_to_id=kid.id,
        recurrence_pattern={"type": "daily", "chore": True},
        **kw,
    )
    db.add(t)
    db.commit()
    return t


def test_kid_cannot_delete_chores(client, db, parent, kid, kid_headers):
    defn = _chore(db, parent, kid, is_recurring=True)
    inst = _chore(db, parent, kid, parent_task_id=defn.id)
    # even a chore-linked row the kid "created" is off limits
    sneaky = Task(title="x", created_by_id=kid.id, assigned_to_id=kid.id, parent_task_id=defn.id)
    db.add(sneaky)
    db.commit()
    for t in (defn, inst, sneaky):
        r = client.post("/api/v1/tasks/delete", json={"task_id": t.id}, headers=kid_headers)
        assert r.status_code == 403, t.id
        assert r.json()["detail"] == "Only parents can do this."
    assert db.query(Task).count() == 3


def test_kid_can_delete_own_plain_task(client, db, kid, kid_headers):
    own = Task(title="mine", created_by_id=kid.id, assigned_to_id=kid.id)
    db.add(own)
    db.commit()
    r = client.post("/api/v1/tasks/delete", json={"task_id": own.id}, headers=kid_headers)
    assert r.status_code == 204


def test_kid_create_only_basic_fields(client, kid_headers):
    for extra in (
        {"parent_task_id": 1},
        {"is_recurring": True},
        {"category_id": 1},
        {"recurrence_pattern": {"chore": True}},
        {"tag_names": ["x"]},
    ):
        r = client.post("/api/v1/tasks/", json={"title": "t", **extra}, headers=kid_headers)
        assert r.status_code == 403, extra
    ok = {"title": "t", "description": "d", "priority": "high", "due_date": "2026-10-21T00:00:00"}
    assert client.post("/api/v1/tasks/", json=ok, headers=kid_headers).status_code == 201
