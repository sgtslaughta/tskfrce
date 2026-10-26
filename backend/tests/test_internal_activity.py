from datetime import UTC, datetime, timedelta

from app.core.config import settings
from app.models.device_activity import DeviceEvent, DevicePresence
from app.models.lock import Device

SEEN = "/api/v1/internal/devices/seen"
RES = "/api/v1/internal/devices/resisting"
HITS = "/api/v1/internal/devices/hits"
MAC = "aa:bb:cc:dd:ee:01"
MAC2 = "aa:bb:cc:dd:ee:02"


def tok():
    return {"X-Internal-Token": settings.INTERNAL_TOKEN}


def _now():
    return datetime.now(UTC).replace(tzinfo=None)


def _seen(client, mac=MAC, ip="192.168.1.40", hostname=None):
    r = client.post(SEEN, json={"mac": mac, "ip": ip, "hostname": hostname}, headers=tok())
    assert r.status_code == 200
    return r.json()["id"]


def _events(db, kind):
    db.expire_all()
    return db.query(DeviceEvent).filter(DeviceEvent.kind == kind).order_by(DeviceEvent.id).all()


def test_seen_samples_presence(client, db):
    _seen(client)
    _seen(client)
    assert db.query(DevicePresence).count() == 1


def test_address_change_logged(client, db):
    _seen(client, ip="192.168.1.40")
    assert _events(db, "address_change") == []
    _seen(client, ip="192.168.1.40")
    assert _events(db, "address_change") == []
    _seen(client, ip="192.168.1.42")
    (e,) = _events(db, "address_change")
    assert e.detail == "192.168.1.40 → 192.168.1.42"


def _locked_device(db, minutes_ago):
    d = Device(
        mac=MAC,
        name="Mias-iPad",
        hostname="Mias-iPad",
        status="assigned",
        blocked_since=_now() - timedelta(minutes=minutes_ago),
    )
    db.add(d)
    db.commit()
    return d


def test_new_address_after_lock(client, db):
    old = _locked_device(db, 2)
    new_id = _seen(client, mac=MAC2, ip="192.168.1.60", hostname="mias-ipad")
    (e,) = _events(db, "new_address")
    assert (e.device_id, e.other_device_id, e.minutes) == (old.id, new_id, 2)


def test_new_address_ignored_when_lock_old(client, db):
    _locked_device(db, 15)
    _seen(client, mac=MAC2, ip="192.168.1.60", hostname="mias-ipad")
    assert _events(db, "new_address") == []


def test_bypass_open_and_close(client, db):
    d = Device(mac=MAC, name="Pad", status="assigned")
    db.add(d)
    db.commit()
    client.post(RES, json={"resisting": [MAC]}, headers=tok())
    (e,) = _events(db, "bypass")
    assert e.last_at is None and e.device_id == d.id
    client.post(RES, json={"resisting": [MAC]}, headers=tok())
    assert len(_events(db, "bypass")) == 1
    client.post(RES, json={"resisting": []}, headers=tok())
    (e,) = _events(db, "bypass")
    assert e.last_at is not None


def _blocked(db, mac=MAC):
    d = Device(mac=mac, name="Pad", status="assigned", blocked_since=_now())
    db.add(d)
    db.commit()
    return d


def test_hits_merge_and_reason(client, db, monkeypatch):
    d = _blocked(db)
    monkeypatch.setattr("app.api.internal.block_reason", lambda f, n: "schedule")
    r = client.post(HITS, json={"hits": {MAC: 2, MAC2: 5}}, headers=tok())
    assert r.json() == {"logged": 1}
    client.post(HITS, json={"hits": {MAC: 3}}, headers=tok())
    (e,) = _events(db, "outside_hours")
    assert (e.device_id, e.count, e.reason) == (d.id, 5, "schedule")
    monkeypatch.setattr("app.api.internal.block_reason", lambda f, n: "chores")
    _blocked(db, MAC2)
    client.post(HITS, json={"hits": {MAC2: 1}}, headers=tok())
    (t,) = _events(db, "locked_try")
    assert t.reason == "chores"


def test_hits_unknown_or_unblocked_ignored(client, db):
    db.add(Device(mac=MAC, name="Pad", status="assigned"))
    db.commit()
    r = client.post(HITS, json={"hits": {MAC: 1, MAC2: 1}}, headers=tok())
    assert r.json() == {"logged": 0}


def test_hits_requires_token(client):
    assert client.post(HITS, json={"hits": {}}).status_code == 403
