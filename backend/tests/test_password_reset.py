"""Parent password reset links: single use, expiry, hash-only storage, voiding, access rules."""

from datetime import timedelta

import pytest
from app.cli import main as cli_main
from app.core.auth import AuthService
from app.models.password_reset import PasswordReset
from app.models.user import UserRole

from tests.conftest import _make_user


@pytest.fixture
def dad(db):
    return _make_user(db, "dad", UserRole.PARENT)


def _link(client, headers, pid):
    r = client.post(f"/api/v1/parents/{pid}/reset-link", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["url"]


def _token(url):
    return url.split("token=")[1]


def _reset(client, token, pw="brand-new-pw"):
    return client.post("/api/v1/auth/reset", json={"token": token, "password": pw})


def test_link_resets_password_once(client, db, parent_headers, dad):
    url = _link(client, parent_headers, dad.id)
    assert "/reset?token=" in url
    assert _reset(client, _token(url)).status_code == 204
    db.refresh(dad)
    assert AuthService(db).verify_password("brand-new-pw", dad.hashed_password)
    r = _reset(client, _token(url), "another-pw-1")
    assert r.status_code == 400 and r.json()["detail"].startswith("That reset link has expired")


def test_only_hash_is_stored(client, db, parent_headers, dad):
    token = _token(_link(client, parent_headers, dad.id))
    row = db.query(PasswordReset).one()
    assert row.token_hash != token and len(row.token_hash) == 64 and token not in row.token_hash


def test_expired_link_rejected(client, db, parent_headers, dad):
    token = _token(_link(client, parent_headers, dad.id))
    row = db.query(PasswordReset).one()
    row.expires_at = row.expires_at - timedelta(hours=1)
    db.commit()
    assert _reset(client, token).status_code == 400


def test_new_link_voids_older(client, parent_headers, dad):
    first = _token(_link(client, parent_headers, dad.id))
    second = _token(_link(client, parent_headers, dad.id))
    assert _reset(client, first).status_code == 400
    assert _reset(client, second).status_code == 204


def test_self_reset_forbidden(client, parent, parent_headers):
    r = client.post(f"/api/v1/parents/{parent.id}/reset-link", headers=parent_headers)
    assert r.status_code == 403


def test_kid_cannot_create_or_be_target(client, db, kid, kid_headers, parent, parent_headers):
    assert (
        client.post(f"/api/v1/parents/{parent.id}/reset-link", headers=kid_headers).status_code
        == 403
    )
    assert client.get("/api/v1/parents", headers=kid_headers).status_code == 403
    r = client.post(f"/api/v1/parents/{kid.id}/reset-link", headers=parent_headers)
    assert r.status_code == 404


def test_list_parents(client, parent, dad, parent_headers):
    rows = client.get("/api/v1/parents", headers=parent_headers).json()
    assert [(r["username"], r["is_me"]) for r in rows] == [("mom", True), ("dad", False)]


def test_bad_token_and_short_password(client):
    assert _reset(client, "nope").status_code == 400
    assert _reset(client, "nope", "short").status_code == 422


def test_reset_is_rate_limited(client):
    codes = [_reset(client, "nope").status_code for _ in range(12)]
    assert codes[:10] == [400] * 10 and 429 in codes[10:]


def test_cli_prints_link(db, dad, monkeypatch, capsys):
    import app.cli as cli

    class Sess:
        def __enter__(self):
            return db

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(cli, "SessionLocal", lambda: Sess())
    assert cli_main(["reset-password", "DAD"]) == 0
    out = capsys.readouterr().out
    token = out.split("token=")[1].strip()
    assert _hash_matches(db, token)
    assert cli_main(["reset-password", "ghost"]) == 1
    assert "dad" in capsys.readouterr().out


def _hash_matches(db, token):
    import hashlib

    h = hashlib.sha256(token.encode()).hexdigest()
    return db.query(PasswordReset).filter_by(token_hash=h).count() == 1
