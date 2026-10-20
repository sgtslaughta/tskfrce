from datetime import UTC, date, datetime, timedelta

from app.lock.state import tick
from app.models.family import get_family
from app.models.lock import Device, DeviceGroup, Override, TimeWindow
from app.models.task import Task, TaskStatus

DAY = date(2026, 10, 20)


def mkdev(db, mac="aa:bb:cc:dd:ee:01", status="unassigned"):
    d = Device(mac=mac, name="Tablet", status=status)
    db.add(d)
    db.commit()
    return d


def mkchore(db, parent, kid, status=TaskStatus.TODO, approved=False, title="x"):
    t = Task(
        title=title,
        created_by_id=parent.id,
        assigned_to_id=kid.id,
        due_date=datetime(2026, 10, 20),
        status=status,
        points=3,
        approved_by_id=parent.id if approved else None,
        recurrence_pattern={"chore": True},
    )
    db.add(t)
    db.commit()
    return t


def setup_day(db):
    get_family(db).last_reset_date = DAY
    db.commit()


def assign(client, headers, dev, kid):
    return client.patch(f"/api/v1/devices/{dev.id}", json={"owner_ids": [kid.id]}, headers=headers)


def test_assign_owner_marks_assigned(client, db, kid, parent_headers):
    d = mkdev(db)
    r = assign(client, parent_headers, d, kid)
    assert r.status_code == 200
    assert r.json()["status"] == "assigned" and r.json()["owner_ids"] == [kid.id]


def test_unlock_timer_expires(client, db, parent, kid, parent_headers):
    setup_day(db)
    d = mkdev(db)
    assign(client, parent_headers, d, kid)
    mkchore(db, parent, kid)  # pending chore -> offline
    now = datetime.now(UTC)
    assert d.mac in tick(db, now)
    r = client.post(
        f"/api/v1/devices/{d.id}/override",
        json={"action": "unlock", "minutes": 1},
        headers=parent_headers,
    )
    assert r.status_code == 200
    assert d.mac not in tick(db, now)
    assert d.mac in tick(db, now + timedelta(minutes=2))


def test_group_override_applies_to_members(client, db, parent_headers):
    a, b = mkdev(db, "aa:bb:cc:dd:ee:01"), mkdev(db, "aa:bb:cc:dd:ee:02")
    g = client.post(
        "/api/v1/groups", json={"name": "Consoles", "device_ids": [a.id]}, headers=parent_headers
    ).json()
    r = client.post(
        f"/api/v1/groups/{g['id']}/override", json={"action": "lock"}, headers=parent_headers
    )
    assert r.status_code == 200
    assert db.query(Override).filter_by(device_id=a.id, action="lock").count() == 1
    assert db.query(Override).filter_by(device_id=b.id).count() == 0
    client.delete(f"/api/v1/groups/{g['id']}/override", headers=parent_headers)
    assert db.query(Override).count() == 0


def test_kid_override_hits_all_owned_devices(client, db, kid, parent_headers):
    a, b, c = (mkdev(db, f"aa:bb:cc:dd:ee:0{i}") for i in (1, 2, 3))
    assign(client, parent_headers, a, kid)
    assign(client, parent_headers, b, kid)
    client.post(
        f"/api/v1/kids/{kid.id}/override",
        json={"action": "lock", "minutes": 30},
        headers=parent_headers,
    )
    ids = {o.device_id for o in db.query(Override).all()}
    assert ids == {a.id, b.id} and c.id not in ids


def test_override_replaces_previous(client, db, parent_headers):
    d = mkdev(db)
    for act in ("lock", "unlock"):
        client.post(
            f"/api/v1/devices/{d.id}/override", json={"action": act}, headers=parent_headers
        )
    rows = db.query(Override).all()
    assert len(rows) == 1 and rows[0].action == "unlock"


def test_override_minutes_validated(client, db, parent_headers):
    d = mkdev(db)
    r = client.post(
        f"/api/v1/devices/{d.id}/override",
        json={"action": "lock", "minutes": 5000},
        headers=parent_headers,
    )
    assert r.status_code == 422


def test_window_both_targets_400(client, db, kid, parent_headers):
    g = DeviceGroup(name="G")
    db.add(g)
    db.commit()
    body = {"kind": "allowed", "days": "0123456", "start": "08:00", "end": "20:00"}
    r = client.post(
        "/api/v1/windows", json={**body, "kid_id": kid.id, "group_id": g.id}, headers=parent_headers
    )
    assert r.status_code == 400 and r.json()["detail"] == "Pick a kid or a group, not both."
    ok = client.post("/api/v1/windows", json={**body, "kid_id": kid.id}, headers=parent_headers)
    assert ok.status_code == 200
    assert len(client.get(f"/api/v1/windows?kid_id={kid.id}", headers=parent_headers).json()) == 1
    assert (
        client.delete(f"/api/v1/windows/{ok.json()['id']}", headers=parent_headers).status_code
        == 200
    )


def test_window_validation(client, kid, parent_headers):
    base = {"kind": "allowed", "kid_id": kid.id, "start": "08:00", "end": "20:00"}
    for bad in ({"days": "00"}, {"days": "7"}, {"days": ""}, {"days": "1", "start": "24:00"}):
        r = client.post(
            "/api/v1/windows", json={**base, "days": "1", **bad}, headers=parent_headers
        )
        assert r.status_code == 422, bad


def test_bad_timezone_400(client, db, parent_headers):
    r = client.patch("/api/v1/family", json={"timezone": "Mars/Base"}, headers=parent_headers)
    assert r.status_code == 400 and r.json()["detail"] == "Unknown time zone."
    r = client.patch(
        "/api/v1/family",
        json={"timezone": "America/New_York", "reset_time": "05:30"},
        headers=parent_headers,
    )
    assert r.status_code == 200 and r.json()["timezone"] == "America/New_York"
    assert client.get("/api/v1/family", headers=parent_headers).json()["reset_time"] == "05:30"
    r = client.patch("/api/v1/family", json={"reset_time": "6:00"}, headers=parent_headers)
    assert r.status_code == 422


def test_today_shape(client, db, parent, kid, parent_headers):
    setup_day(db)
    d = mkdev(db)
    mkdev(db, "aa:bb:cc:dd:ee:02")  # stays unassigned -> new device
    assign(client, parent_headers, d, kid)
    mkchore(db, parent, kid, TaskStatus.DONE, approved=True, title="a")
    mkchore(db, parent, kid, TaskStatus.SUBMITTED_FOR_APPROVAL, title="b")
    mkchore(db, parent, kid, TaskStatus.DONE, approved=False, title="c")  # not approved
    mkchore(db, parent, kid, TaskStatus.TODO, title="d")
    j = client.get("/api/v1/today", headers=parent_headers).json()
    assert set(j) == {"day", "pending_approvals", "new_devices", "kids"}
    assert j["day"] == "2026-10-20" and j["pending_approvals"] == 1
    assert len(j["new_devices"]) == 1
    k = j["kids"][0]
    assert set(k) == {"id", "name", "avatar", "online_all", "chores", "devices"}
    assert [c["state"] for c in k["chores"]] == ["done", "needs_you", "todo", "todo"]
    assert set(k["chores"][0]) == {"id", "title", "points", "state"}
    assert k["devices"][0].keys() == {"id", "name", "vendor", "online"}
    assert k["online_all"] is False


def test_kid_token_gets_403_on_patch_family(client, kid_headers):
    r = client.patch("/api/v1/family", json={"name": "x"}, headers=kid_headers)
    assert r.status_code == 403


def test_create_kid_and_pin(client, db, parent_headers):
    r = client.post(
        "/api/v1/kids", json={"full_name": "Sam Lee", "pin": "1234"}, headers=parent_headers
    )
    assert r.status_code == 200 and r.json()["username"] == "kid-sam-lee"
    assert "pin_hash" not in r.json() and r.json()["has_pin"] is True
    r2 = client.post("/api/v1/kids", json={"full_name": "Sam Lee"}, headers=parent_headers)
    assert r2.json()["username"] == "kid-sam-lee-2"
    bad = client.post(
        "/api/v1/kids", json={"full_name": "X", "pin": "12a4"}, headers=parent_headers
    )
    assert bad.status_code == 422
    assert client.get("/api/v1/kids", headers=parent_headers).status_code == 200


def test_delete_kid_cleans_up(client, db, parent, kid, parent_headers):
    d = mkdev(db)
    shared = mkdev(db, "aa:bb:cc:dd:ee:02")
    other = client.post("/api/v1/kids", json={"full_name": "Zed"}, headers=parent_headers).json()
    assign(client, parent_headers, d, kid)
    client.patch(
        f"/api/v1/devices/{shared.id}",
        json={"owner_ids": [kid.id, other["id"]]},
        headers=parent_headers,
    )
    db.add(TimeWindow(kind="allowed", days="1", start="08:00", end="09:00", kid_id=kid.id))
    db.add(Override(device_id=d.id, action="lock", source="manual", created_by_id=kid.id))
    db.commit()
    r = client.delete(f"/api/v1/kids/{kid.id}", headers=parent_headers)
    assert r.status_code == 200
    db.expire_all()
    assert db.query(TimeWindow).count() == 0
    assert db.query(Override).one().created_by_id is None
    assert d.status == "unassigned" and d.owners == []
    assert shared.status == "assigned" and [o.id for o in shared.owners] == [other["id"]]


def test_delete_device_removes_overrides_and_memberships(client, db, parent_headers):
    d = mkdev(db)
    g = client.post(
        "/api/v1/groups", json={"name": "G", "device_ids": [d.id]}, headers=parent_headers
    ).json()
    client.post(f"/api/v1/devices/{d.id}/override", json={"action": "lock"}, headers=parent_headers)
    assert client.delete(f"/api/v1/devices/{d.id}", headers=parent_headers).status_code == 200
    assert db.query(Override).count() == 0 and db.query(Device).count() == 0
    got = client.get("/api/v1/groups", headers=parent_headers).json()
    assert got == [{"id": g["id"], "name": "G", "device_ids": []}]


def test_delete_group_removes_windows(client, db, parent_headers):
    d = mkdev(db)
    g = client.post(
        "/api/v1/groups", json={"name": "G", "device_ids": [d.id]}, headers=parent_headers
    ).json()
    db.add(TimeWindow(kind="free", days="1", start="08:00", end="09:00", group_id=g["id"]))
    db.commit()
    assert client.delete(f"/api/v1/groups/{g['id']}", headers=parent_headers).status_code == 200
    assert db.query(TimeWindow).count() == 0 and db.query(Device).count() == 1
