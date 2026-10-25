from datetime import UTC, date, datetime, timedelta

from app.models.chore_extra import ChorePhoto
from app.models.chores import ChoreRun
from app.models.family import get_family
from app.models.lock import Device
from app.models.points import Points, PointsType
from app.models.reward import Redemption
from app.models.user import UserRole

from tests.conftest import _headers, _make_user
from tests.factories import api_chore

DAY = date(2026, 10, 20)


def _setup(db):
    get_family(db).last_reset_date = DAY
    db.commit()
    a = _make_user(db, "leo", UserRole.KID)
    b = _make_user(db, "maya", UserRole.KID)
    return a, b, _headers(db, a), _headers(db, b)


def _create(client, ph, kids, mode="each", **kw):
    kw.setdefault("points", 10)
    api_chore(client, ph, kids, mode, **kw)


def _ids(client, h):
    return [c["id"] for c in client.get("/api/v1/kid/today", headers=h).json()["chores"]]


def _today(client, ph):
    r = client.get("/api/v1/today", headers=ph)
    assert r.status_code == 200, r.text
    return r.json()


def test_needs_you_mixes_types_oldest_first(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _create(client, parent_headers, [a], title="Dishes")
    _create(client, parent_headers, [b], title="Bins")
    da, bb = _ids(client, ha)[0], _ids(client, hb)[0]
    client.post(f"/api/v1/kid/chores/{da}/done", headers=ha)
    client.post(f"/api/v1/kid/chores/{bb}/done", headers=hb)
    old = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=3)
    t = db.get(ChoreRun, bb)
    t.attempt, t.submitted_at = 2, old
    db.add(
        Redemption(
            kid_id=a.id,
            kind="screen_time",
            minutes=30,
            cost=20,
            status="pending",
            created_at=old + timedelta(hours=1),
        )
    )
    db.add(Points(user_id=a.id, points_type=PointsType.BONUS, amount=50, description="t"))
    db.commit()
    n = _today(client, parent_headers)["needs_you"]
    assert [x["type"] for x in n] == ["redo", "screen_time", "chore"]
    assert n[0]["attempt"] == 2 and n[0]["kid_name"] == b.full_name and n[0]["id"] == bb
    assert n[1]["cost"] == 20 and n[1]["kid_balance"] == 50 and n[1]["kid_id"] == a.id
    assert n[2]["subtasks_total"] == 0 and n[2]["submitted_at"].endswith("Z")


def test_needs_you_thumb_url_current_attempt(client, db, parent_headers):
    a, _, ha, _ = _setup(db)
    _create(client, parent_headers, [a])
    cid = _ids(client, ha)[0]
    client.post(f"/api/v1/kid/chores/{cid}/done", headers=ha)
    db.add(ChorePhoto(run_id=cid, attempt=1, uploaded_by_id=a.id, path="p", thumb_path="t"))
    db.commit()
    pid = db.query(ChorePhoto).one().id
    n = _today(client, parent_headers)["needs_you"]
    assert n[0]["thumb_url"] == f"/chore-photos/{pid}/thumb"


def test_kid_counts_and_last_active(client, db, parent_headers):
    a, b, ha, _ = _setup(db)
    _create(client, parent_headers, [a], title="One")
    _create(client, parent_headers, [a], title="Two")
    cid = _ids(client, ha)[0]
    client.post(f"/api/v1/kid/chores/{cid}/done", headers=ha)
    for i, mins in enumerate((50, 5)):
        d = Device(mac=f"aa:bb:cc:dd:ee:0{i}", name=f"D{i}", status="assigned")
        d.last_seen = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=mins)
        d.owners.append(a)
        db.add(d)
    db.commit()
    kids = {k["id"]: k for k in _today(client, parent_headers)["kids"]}
    ka = kids[a.id]
    assert (ka["done"], ka["total"], ka["needs_you_count"]) == (0, 2, 1)
    assert ka["last_active"].endswith("Z")
    assert abs(
        datetime.fromisoformat(ka["last_active"].replace("Z", "+00:00"))
        - (datetime.now(UTC) - timedelta(minutes=5))
    ) < timedelta(minutes=1)
    assert kids[b.id]["last_active"] is None and kids[b.id]["total"] == 0
    c = ka["chores"][0]
    for key in ("due_time", "mode", "subtasks_done", "subtasks_total", "attempt", "last_note"):
        assert key in c


def test_shared_race_under_both_kids_and_taken_by(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _create(client, parent_headers, [a, b], "race")
    cid = _ids(client, hb)[0]
    kids = {k["id"]: k for k in _today(client, parent_headers)["kids"]}
    assert kids[a.id]["chores"][0]["id"] == kids[b.id]["chores"][0]["id"] == cid
    assert kids[a.id]["chores"][0]["mode"] == "race"
    assert kids[a.id]["chores"][0].get("taken_by") is None
    client.post(f"/api/v1/kid/chores/{cid}/done", headers=hb)
    client.post(f"/api/v1/chores/{cid}/approve", headers=parent_headers)
    kids = {k["id"]: k for k in _today(client, parent_headers)["kids"]}
    assert kids[a.id]["chores"][0]["taken_by"] == b.full_name
    assert kids[a.id]["chores"][0]["state"] == "done"
    assert kids[a.id]["done"] == 1


def test_kid_points_next_reward_and_locks_at(client, db, parent_headers):
    from app.models.lock import TimeWindow
    from app.models.reward import Reward

    a, b, _, _ = _setup(db)
    db.add(Points(user_id=a.id, points_type=PointsType.BONUS, amount=30, description="t"))
    db.add_all([Reward(name="Cheap", price=20), Reward(name="Big", price=70)])
    db.add(TimeWindow(kind="allowed", days="0123456", start="00:00", end="23:59", kid_id=a.id))
    db.commit()
    kids = {k["id"]: k for k in _today(client, parent_headers)["kids"]}
    assert kids[a.id]["points"] == 30
    assert kids[a.id]["next_reward"] == 40  # 70 - 30; "Cheap" is already affordable
    locks = kids[a.id]["locks_at"]  # None only in the last minute of the local day
    assert locks is None or datetime.fromisoformat(locks.replace("Z", "+00:00")) > datetime.now(UTC)
    assert kids[b.id]["locks_at"] is None and kids[b.id]["next_reward"] == 20
