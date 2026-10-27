from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.api.devices import device_out
from app.models.device_activity import DeviceEvent, DevicePresence
from app.models.family import get_family
from app.models.lock import Device, Override

from tests.factories import DAY, make_rule, make_run


def _now():
    return datetime.now(UTC).replace(tzinfo=None)


def mkdev(db, mac="aa:bb:cc:dd:ee:01", name="Mia's iPad", owners=(), **kw):
    d = Device(mac=mac, name=name, status="assigned" if owners else "unassigned", **kw)
    d.owners = list(owners)
    db.add(d)
    db.commit()
    return d


def ev(db, d, kind, ago=timedelta(0), **kw):
    e = DeviceEvent(device_id=d.id, kind=kind, at=_now() - ago, **kw)
    db.add(e)
    db.commit()
    return e


def test_activity_counts_and_feed(client, db, kid, parent_headers):
    d = mkdev(db, owners=[kid])
    ev(db, d, "bypass", timedelta(hours=3), kid_id=kid.id)
    ev(db, d, "bypass", timedelta(days=9))
    ev(db, d, "locked_try", timedelta(hours=2), count=4)
    ev(db, d, "outside_hours", timedelta(hours=1), count=2)
    ev(db, d, "sign_in", timedelta(minutes=5), count=3, kid_id=kid.id)
    ev(db, d, "locked", timedelta(hours=4), reason="schedule")
    ev(db, d, "unlocked", timedelta(hours=1), reason="chores")
    r = client.get(f"/api/v1/devices/{d.id}/activity", headers=parent_headers)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["counts"] == {"bypass": 1, "locked_tries": 4, "outside_hours": 2, "wrong_pins": 3}
    assert [e["kind"] for e in j["events"]] == ["sign_in", "outside_hours", "locked_try", "bypass"]
    assert j["events"][0]["kid_name"] == (kid.full_name or kid.username)
    assert j["events"][0]["reviewed"] is False
    assert [e["kind"] for e in j["history"]] == ["unlocked", "locked"]
    assert len(j["days"]) == 7


def test_activity_days_slots(client, db, parent_headers):
    fam = get_family(db)
    fam.timezone = "America/New_York"
    db.commit()
    d = mkdev(db)
    tz = ZoneInfo("America/New_York")
    today = datetime.now(tz).date()
    nine = datetime(today.year, today.month, today.day, 9, 0, tzinfo=tz)
    for i, locked in enumerate((False, True)):
        slot = (nine + timedelta(minutes=10 * i)).astimezone(UTC).replace(tzinfo=None)
        db.add(DevicePresence(device_id=d.id, slot=slot, locked=locked))
    db.commit()
    days = client.get(f"/api/v1/devices/{d.id}/activity", headers=parent_headers).json()["days"]
    assert days[0]["date"] == today.isoformat()
    s = days[0]["slots"]
    assert len(s) == 144 and s[54] == "o" and s[55] == "l" and s.count(".") == 142
    assert days[0]["online_minutes"] == 10
    assert days[1]["date"] == (today - timedelta(days=1)).isoformat()


def test_mark_ok_clears_alert_count(client, db, kid, parent_headers):
    d = mkdev(db, owners=[kid])
    e = ev(db, d, "bypass")

    def alerts():
        rows = client.get("/api/v1/devices", headers=parent_headers).json()
        return next(x for x in rows if x["id"] == d.id)["alerts"]

    assert alerts() == 1
    r = client.post(f"/api/v1/devices/{d.id}/events/{e.id}/ok", headers=parent_headers)
    assert r.json() == {"ok": True}
    assert alerts() == 0
    got = client.get(f"/api/v1/devices/{d.id}/activity", headers=parent_headers).json()
    assert got["events"][0]["reviewed"] is True


def test_ok_unknown_404(client, db, parent_headers):
    d = mkdev(db)
    e = ev(db, mkdev(db, mac="aa:bb:cc:dd:ee:09"), "bypass")
    for eid in (9999, e.id):
        r = client.post(f"/api/v1/devices/{d.id}/events/{eid}/ok", headers=parent_headers)
        assert r.status_code == 404
        assert r.json()["detail"] == "That alert doesn't exist. Refresh and try again."


def test_merge_new_address(client, db, kid, parent_headers):
    old = mkdev(db, owners=[kid], hostname="old")
    new = mkdev(db, mac="aa:bb:cc:dd:ee:02", name="mias-ipad", ip="192.168.1.60")
    new.last_seen = _now()
    db.add(Override(device_id=new.id, action="lock", source="manual", created_at=_now()))
    e = ev(db, old, "new_address", other_device_id=new.id)
    ev(db, new, "bypass")
    old_id, ev_id = old.id, e.id
    r = client.post(f"/api/v1/devices/{old_id}/events/{ev_id}/merge", headers=parent_headers)
    assert r.status_code == 200, r.text
    j = r.json()
    assert (j["id"], j["name"], j["mac"], j["owner_ids"]) == (
        old_id,
        "Mia's iPad",
        "aa:bb:cc:dd:ee:02",
        [kid.id],
    )
    assert j["ip"] == "192.168.1.60"
    db.expire_all()
    assert db.query(Device).count() == 1
    assert db.get(DeviceEvent, ev_id).reviewed_at is not None
    assert db.query(DeviceEvent).filter_by(kind="bypass").count() == 0


def test_merge_wrong_kind_409(client, db, parent_headers):
    d = mkdev(db)
    e = ev(db, d, "bypass")
    r = client.post(f"/api/v1/devices/{d.id}/events/{e.id}/merge", headers=parent_headers)
    assert r.status_code == 409
    assert r.json()["detail"] == "This alert can't merge devices."
    e2 = ev(db, d, "new_address")  # other device gone
    r = client.post(f"/api/v1/devices/{d.id}/events/{e2.id}/merge", headers=parent_headers)
    assert r.status_code == 409


def test_delete_device_cleans_activity(client, db, parent_headers):
    a, b = mkdev(db), mkdev(db, mac="aa:bb:cc:dd:ee:02")
    e = ev(db, b, "new_address", other_device_id=a.id)
    ev(db, a, "bypass")
    db.add(DevicePresence(device_id=a.id, slot=_now().replace(second=0, microsecond=0)))
    db.commit()
    aid, eid = a.id, e.id
    assert client.delete(f"/api/v1/devices/{aid}", headers=parent_headers).status_code == 200
    db.expire_all()
    assert db.query(DeviceEvent).filter_by(device_id=aid).count() == 0
    assert db.query(DevicePresence).filter_by(device_id=aid).count() == 0
    assert db.get(DeviceEvent, eid).other_device_id is None


def test_lock_all_kid_devices(client, db, kid, parent_headers):
    mkdev(db, owners=[kid])
    mkdev(db, mac="aa:bb:cc:dd:ee:02", owners=[kid])
    r = client.post(
        f"/api/v1/kids/{kid.id}/override",
        json={"action": "lock", "minutes": 30},
        headers=parent_headers,
    )
    assert r.json() == {"ok": True, "devices": 2}
    assert db.query(Override).filter_by(action="lock", source="manual").count() == 2


def test_lock_all_errors(client, db, kid, parent, parent_headers):
    body = {"action": "lock"}
    r = client.post(f"/api/v1/kids/{kid.id}/override", json=body, headers=parent_headers)
    assert r.status_code == 409
    assert r.json()["detail"] == f"{kid.full_name or kid.username} has no devices yet."
    r = client.post(f"/api/v1/kids/{parent.id}/override", json=body, headers=parent_headers)
    assert r.status_code == 404
    assert r.json()["detail"] == "That kid doesn't exist. Pick a kid from the list."


def test_exempt_device_out(db, kid):
    d = mkdev(db, owners=[kid], exempt=True)
    fam = get_family(db)
    fam.timezone = "UTC"
    make_rule(db, kid_ids=[kid.id], times=(("01:00", "02:00"),))
    out = device_out(db, d, fam, datetime(2026, 10, 20, 12, 0, tzinfo=UTC))
    assert out["reason"] == "exempt" and out["locks_at"] is None


def test_device_out_reason_and_locks_at(db, parent, kid):
    fam = get_family(db)
    fam.timezone = "America/New_York"
    fam.last_reset_date = DAY
    db.commit()
    d = mkdev(db, owners=[kid])
    make_rule(db, kid_ids=[kid.id], times=(("15:00", "20:00"),))
    make_run(db, parent, kid, status="done", approved=True, title="a")
    make_run(db, parent, kid, status="todo", title="b")
    out = device_out(db, d, fam, datetime(2026, 10, 20, 19, 30, tzinfo=UTC))  # 15:30 local
    assert out["reason"] == "chores"
    assert (out["chores_done"], out["chores_total"]) == (1, 2)
    assert out["locks_at"] == "2026-10-21T00:00:00Z"
    assert out["alerts"] == 0
    assert "address_changes" not in out
    full = device_out(db, d, fam, datetime(2026, 10, 20, 19, 30, tzinfo=UTC), addresses=True)
    assert full["address_changes"] == 0 and full["blocked_since"] is None
    assert date(2026, 10, 20) == DAY


def test_kid_override_route_defined_once():
    from app.main import fastapi_app

    posts = [
        r
        for r in fastapi_app.routes
        if getattr(r, "path", "") == "/api/v1/kids/{kid_id}/override" and "POST" in r.methods
    ]
    assert len(posts) == 1


def test_seen_now_is_presence_not_unlocked(client, db, kid, parent_headers):
    fresh = mkdev(db, owners=[kid], last_seen=_now() - timedelta(minutes=1))
    old = mkdev(db, mac="aa:bb:cc:dd:ee:09", owners=[kid], last_seen=_now() - timedelta(hours=2))
    never = mkdev(db, mac="aa:bb:cc:dd:ee:0a", owners=[kid])
    seen = {
        d["id"]: d["seen_now"] for d in client.get("/api/v1/devices", headers=parent_headers).json()
    }
    assert seen == {fresh.id: True, old.id: False, never.id: False}
