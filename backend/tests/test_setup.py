import pytest
from app.api.deps import require_parent
from app.models.family import get_family
from app.models.user import User, UserRole
from fastapi import HTTPException

BODY = {
    "family_name": "Sotos",
    "timezone": "America/New_York",
    "parent": {"username": "rich", "password": "s3cret-pw", "full_name": "Rich Soto"},
}


def test_setup_needed_on_empty_db(client):
    assert client.get("/api/v1/setup").json() == {"needed": True}


def test_setup_creates_owner_parent_and_family(client, db):
    r = client.post("/api/v1/setup", json=BODY)
    assert r.status_code == 201
    assert r.json()["access_token"]
    u = db.query(User).one()
    assert u.role == UserRole.PARENT
    fam = get_family(db)
    assert (fam.name, fam.timezone, fam.owner_id) == ("Sotos", "America/New_York", u.id)
    assert client.get("/api/v1/setup").json() == {"needed": False}


def test_setup_twice_returns_409(client):
    client.post("/api/v1/setup", json=BODY)
    r = client.post("/api/v1/setup", json=BODY)
    assert r.status_code == 409
    assert r.json()["detail"] == "Setup is already done. Log in instead."


def test_require_parent_rejects_kid(kid, parent):
    with pytest.raises(HTTPException) as e:
        require_parent(kid)
    assert e.value.status_code == 403
    assert require_parent(parent) is parent
