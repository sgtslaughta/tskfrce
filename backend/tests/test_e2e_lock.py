"""End-to-end lock flow through the real API, plus the kid escape attacks."""

from datetime import UTC, date, datetime, timedelta

from app.core.config import settings
from app.lock.state import desired_blocked, tick
from app.main import app
from app.models.chores import ChoreRun
from app.models.family import get_family
from app.models.lock import Override
from app.models.task import Task
from app.services import chores as svc
from fastapi.testclient import TestClient

KID_IP = "192.168.1.50"
MAC = "aa:bb:cc:dd:ee:01"
GMAC = "aa:bb:cc:dd:ee:02"


def tok():
    return {"X-Internal-Token": settings.INTERNAL_TOKEN}


def from_ip(ip):
    async def asgi(scope, receive, send):
        if scope["type"] == "http":
            scope["client"] = (ip, 5000)
        await app(scope, receive, send)

    return TestClient(asgi, base_url="http://localhost")


def blocked(c):
    return c.get("/api/v1/internal/state", headers=tok()).json()["blocked"]


def _setup(client):
    r = client.post(
        "/api/v1/setup",
        json={
            "family_name": "F",
            "timezone": "UTC",
            "parent": {"username": "mom", "password": "pw-123456", "full_name": "Mom"},
        },
    )
    assert r.status_code == 201, r.text
    ph = {"Authorization": f"Bearer {r.json()['access_token']}"}
    kid = client.post("/api/v1/kids", json={"full_name": "Tim"}, headers=ph).json()
    dev = client.post(
        "/api/v1/internal/devices/seen", json={"mac": MAC, "ip": KID_IP}, headers=tok()
    ).json()
    return ph, kid, dev


def _dishes(client, ph, kid):
    """A daily chore for the kid; returns the chore, assignment and today's run id."""
    chore = client.post("/api/v1/chores/", json={"title": "Dishes"}, headers=ph).json()
    a = client.post(
        f"/api/v1/chores/{chore['id']}/assignments",
        json={"kid_ids": [kid["id"]], "repeat": {"type": "daily"}},
        headers=ph,
    ).json()
    run = client.get("/api/v1/chores/today", headers=ph).json()[str(kid["id"])][0]
    return {"definition": chore, "assignment": a, "instance": run}


def _kid_with_chore(client):
    ph, kid, dev = _setup(client)
    client.patch(f"/api/v1/devices/{dev['id']}", json={"owner_ids": [kid["id"]]}, headers=ph)
    ch = _dishes(client, ph, kid)
    kc = from_ip(KID_IP)
    kt = kc.post("/api/v1/kid/login", json={"kid_id": kid["id"]}).json()["access_token"]
    return ph, kid, dev, ch, kc, {"Authorization": f"Bearer {kt}"}


def test_full_flow(client, db):
    ph, kid, dev = _setup(client)
    assert blocked(client) == [MAC]  # quarantine
    r = client.patch(f"/api/v1/devices/{dev['id']}", json={"owner_ids": [kid["id"]]}, headers=ph)
    assert r.json()["status"] == "assigned"
    assert blocked(client) == []  # no chores yet
    ch = _dishes(client, ph, kid)
    inst = ch["instance"]["id"]
    assert blocked(client) == [MAC]
    tick(db, datetime.now(UTC))  # reset keeps it, creates no duplicate
    assert blocked(client) == [MAC]
    kc = from_ip(KID_IP)
    assert kc.get("/api/v1/kid/whoami").json()["kids"][0]["id"] == kid["id"]
    kt = kc.post("/api/v1/kid/login", json={"kid_id": kid["id"]}).json()["access_token"]
    kh = {"Authorization": f"Bearer {kt}"}
    assert kc.get("/api/v1/kid/today", headers=kh).json()["locked"] is True
    assert kc.post(f"/api/v1/kid/chores/{inst}/done", headers=kh).status_code == 200
    assert blocked(client) == [MAC]  # still needs approval
    assert kc.post(f"/api/v1/chores/{inst}/approve", headers=kh).status_code == 403
    assert client.post(f"/api/v1/chores/{inst}/approve", headers=ph).status_code == 200
    assert blocked(client) == []
    # manual lock timer
    client.post(
        f"/api/v1/devices/{dev['id']}/override", json={"action": "lock", "minutes": 5}, headers=ph
    )
    assert blocked(client) == [MAC]
    db.query(Override).update({"expires_at": datetime.utcnow() - timedelta(seconds=1)})
    db.commit()
    assert blocked(client) == []
    # guest
    g = client.post("/api/v1/internal/devices/seen", json={"mac": GMAC}, headers=tok()).json()
    client.patch(f"/api/v1/devices/{g['id']}", json={"status": "guest"}, headers=ph)
    assert GMAC not in blocked(client)
    # group allowed window that excludes now -> blocked
    now = datetime.now(UTC)
    start, end = ((now + timedelta(hours=h)).strftime("%H:%M") for h in (3, 4))
    grp = client.post(
        "/api/v1/groups", json={"name": "Tabs", "device_ids": [dev["id"]]}, headers=ph
    ).json()
    r = client.post(
        "/api/v1/windows",
        json={
            "kind": "allowed",
            "days": "0123456",
            "start": start,
            "end": end,
            "group_id": grp["id"],
        },
        headers=ph,
    )
    assert r.status_code == 200, r.text
    assert MAC in blocked(client)


def test_kid_free_window_unlocks(client, db):
    ph, kid, dev, *_ = _kid_with_chore(client)
    assert blocked(client) == [MAC]
    client.post(
        "/api/v1/windows",
        json={
            "kind": "free",
            "days": "0123456",
            "start": "00:00",
            "end": "00:00",
            "kid_id": kid["id"],
        },
        headers=ph,
    )
    assert blocked(client) == []


def test_kid_cannot_escape_by_deleting_chore(client, db):
    _, _, _, ch, kc, kh = _kid_with_chore(client)
    assert blocked(client) == [MAC]
    for url in (
        f"/api/v1/chores/{ch['definition']['id']}",
        f"/api/v1/assignments/{ch['assignment']['id']}",
    ):
        r = kc.delete(url, headers=kh)
        assert r.status_code == 403, r.text
    assert blocked(client) == [MAC]


def test_kid_cannot_preempt_tomorrows_instance(client, db):
    _, kid, _, ch, kc, kh = _kid_with_chore(client)
    tomorrow = svc.today(db) + timedelta(days=1)  # the family's day, at any wall-clock time
    # a placeholder row a kid slipped in some other way is not a run
    db.add(
        Task(
            title="x",
            created_by_id=kid["id"],
            assigned_to_id=kid["id"],
            due_date=datetime.combine(tomorrow, datetime.min.time()),
        )
    )
    db.commit()
    # tomorrow's run is made by the reset only, once; the kid stays blocked
    assert svc.run_reset(db, tomorrow) == 1
    db.commit()
    assert db.query(ChoreRun).filter(ChoreRun.day == tomorrow).count() == 1
    assert desired_blocked(db, datetime.now(UTC)) == [MAC]


def test_tz_change_backwards_keeps_chore_day(client, db):
    fam = get_family(db)
    fam.timezone, fam.reset_time = "Asia/Tokyo", "06:00"
    db.commit()
    now = datetime(2026, 10, 20, 22, 0, tzinfo=UTC)  # Tokyo Oct 21 07:00
    tick(db, now)
    assert fam.last_reset_date == date(2026, 10, 21)
    fam.timezone = "America/Los_Angeles"  # LA Oct 20 15:00
    db.commit()
    tick(db, now)
    assert fam.last_reset_date == date(2026, 10, 21)
