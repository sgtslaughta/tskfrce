"""Task 7A: identity comes only from a verified JWT; kids can't act as parents or others."""

import json
from datetime import UTC, datetime

import pytest
from app.core.config import settings
from app.models.user import UserRole

from tests.conftest import _make_user


@pytest.fixture
def kid2(db):
    return _make_user(db, "sally", UserRole.KID)


def test_x_user_data_header_alone_is_401(client, parent):
    spoof = {"X-User-Data": json.dumps({"user_id": parent.id, "id": parent.id})}
    assert client.get("/api/v1/notifications", headers=spoof).status_code == 401
    assert client.get("/api/v1/auth/me", headers=spoof).status_code == 401


def test_bearer_token_still_works(client, parent_headers):
    assert client.get("/api/v1/notifications", headers=parent_headers).status_code == 200


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


def test_keep_me_logged_in_gives_a_longer_refresh_token(client, db, parent):
    from app.core.auth import AuthService

    def days(body):
        r = client.post(
            "/api/v1/auth/login", json={"username": "mom", "password": "pw-12345", **body}
        )
        exp = AuthService(db).verify_token(r.json()["refresh_token"])["exp"]
        return r.json()["refresh_expires_in"] // 86400, (
            exp - datetime.now(UTC).timestamp()
        ) / 86400

    short, long_ = days({}), days({"remember": True})
    assert short[0] == settings.REFRESH_TOKEN_EXPIRE_DAYS and round(short[1]) == short[0]
    assert (
        long_[0] == settings.REFRESH_TOKEN_REMEMBER_DAYS > short[0] and round(long_[1]) == long_[0]
    )


def test_setup_rate_limited_after_5_tries(client):
    for _ in range(5):
        client.post("/api/v1/setup", json={})
    assert client.post("/api/v1/setup", json=SETUP).status_code == 429


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
