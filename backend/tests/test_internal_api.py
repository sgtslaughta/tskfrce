import asyncio
import threading
import time

from app.core.config import settings
from app.lock import loop
from app.models.lock import Device

BODY = {"mac": "AA:BB:CC:DD:EE:02", "ip": "10.0.0.5", "ipv6": [], "hostname": "pad", "vendor": "X"}
URL = "/api/v1/internal/devices/seen"


def tok():
    return {"X-Internal-Token": settings.INTERNAL_TOKEN}


def test_seen_without_token_403(client):
    assert client.post(URL, json=BODY).status_code == 403
    r = client.post(URL, json=BODY, headers={"X-Internal-Token": "nope"})
    assert r.status_code == 403


def test_seen_upserts_and_state_lists_blocked(client):
    for _ in range(2):
        assert client.post(URL, json=BODY, headers=tok()).status_code == 200
    r = client.get("/api/v1/internal/state", headers=tok())
    assert r.json() == {"blocked": ["aa:bb:cc:dd:ee:02"]}
    assert client.get("/api/v1/internal/state").status_code == 403


def test_seen_invalid_mac_422(client):
    r = client.post(URL, json={**BODY, "mac": "nonsense"}, headers=tok())
    assert r.status_code == 422


def test_seen_dash_mac_normalized(client):
    client.post(URL, json={**BODY, "mac": "AA-BB-CC-DD-EE-09"}, headers=tok())
    r = client.get("/api/v1/internal/state", headers=tok())
    assert r.json() == {"blocked": ["aa:bb:cc:dd:ee:09"]}


def test_report_does_not_overwrite_parent_name(client, db):
    client.post(URL, json=BODY, headers=tok())
    db.query(Device).one().name = "Timmy's iPad"
    db.commit()
    client.post(URL, json={**BODY, "hostname": "new"}, headers=tok())
    db.expire_all()
    assert db.query(Device).one().name == "Timmy's iPad"


def test_trigger_safe_without_loop():
    loop.trigger()


def test_trigger_wakes_running_loop_from_other_thread(monkeypatch):
    calls = []
    monkeypatch.setattr(loop, "_run_once", lambda: calls.append(time.monotonic()))
    monkeypatch.setattr(settings, "LOCK_INTERVAL_SECONDS", 30)

    async def go():
        t = asyncio.create_task(loop.run_forever())
        await asyncio.sleep(1.5)
        t.cancel()

    th = threading.Thread(target=lambda: asyncio.run(go()))
    th.start()
    time.sleep(0.5)
    loop.trigger()
    th.join()
    assert len(calls) == 2
    assert calls[1] - calls[0] < 5
