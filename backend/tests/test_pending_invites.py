"""Pending parent invites: list, cancel, redeem, expire."""

from datetime import datetime, timedelta

from app.models.family import FamilySettings
from app.models.user import PendingInvite


def _invite(client, headers, name="dad"):
    return client.post("/api/v1/users/invite", json={"username": name}, headers=headers).json()


def test_invite_is_listed_for_parents_only(client, parent_headers, kid_headers):
    token = _invite(client, parent_headers)["token"]
    assert token
    rows = client.get("/api/v1/users/invites", headers=parent_headers).json()
    assert [r["username"] for r in rows] == ["dad"]
    assert 86000 < rows[0]["expires_in"] <= 86400
    assert client.get("/api/v1/users/invites", headers=kid_headers).status_code == 403
    assert (
        client.delete(f"/api/v1/users/invites/{rows[0]['jti']}", headers=kid_headers).status_code
        == 403
    )


def test_cancel_kills_the_link(client, db, parent_headers):
    token = _invite(client, parent_headers)["token"]
    jti = client.get("/api/v1/users/invites", headers=parent_headers).json()[0]["jti"]
    assert client.delete(f"/api/v1/users/invites/{jti}", headers=parent_headers).status_code == 204
    assert client.get("/api/v1/users/invites", headers=parent_headers).json() == []
    r = client.post("/api/v1/auth/register", json={"token": token, "password": "pw-123456"})
    assert r.status_code == 403
    assert client.delete(f"/api/v1/users/invites/{jti}", headers=parent_headers).status_code == 404


def test_register_clears_pending_row(client, db, parent_headers):
    token = _invite(client, parent_headers)["token"]
    r = client.post("/api/v1/auth/register", json={"token": token, "password": "pw-123456"})
    assert r.status_code == 201
    assert client.get("/api/v1/users/invites", headers=parent_headers).json() == []


def test_expired_rows_are_pruned_on_list(client, db, parent, parent_headers):
    db.add(
        PendingInvite(
            jti="old",
            username="gran",
            invited_by=parent.id,
            expires_at=datetime.utcnow() - timedelta(minutes=1),
        )
    )
    db.commit()
    assert client.get("/api/v1/users/invites", headers=parent_headers).json() == []
    assert db.query(PendingInvite).count() == 0


def test_parents_flag_the_owner(client, db, parent, parent_headers):
    db.add(FamilySettings(id=1, owner_id=parent.id))
    db.commit()
    rows = client.get("/api/v1/parents", headers=parent_headers).json()
    assert rows[0]["is_owner"] is True


def test_new_invite_replaces_live_one_for_same_name(client, parent_headers):
    old = _invite(client, parent_headers)["token"]
    new = _invite(client, parent_headers)["token"]
    rows = client.get("/api/v1/users/invites", headers=parent_headers).json()
    assert len(rows) == 1
    assert (
        client.post(
            "/api/v1/auth/register", json={"token": old, "password": "pw-123456"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/auth/register", json={"token": new, "password": "pw-123456"}
        ).status_code
        == 201
    )
