import pytest
from app.core.config import settings

URL = "/api/v1/kids"


@pytest.fixture
def cfg(monkeypatch):
    monkeypatch.setattr(settings, "NTFY_URL", "http://ntfy:80")
    monkeypatch.setattr(settings, "BOX_URL", "http://192.168.1.20:3000")
    monkeypatch.setattr(settings, "NTFY_PUBLIC_URL", None)


def test_push_disabled_shape(client, kid, parent_headers, monkeypatch):
    monkeypatch.setattr(settings, "NTFY_URL", None)
    r = client.get(f"{URL}/{kid.id}/push", headers=parent_headers)
    assert r.status_code == 200
    assert r.json() == {
        "enabled": False,
        "server": None,
        "topic": None,
        "link": None,
        "qr_svg": None,
    }


def test_push_creates_topic_once(client, kid, parent_headers, cfg):
    a = client.get(f"{URL}/{kid.id}/push", headers=parent_headers).json()
    b = client.get(f"{URL}/{kid.id}/push", headers=parent_headers).json()
    assert a["enabled"] and a["topic"] == b["topic"]
    assert a["server"] == "http://192.168.1.20:2586"
    assert a["link"].startswith("ntfy://192.168.1.20:2586/" + a["topic"])
    assert "secure=false" in a["link"] and "display=Timmy+chores" in a["link"]
    assert a["qr_svg"].startswith("<svg")


def test_reset_rotates(client, kid, parent_headers, cfg):
    a = client.get(f"{URL}/{kid.id}/push", headers=parent_headers).json()
    b = client.post(f"{URL}/{kid.id}/push/reset", headers=parent_headers).json()
    assert b["topic"] and b["topic"] != a["topic"]
    assert client.get(f"{URL}/{kid.id}/push", headers=parent_headers).json()["topic"] == b["topic"]


def test_unknown_kid_404(client, parent_headers, cfg):
    r = client.get(f"{URL}/999/push", headers=parent_headers)
    assert r.status_code == 404
    assert r.json()["detail"] == "That kid doesn't exist. Pick a kid from the list."


def test_patch_family_relay_writes_conf(client, parent_headers, tmp_path, monkeypatch):
    f = tmp_path / "server.yml"
    monkeypatch.setattr(settings, "NTFY_CONF_FILE", str(f))
    r = client.patch("/api/v1/family", json={"ntfy_upstream_relay": True}, headers=parent_headers)
    assert r.status_code == 200 and r.json()["ntfy_upstream_relay"] is True
    assert (
        client.get("/api/v1/family", headers=parent_headers).json()["ntfy_upstream_relay"] is True
    )
    assert "upstream-base-url" in f.read_text()
    client.patch("/api/v1/family", json={"ntfy_upstream_relay": False}, headers=parent_headers)
    assert "upstream" not in f.read_text()
    r = client.patch(
        "/api/v1/family", json={"ntfy_upstream_relay": "maybe"}, headers=parent_headers
    )
    assert r.status_code == 422


def test_kid_token_forbidden(client, kid, kid_headers, cfg):
    assert client.get(f"{URL}/{kid.id}/push", headers=kid_headers).status_code == 403
    assert client.post(f"{URL}/{kid.id}/push/reset", headers=kid_headers).status_code == 403
