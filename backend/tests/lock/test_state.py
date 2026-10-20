from datetime import UTC, date, datetime, timedelta

from app.lock.blocker_client import push_blocked
from app.lock.state import desired_blocked, tick
from app.models.family import get_family
from app.models.lock import Device, Override, TimeWindow
from app.models.task import Task, TaskStatus

NOW = datetime(2026, 10, 20, 15, 0, tzinfo=UTC)  # Tuesday 15:00 UTC
DAY = date(2026, 10, 20)


def mk_device(db, mac="aa:bb:cc:dd:ee:01", status="unassigned", owners=()):
    d = Device(mac=mac, name="Dev", status=status)
    d.owners = list(owners)
    db.add(d)
    db.commit()
    return d


def test_new_device_report_creates_unassigned_blocked(db):
    mk_device(db)
    assert desired_blocked(db, NOW) == ["aa:bb:cc:dd:ee:01"]


def test_guest_never_blocked(db):
    mk_device(db, status="guest")
    assert desired_blocked(db, NOW) == []


def _chore(db, parent, kid, approved):
    db.add(
        Task(
            title="Dishes",
            is_recurring=False,
            recurrence_pattern={"chore": True},
            assigned_to_id=kid.id,
            created_by_id=parent.id,
            due_date=datetime(2026, 10, 20),
            status=TaskStatus.DONE if approved else TaskStatus.TODO,
            approved_by_id=parent.id if approved else None,
        )
    )
    db.commit()


def test_kid_device_unblocked_after_all_approved(db, parent, kid):
    fam = get_family(db)
    fam.last_reset_date = DAY
    db.commit()
    mk_device(db, status="assigned", owners=[kid])
    db.add(TimeWindow(kind="allowed", days="0123456", start="00:00", end="23:59", kid_id=kid.id))
    _chore(db, parent, kid, approved=False)
    assert desired_blocked(db, NOW) == ["aa:bb:cc:dd:ee:01"]
    db.query(Task).update({"status": TaskStatus.DONE, "approved_by_id": parent.id})
    db.commit()
    assert desired_blocked(db, NOW) == []


def test_expired_override_ignored(db):
    d = mk_device(db)  # unassigned + blocked by default
    db.add(
        Override(
            device_id=d.id,
            action="unlock",
            source="manual",
            expires_at=(NOW - timedelta(minutes=1)).replace(tzinfo=None),
        )
    )
    db.commit()
    assert desired_blocked(db, NOW) == [d.mac]
    db.query(Override).update({"expires_at": (NOW + timedelta(hours=1)).replace(tzinfo=None)})
    db.commit()
    assert desired_blocked(db, NOW) == []


def test_newest_unexpired_override_wins(db):
    d = mk_device(db)
    exp = (NOW + timedelta(hours=1)).replace(tzinfo=None)
    old = NOW.replace(tzinfo=None) - timedelta(minutes=10)
    for action, created in (("unlock", old), ("lock", old + timedelta(minutes=5))):
        db.add(
            Override(
                device_id=d.id, action=action, source="manual", expires_at=exp, created_at=created
            )
        )
    db.commit()
    assert desired_blocked(db, NOW) == [d.mac]


def test_tick_deletes_expired_overrides_and_resets(db):
    d = mk_device(db)
    db.add(
        Override(
            device_id=d.id,
            action="unlock",
            source="manual",
            expires_at=(NOW - timedelta(minutes=1)).replace(tzinfo=None),
        )
    )
    db.commit()
    assert tick(db, NOW) == [d.mac]
    assert db.query(Override).count() == 0
    assert get_family(db).last_reset_date == DAY


def test_push_blocked_returns_false_when_blocker_down(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "BLOCKER_URL", "http://127.0.0.1:1")
    assert push_blocked(["aa:bb:cc:dd:ee:01"]) is False


def test_manual_lock_beats_newer_bonus_unlock(db, parent, kid):
    fam = get_family(db)
    fam.points_unlock_early = True
    db.commit()
    d = mk_device(db, status="assigned", owners=[kid])
    exp = (NOW + timedelta(hours=1)).replace(tzinfo=None)
    old = NOW.replace(tzinfo=None) - timedelta(minutes=10)
    db.add(Override(device_id=d.id, action="lock", source="manual", expires_at=exp, created_at=old))
    db.add(
        Override(
            device_id=d.id,
            action="unlock",
            source="bonus",
            expires_at=exp,
            created_at=old + timedelta(minutes=5),
        )
    )
    db.commit()
    assert desired_blocked(db, NOW) == [d.mac]


def test_tz_change_backwards_does_not_rerun_reset(db, parent, kid):
    fam = get_family(db)
    fam.timezone, fam.reset_time = "Asia/Tokyo", "06:00"
    db.commit()
    now = datetime(2026, 10, 20, 22, 0, tzinfo=UTC)  # Tokyo Oct 21 07:00
    mk_device(db, status="assigned", owners=[kid])
    db.add(
        Task(
            title="Dishes",
            is_recurring=True,
            recurrence_pattern={"type": "daily", "chore": True},
            assigned_to_id=kid.id,
            created_by_id=parent.id,
        )
    )
    db.commit()
    assert tick(db, now) == ["aa:bb:cc:dd:ee:01"]
    assert fam.last_reset_date == date(2026, 10, 21)
    db.query(Task).filter(Task.is_recurring.is_(False)).update(
        {"status": TaskStatus.DONE, "approved_by_id": parent.id}
    )
    fam.timezone = "America/Los_Angeles"  # LA Oct 20 15:00
    db.commit()
    assert tick(db, now) == []
    assert fam.last_reset_date == date(2026, 10, 21)
    assert db.query(Task).count() == 2
