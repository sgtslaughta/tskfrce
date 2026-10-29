"""Public invite / reset link checks, and the resumable setup step."""

from datetime import timedelta

import jwt
from app.core.auth import ALGORITHM, SECRET_KEY, AuthService
from app.models.family import get_family
from app.models.password_reset import PasswordReset
from app.models.user import UsedInvite, UserRole

from tests.conftest import _make_user


def _invite(client, headers, name="dad"):
    return client.post("/api/v1/users/invite", json={"username": name}, headers=headers).json()[
        "token"
    ]


def test_invite_info_names_inviter_and_family(client, db, parent, parent_headers):
    get_family(db).name = "The Garcias"
    db.commit()
    r = client.get(f"/api/v1/auth/invite/{_invite(client, parent_headers)}")
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "dad" and body["inviter"] == "Mom"
    assert body["family_name"] == "The Garcias" and body["expires_at"]
    assert set(body) == {"username", "inviter", "family_name", "expires_at"}


def test_invite_info_rejects_garbage_used_and_expired(client, db, parent, parent_headers):
    assert client.get("/api/v1/auth/invite/not-a-token").status_code == 410
    token = _invite(client, parent_headers)
    jti = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])["jti"]
    db.add(UsedInvite(jti=jti))
    db.commit()
    assert client.get(f"/api/v1/auth/invite/{token}").status_code == 410
    old = jwt.encode(
        {"sub": "x", "type": "invite", "jti": "j", "exp": 1}, SECRET_KEY, algorithm=ALGORITHM
    )
    assert client.get(f"/api/v1/auth/invite/{old}").status_code == 410


def test_invite_info_rejects_access_token(client, db, parent):
    access = AuthService(db).create_access_token({"sub": str(parent.id)})
    assert client.get(f"/api/v1/auth/invite/{access}").status_code == 410


def test_reset_check(client, db, parent_headers):
    dad = _make_user(db, "dad", UserRole.PARENT)
    token = (
        client.post(f"/api/v1/parents/{dad.id}/reset-link", headers=parent_headers)
        .json()["url"]
        .split("token=")[1]
    )
    assert client.get(f"/api/v1/auth/reset/{token}").status_code == 204
    assert client.get("/api/v1/auth/reset/nope").status_code == 400
    assert client.post("/api/v1/auth/reset", json={"token": token, "password": "brand-new-pw"})
    assert client.get(f"/api/v1/auth/reset/{token}").status_code == 400
    row = db.query(PasswordReset).one()
    row.used_at = None
    row.expires_at = row.expires_at - timedelta(hours=1)
    db.commit()
    assert client.get(f"/api/v1/auth/reset/{token}").status_code == 400
