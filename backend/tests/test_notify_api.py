from app.api.notify import mask
from app.services import notify

U = "json://abcdef:secret@localhost/x"


def _mk(client, h, **kw):
    return client.post("/api/v1/notify/places", json={"name": "Phone", "url": U, **kw}, headers=h)


def test_mask():
    assert mask("discord://abcdefgh/xyz") == "discord://abcd••••"
    assert mask("nothing") == "••••"


def test_create_list_never_raw(client, parent_headers):
    r = _mk(client, parent_headers)
    assert r.status_code == 201 and r.json()["events"] == list(notify.DEFAULT_EVENTS)
    assert "abcdef" not in r.text and "secret" not in r.text
    res = client.get("/api/v1/notify/places", headers=parent_headers)
    assert "abcdef" not in res.text and res.json()[0]["url_mask"] == "json://abcd••••"
    assert res.json()[0]["readable"] is True


def test_bad_url_422_no_echo(client, parent_headers):
    for bad in ("nonsense-xyzzy", "json://" + "q" * 1100, ""):
        r = _mk(client, parent_headers, url=bad)
        assert r.status_code == 422
        assert "Apprise can't read that address" in r.text
        assert bad == "" or bad not in r.text


def test_unknown_event_422(client, parent_headers):
    r = _mk(client, parent_headers, events=["nope"])
    assert r.status_code == 422 and r.json()["detail"] == "Pick events from the list."


def test_kid_forbidden(client, kid_headers):
    assert client.get("/api/v1/notify/places", headers=kid_headers).status_code == 403
    assert client.get("/api/v1/notify/settings", headers=kid_headers).status_code == 403


def test_patch_delete(client, parent_headers):
    pid = _mk(client, parent_headers).json()["id"]
    u = f"/api/v1/notify/places/{pid}"
    r = client.patch(u, json={"events": ["badge"], "enabled": False}, headers=parent_headers)
    assert r.json()["events"] == ["badge"] and r.json()["enabled"] is False
    r = client.patch(u, json={"url": "bad-xyzzy"}, headers=parent_headers)
    assert r.status_code == 422 and "bad-xyzzy" not in r.text
    assert client.delete(u, headers=parent_headers).status_code == 204
    r = client.patch(u, json={"name": "x"}, headers=parent_headers)
    assert r.status_code == 404 and r.json()["detail"] == "That place doesn't exist."


def test_test_endpoint(client, parent_headers, monkeypatch):
    pid = _mk(client, parent_headers).json()["id"]
    monkeypatch.setattr(notify, "deliver", lambda u, t, b: (False, "401 Unauthorized"))
    r = client.post(f"/api/v1/notify/places/{pid}/test", headers=parent_headers)
    assert r.json() == {"ok": False, "error": "401 Unauthorized"}


def test_test_unreadable(client, parent_headers, db):
    from app.models.notify import NotifyPlace

    pid = _mk(client, parent_headers).json()["id"]
    db.get(NotifyPlace, pid).url_enc = "garbage"
    db.commit()
    places = client.get("/api/v1/notify/places", headers=parent_headers).json()
    assert places[0]["readable"] is False
    r = client.post(f"/api/v1/notify/places/{pid}/test", headers=parent_headers)
    assert r.json() == {"ok": False, "error": "Re-enter this address."}


def test_settings(client, parent_headers):
    h = parent_headers
    r = client.patch(
        "/api/v1/notify/settings",
        json={"quiet_start": "21:30", "quiet_end": "07:00", "app_address": "http://chores.local/"},
        headers=h,
    )
    assert r.status_code == 200
    d = client.get("/api/v1/notify/settings", headers=h).json()
    assert d["app_address"] == "http://chores.local" and d["quiet_start"] == "21:30"
    assert d["quiet_security"] is True and len(d["events"]) == 10
    assert {e["key"] for e in d["events"] if e["security"]} == {"resisting", "box_offline"}
    r = client.patch("/api/v1/notify/settings", json={"app_address": "chores.local"}, headers=h)
    assert r.status_code == 422
    assert r.json()["detail"] == "Start the address with http:// or https://."
    r = client.patch("/api/v1/notify/settings", json={"app_address": ""}, headers=h)
    assert r.json()["app_address"] is None
    r = client.patch("/api/v1/notify/settings", json={"quiet_start": "25:99"}, headers=h)
    assert r.status_code == 422
