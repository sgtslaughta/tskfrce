from datetime import UTC, date, datetime, timedelta

from app.lock.blocker_client import push_blocked
from app.lock.state import desired_blocked, tick
from app.models.chores import ChoreRun
from app.models.family import get_family
from app.models.lock import Device, Override
from tests.factories import make_chore, make_rule, make_run

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
    make_run(db, parent, kid, status="done" if approved else "todo", approved=approved)


def test_kid_device_unblocked_after_all_approved(db, parent, kid):
    fam = get_family(db)
    fam.last_reset_date = DAY
    db.commit()
    mk_device(db, status="assigned", owners=[kid])
    make_rule(db, kid_ids=[kid.id])
    _chore(db, parent, kid, approved=False)
    assert desired_blocked(db, NOW) == ["aa:bb:cc:dd:ee:01"]
    db.query(ChoreRun).update({"status": "done", "approved_by_id": parent.id})
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
    make_chore(db, parent, kids=[kid])
    assert tick(db, now) == ["aa:bb:cc:dd:ee:01"]
    assert fam.last_reset_date == date(2026, 10, 21)
    db.query(ChoreRun).update({"status": "done", "approved_by_id": parent.id})
    fam.timezone = "America/Los_Angeles"  # LA Oct 20 15:00
    db.commit()
    assert tick(db, now) == []
    assert fam.last_reset_date == date(2026, 10, 21)
    assert db.query(ChoreRun).count() == 1


def test_loop_survives_locked_db(monkeypatch):
    from app.lock import loop
    from sqlalchemy.exc import OperationalError

    def boom(db, now):
        raise OperationalError("tick", {}, Exception("database is locked"))

    monkeypatch.setattr(loop, "tick", boom)
    monkeypatch.setattr(loop, "_busy_ticks", 0)
    loop._run_once()
    loop._run_once()
    assert loop._busy_ticks == 2


def _fam(db, tz="UTC", **kw):
    fam = get_family(db)
    fam.timezone = tz
    for k, v in kw.items():
        setattr(fam, k, v)
    db.commit()
    return fam


def test_holiday_across_new_year_local_date(db, kid):
    _fam(db, "America/New_York")
    mk_device(db, status="assigned", owners=[kid])
    make_rule(
        db,
        category="holiday",
        times=(("08:00", "23:00"),),
        everyone=True,
        start_date=date(2026, 12, 20),
        end_date=date(2027, 1, 3),
    )
    make_rule(db, category="school_night", times=(("15:00", "20:00"),), everyone=True)
    sat = datetime(2027, 1, 2, 14, 0, tzinfo=UTC)  # 09:00 local Saturday
    mon = datetime(2027, 1, 4, 14, 0, tzinfo=UTC)  # 09:00 local Monday
    assert desired_blocked(db, sat) == []
    assert desired_blocked(db, mon) == ["aa:bb:cc:dd:ee:01"]


def test_rule_matches_old_window_behaviour(db, kid):
    from app.models.user import UserRole
    from tests.conftest import _make_user

    kid2 = _make_user(db, "other", UserRole.KID)
    _fam(db)
    mk_device(db, status="assigned", owners=[kid])
    make_rule(db, times=(("07:00", "21:00"),), kid_ids=[kid.id, kid2.id])
    at = lambda h, m: datetime(2026, 10, 20, h, m, tzinfo=UTC)  # noqa: E731
    assert desired_blocked(db, at(6, 59)) == ["aa:bb:cc:dd:ee:01"]
    assert desired_blocked(db, at(7, 0)) == []


def test_exempt_device_never_locked(db, parent, kid):
    from app.lock.rules import open_reason
    from app.lock.schedule import local_now
    from app.lock.state import device_facts

    fam = _fam(db, last_reset_date=DAY)
    d = mk_device(db, status="assigned", owners=[kid])
    d.exempt = True
    make_rule(db, times=(("00:00", "01:00"),), kid_ids=[kid.id])  # outside hours at 15:00
    _chore(db, parent, kid, approved=False)
    assert desired_blocked(db, NOW) == []
    facts = device_facts(db, d, fam, NOW)
    assert open_reason(facts, local_now("UTC", NOW)) == "exempt"
    db.add(Override(device_id=d.id, action="lock", source="manual"))
    db.commit()
    assert desired_blocked(db, NOW) == [d.mac]


def test_chore_lock_off_skips_chores(db, parent, kid):
    from app.models.lock import DeviceGroup

    fam = _fam(db, last_reset_date=DAY, chores_lock=False)
    d = mk_device(db, status="assigned", owners=[kid])
    make_rule(db, kid_ids=[kid.id])
    _chore(db, parent, kid, approved=False)
    assert desired_blocked(db, NOW) == []
    fam.chores_lock = True
    assert desired_blocked(db, NOW) == [d.mac]
    g = DeviceGroup(name="Tabs", chore_lock=False)
    d.groups = [g]
    db.commit()
    assert desired_blocked(db, NOW) == []
