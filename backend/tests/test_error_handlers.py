"""Global exception handlers."""

from sqlalchemy.exc import OperationalError


def test_locked_database_maps_to_503(client, monkeypatch):
    def boom(*a, **k):
        raise OperationalError("x", {}, Exception("database is locked"))

    monkeypatch.setattr("app.api.setup._owner_set", boom)
    r = client.get("/api/v1/setup")
    assert r.status_code == 503 and r.json()["detail"] == "Busy, try again."


def test_explicit_404_detail_kept(client, parent_headers):
    r = client.post("/api/v1/chores/999999/approve", headers=parent_headers)
    assert r.status_code == 404 and r.json()["detail"] == "That chore doesn't exist."
    assert client.get("/api/v1/nope-nope").json()["detail"] == "Endpoint not found"
