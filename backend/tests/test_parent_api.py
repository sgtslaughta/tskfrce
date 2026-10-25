from datetime import UTC, date, datetime, timedelta

from app.lock.state import tick
from app.models.badge import BadgeAward
from app.models.chore_extra import ChorePhoto
from app.models.chores import ChoreAssignment, ChoreRun, RunStepTick
from app.models.family import get_family
from app.models.lock import Device, DeviceGroup, Override, TimeWindow
from app.models.points import Points, PointsType
from app.models.reward import Redemption
from app.services import chores as svc

from tests.factories import api_chore, make_run

DAY = date(2026, 10, 20)


def mkdev(db, mac="aa:bb:cc:dd:ee:01", status="unassigned"):
    d = Device(mac=mac, name="Tablet", status=status)
    db.add(d)
    db.commit()
    return d


def mkchore(db, parent, kid, status="todo", approved=False, title="x", steps=()):
    return make_run(db, parent, kid, status=status, approved=approved, title=title, steps=steps)


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


def test_unlock_timer_expires(client, db, parent, kid, parent_headers, monkeypatch):
    # Pin the clock to the fixture chore day: with real wall-clock time, tick() sees a new
    # day and runs the daily reset, which clears the pending chore (device stays online).
    now = datetime(2026, 10, 20, 16, 0, tzinfo=UTC)

    class FrozenDT(datetime):
        @classmethod
        def now(cls, tz=None):
            return now

    monkeypatch.setattr("app.lock.overrides.datetime", FrozenDT)
    setup_day(db)
    d = mkdev(db)
    assign(client, parent_headers, d, kid)
    mkchore(db, parent, kid)  # pending chore -> offline
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
    mkchore(db, parent, kid, "done", approved=True, title="a")
    mkchore(db, parent, kid, "submitted", title="b")
    mkchore(db, parent, kid, "done", approved=False, title="c")  # not approved
    mkchore(db, parent, kid, "todo", title="d")
    j = client.get("/api/v1/today", headers=parent_headers).json()
    assert set(j) == {"day", "pending_approvals", "new_devices", "needs_you", "kids"}
    assert j["day"] == "2026-10-20" and j["pending_approvals"] == 1
    assert len(j["new_devices"]) == 1
    k = j["kids"][0]
    assert set(k) == {
        "id",
        "name",
        "points",
        "next_reward",
        "locks_at",
        "avatar",
        "online_all",
        "done",
        "total",
        "needs_you_count",
        "last_active",
        "progress",
        "chores",
        "devices",
    }
    assert [c["state"] for c in k["chores"]] == ["done", "needs_you", "todo", "todo"]
    assert {"id", "title", "points", "state", "mode", "taken_by"} <= set(k["chores"][0])
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


def test_delete_kid_removes_points_and_requests(client, db, parent, kid, parent_headers):
    t = mkchore(db, parent, kid)
    db.add(ChorePhoto(run_id=t.id, uploaded_by_id=kid.id, path="x.jpg", thumb_path="x_t.jpg"))
    db.add(Points(user_id=kid.id, points_type=PointsType.BONUS, amount=5))
    db.add(Redemption(kid_id=kid.id, kind="screen_time", minutes=15, cost=5))
    db.add(BadgeAward(kid_id=kid.id, badge_key="first_blood", tier=1))
    db.commit()
    assert client.delete(f"/api/v1/kids/{kid.id}", headers=parent_headers).status_code == 200
    assert db.query(Points).count() == 0
    assert db.query(Redemption).count() == 0
    assert db.query(BadgeAward).count() == 0
    assert db.query(ChorePhoto).count() == 0
    assert db.query(ChoreRun).count() == 0
    assert client.get("/api/v1/redemptions", headers=parent_headers).json() == []


def test_delete_kid_removes_their_runs_and_stops_generation(
    client, db, parent, kid, parent_headers
):
    setup_day(db)
    api_chore(client, parent_headers, [kid], title="Dishes")
    done = mkchore(db, parent, kid, "done", approved=True)
    db.add(RunStepTick(run_id=done.id, step_id=_step(db, done), done_by_id=kid.id))
    db.commit()
    r = client.delete(f"/api/v1/kids/{kid.id}", headers=parent_headers)
    assert r.status_code == 200
    db.expire_all()
    assert db.query(ChoreRun).count() == 0
    assert db.query(ChoreAssignment).filter(ChoreAssignment.active.is_(True)).count() == 0
    assert svc.run_reset(db, date(2026, 10, 21)) == 0


def _step(db, run):
    from app.models.chores import ChoreStep

    c = run.assignment.chore
    s = ChoreStep(chore_id=c.id, title="s", position=0)
    db.add(s)
    db.flush()
    return s.id


def test_legacy_user_delete_refuses_kids(client, db, parent, kid, parent_headers):
    parent.is_superuser = True
    db.commit()
    r = client.delete(f"/api/v1/users/{kid.id}", headers=parent_headers)
    assert r.status_code == 403 and r.json()["detail"] == "Use the kids screen to remove a kid."


def test_device_datetimes_are_utc_z(client, db, parent_headers):
    d = mkdev(db)
    d.last_seen = datetime(2026, 10, 20, 12, 0, 0)
    db.commit()
    client.post(
        f"/api/v1/devices/{d.id}/override",
        json={"action": "lock", "minutes": 5},
        headers=parent_headers,
    )
    j = client.get("/api/v1/devices", headers=parent_headers).json()[0]
    assert j["last_seen"] == "2026-10-20T12:00:00Z"
    assert j["override"]["expires_at"].endswith("Z")


def test_owner_ids_keep_explicit_guest(client, db, kid, parent_headers):
    d = mkdev(db)
    url = f"/api/v1/devices/{d.id}"
    r = client.patch(url, json={"owner_ids": [kid.id], "status": "guest"}, headers=parent_headers)
    assert r.json()["status"] == "guest"
    r = client.patch(url, json={"owner_ids": []}, headers=parent_headers)
    assert r.json()["status"] == "guest"
    client.patch(url, json={"owner_ids": [kid.id], "status": "assigned"}, headers=parent_headers)
    r = client.patch(url, json={"owner_ids": []}, headers=parent_headers)
    assert r.json()["status"] == "unassigned"


def test_hhmm_rejects_trailing_newline(client, kid, parent_headers):
    body = {"kind": "allowed", "kid_id": kid.id, "days": "1", "start": "08:00\n", "end": "20:00"}
    assert client.post("/api/v1/windows", json=body, headers=parent_headers).status_code == 422


def test_window_needs_a_target(client, parent_headers):
    body = {"kind": "allowed", "days": "1", "start": "08:00", "end": "20:00"}
    r = client.post("/api/v1/windows", json=body, headers=parent_headers)
    assert r.status_code == 400 and r.json()["detail"] == "Pick a kid or a group."


def test_today_online_all_false_without_devices(client, db, kid, parent_headers):
    setup_day(db)
    k = client.get("/api/v1/today", headers=parent_headers).json()["kids"][0]
    assert k["devices"] == [] and k["online_all"] is False


def test_clear_pin(client, db, parent_headers):
    k = client.post(
        "/api/v1/kids", json={"full_name": "Sam", "pin": "1234"}, headers=parent_headers
    ).json()
    r = client.patch(f"/api/v1/kids/{k['id']}", json={"clear_pin": True}, headers=parent_headers)
    assert r.json()["has_pin"] is False


# Task 2: Family accent + run detail


def test_family_accent_default_neon(client, db, parent_headers):
    r = client.get("/api/v1/family", headers=parent_headers)
    assert r.status_code == 200
    assert r.json()["accent"] == "neon"


def test_patch_family_accent_rejects_unknown(client, db, parent_headers):
    r = client.patch("/api/v1/family", json={"accent": "purple"}, headers=parent_headers)
    assert r.status_code == 422


def test_patch_family_accent_accepts_valid(client, db, parent_headers):
    r = client.patch("/api/v1/family", json={"accent": "lilac"}, headers=parent_headers)
    assert r.status_code == 200
    assert r.json()["accent"] == "lilac"
    r = client.get("/api/v1/family", headers=parent_headers)
    assert r.json()["accent"] == "lilac"


def test_run_detail_steps_have_done_at(client, db, parent, kid, parent_headers):
    setup_day(db)
    run = mkchore(db, parent, kid, status="submitted", steps=["Step 1", "Step 2"])
    # Tick one step
    step = run.assignment.chore.steps[0]
    tick_obj = RunStepTick(
        run_id=run.id, step_id=step.id, done_by_id=kid.id, done_at=datetime.now(UTC)
    )
    db.add(tick_obj)
    db.commit()

    r = client.get(f"/api/v1/chores/{run.id}", headers=parent_headers)
    assert r.status_code == 200
    data = r.json()
    steps = data["steps"]
    assert len(steps) > 0
    # First step should have done_at set
    assert steps[0]["done_at"] is not None
    # Other steps should be null
    for step in steps[1:]:
        assert step["done_at"] is None


def test_run_detail_photos(client, db, parent, kid, parent_headers):
    setup_day(db)
    run = mkchore(db, parent, kid, status="submitted", steps=["Step 1"])
    photo = ChorePhoto(
        run_id=run.id,
        attempt=1,
        uploaded_by_id=kid.id,
        path="test.jpg",
        thumb_path="test_thumb.jpg",
    )
    db.add(photo)
    db.commit()

    r = client.get(f"/api/v1/chores/{run.id}", headers=parent_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data["photos"]) == 1
    assert "thumb_url" in data["photos"][0]


def test_run_detail_kid_forbidden(client, db, parent, kid, kid_headers):
    setup_day(db)
    run = mkchore(db, parent, kid, status="submitted", steps=["Step 1"])

    r = client.get(f"/api/v1/chores/{run.id}", headers=kid_headers)
    assert r.status_code == 403
