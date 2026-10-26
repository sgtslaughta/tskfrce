from datetime import UTC, date, datetime, timedelta

from app.lock import activity
from app.lock.overrides import set_override
from app.lock.state import tick
from app.models.chores import ChoreRun
from app.models.device_activity import DeviceEvent, DevicePresence
from app.models.family import get_family
from app.models.lock import Device
from tests.factories import make_run

NOW = datetime(2026, 10, 20, 15, 0, tzinfo=UTC)
DAY = date(2026, 10, 20)


def _kid_device(db, parent, kid, approved=False):
    get_family(db).last_reset_date = DAY
    d = Device(mac="aa:bb:cc:dd:ee:01", name="Dev", status="assigned")
    d.owners = [kid]
    db.add(d)
    make_run(db, parent, kid, status="done" if approved else "todo", approved=approved)
    db.commit()
    return d


def _events(db, kind=None):
    q = db.query(DeviceEvent)
    return (q.filter(DeviceEvent.kind == kind) if kind else q).all()


def test_lock_and_unlock_logged(db, parent, kid):
    d = _kid_device(db, parent, kid)
    tick(db, NOW)
    (e,) = _events(db)
    assert (e.kind, e.reason, e.device_id) == ("locked", "chores", d.id)
    assert d.blocked_since is not None
    db.query(ChoreRun).update({"status": "done", "approved_by_id": parent.id})
    db.commit()
    tick(db, NOW + timedelta(minutes=1))
    assert sorted((e.kind, e.reason) for e in _events(db)) == [
        ("locked", "chores"),
        ("unlocked", "chores"),
    ]
    assert d.blocked_since is None
    tick(db, NOW + timedelta(minutes=2))
    assert len(_events(db)) == 2


def test_manual_lock_records_who(db, parent, kid):
    d = Device(mac="aa:bb:cc:dd:ee:02", name="Dev", status="guest")
    db.add(d)
    db.commit()
    set_override(db, [d.id], "lock", 30, parent.id)
    db.commit()
    tick(db, datetime.now(UTC))
    (e,) = _events(db)
    assert (e.kind, e.reason, e.by_id, e.minutes) == ("locked", "manual", parent.id, 30)


def test_left_wifi(db, parent, kid):
    d = _kid_device(db, parent, kid)
    t = NOW.replace(tzinfo=None)
    tick(db, NOW)
    d.last_seen = t + timedelta(seconds=60)
    db.commit()
    tick(db, NOW + timedelta(minutes=4))
    assert _events(db, "left_wifi") == []
    tick(db, NOW + timedelta(minutes=6))
    (e,) = _events(db, "left_wifi")
    assert e.minutes == 1
    tick(db, NOW + timedelta(minutes=7))
    assert len(_events(db, "left_wifi")) == 1


def test_left_wifi_not_when_seen(db, parent, kid):
    d = _kid_device(db, parent, kid)
    tick(db, NOW)
    d.last_seen = NOW.replace(tzinfo=None) + timedelta(minutes=5)
    db.commit()
    tick(db, NOW + timedelta(minutes=6))
    assert _events(db, "left_wifi") == []


def test_prune(db, parent, kid):
    d = _kid_device(db, parent, kid)
    n = NOW.replace(tzinfo=None)
    for days in (9, 1):
        db.add(DevicePresence(device_id=d.id, slot=n - timedelta(days=days)))
    for days in (31, 1):
        db.add(DeviceEvent(device_id=d.id, kind="sign_in", at=n - timedelta(days=days)))
    db.commit()
    activity._last_prune = None
    activity.prune(db, n)
    db.commit()
    assert db.query(DevicePresence).count() == 1
    assert db.query(DeviceEvent).count() == 1


def test_log_merges(db, parent, kid):
    d = _kid_device(db, parent, kid)
    n = NOW.replace(tzinfo=None)
    a = activity.log(db, d.id, "locked_try", n, merge_minutes=30)
    b = activity.log(db, d.id, "locked_try", n + timedelta(minutes=10), merge_minutes=30)
    c = activity.log(db, d.id, "locked_try", n + timedelta(minutes=50), merge_minutes=30)
    assert a is b and a.count == 2 and c is not a
