from datetime import UTC, datetime

from app.models.chore_extra import ChorePhoto
from app.models.chores import RunStepTick
from app.models.family import get_family

from tests.test_parent_api import mkchore, mkdev, setup_day


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


def test_kid_age_group_patch(client, kid, parent_headers):
    url = f"/api/v1/kids/{kid.id}"
    assert (
        client.patch(url, json={"age_group": "little"}, headers=parent_headers).json()["age_group"]
        == "little"
    )
    assert client.patch(url, json={"age_group": "baby"}, headers=parent_headers).status_code == 422


def test_group_icon_and_chore_lock(client, parent_headers):
    r = client.post(
        "/api/v1/groups",
        json={"name": "TVs", "icon": "tv", "chore_lock": False},
        headers=parent_headers,
    ).json()
    assert r["icon"] == "tv" and r["chore_lock"] is False


def test_group_patch_keeps_icon(client, db, parent_headers):
    d = mkdev(db)
    g = client.post(
        "/api/v1/groups",
        json={"name": "TVs", "icon": "tv", "chore_lock": False},
        headers=parent_headers,
    ).json()
    r = client.patch(
        f"/api/v1/groups/{g['id']}",
        json={"name": "Screens", "device_ids": [d.id]},
        headers=parent_headers,
    ).json()
    assert r["icon"] == "tv" and r["chore_lock"] is False and r["name"] == "Screens"


def test_family_chores_lock(client, parent_headers):
    assert client.get("/api/v1/family", headers=parent_headers).json()["chores_lock"] is True
    client.patch("/api/v1/family", json={"chores_lock": False}, headers=parent_headers)
    assert client.get("/api/v1/family", headers=parent_headers).json()["chores_lock"] is False


def test_device_exempt_patch(client, db, parent_headers):
    d = mkdev(db)

    def got():
        return client.get("/api/v1/devices", headers=parent_headers).json()[0]

    assert got()["exempt"] is False
    client.patch(f"/api/v1/devices/{d.id}", json={"exempt": True}, headers=parent_headers)
    assert got()["exempt"] is True
    client.patch(f"/api/v1/devices/{d.id}", json={"name": "New"}, headers=parent_headers)
    assert got()["exempt"] is True and got()["name"] == "New"


def test_quick_replies_roundtrip(client, parent_headers):
    d = client.get("/api/v1/family", headers=parent_headers).json()["quick_replies"]
    assert d == ["Looks good", "Can you redo it?", "Retake the photo"]
    r = client.patch("/api/v1/family", json={"quick_replies": ["A", " B "]}, headers=parent_headers)
    assert r.json()["quick_replies"] == ["A", "B"]
    assert client.get("/api/v1/family", headers=parent_headers).json()["quick_replies"] == [
        "A",
        "B",
    ]
    bad = client.patch("/api/v1/family", json={"quick_replies": ["x"] * 9}, headers=parent_headers)
    assert bad.status_code == 422
    bad = client.patch("/api/v1/family", json={"quick_replies": ["x" * 61]}, headers=parent_headers)
    assert bad.status_code == 422


def test_quick_replies_bad_json_falls_back(client, db, parent_headers):
    get_family(db).quick_replies = "{nope"
    db.commit()
    assert len(client.get("/api/v1/family", headers=parent_headers).json()["quick_replies"]) == 3
