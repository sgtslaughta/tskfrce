from app.core.config import settings
from app.lock import loop

BODY = {"mac": "AA:BB:CC:DD:EE:02", "ip": "10.0.0.5", "ipv6": [], "hostname": "pad", "vendor": "X"}


def tok():
    return {"X-Internal-Token": settings.INTERNAL_TOKEN}


def test_seen_without_token_403(client):
    assert client.post("/api/v1/internal/devices/seen", json=BODY).status_code == 403
    r = client.post(
        "/api/v1/internal/devices/seen", json=BODY, headers={"X-Internal-Token": "nope"}
    )
    assert r.status_code == 403


def test_seen_upserts_and_state_lists_blocked(client):
    for _ in range(2):
        assert (
            client.post("/api/v1/internal/devices/seen", json=BODY, headers=tok()).status_code
            == 200
        )
    r = client.get("/api/v1/internal/state", headers=tok())
    assert r.json() == {"blocked": ["aa:bb:cc:dd:ee:02"]}
    assert client.get("/api/v1/internal/state").status_code == 403


def test_trigger_is_safe_without_loop():
    loop.trigger()
