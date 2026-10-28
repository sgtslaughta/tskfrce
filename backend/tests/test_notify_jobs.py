from datetime import UTC, datetime, timedelta

import pytest
from app.models.family import get_family
from app.models.lock import Device
from app.models.notify import NotifyHeld
from app.services import chores as svc
from app.services import inbox, notify, notify_jobs

from tests.factories import make_run
from tests.test_notify_core import _place


@pytest.fixture(autouse=True)
def _reset(db):
    notify_jobs._last = None
    notify_jobs._started = datetime.min.replace(tzinfo=UTC)
    get_family(db).timezone = "UTC"
    db.commit()
    yield
    notify_jobs._last = None


def at(db, hhmm):
    h, m = map(int, hhmm.split(":"))
    d = svc.today(db)
    return datetime(d.year, d.month, d.day, h, m, tzinfo=UTC)


def test_flush_held_batches_per_place(db, pings, monkeypatch):
    p = _place(db, events=tuple(notify.EVENTS))
    db.add_all([NotifyHeld(place_id=p.id, title=f"T{i}", body="b") for i in range(2)])
    db.commit()
    monkeypatch.setattr(notify, "in_quiet", lambda *a: True)
    notify_jobs.flush_held(db, at(db, "08:00"))
    db.commit()
    assert pings == [] and db.query(NotifyHeld).count() == 2
    monkeypatch.setattr(notify, "in_quiet", lambda *a: False)
    notify_jobs.flush_held(db, at(db, "08:00"))
    db.commit()
    assert len(pings) == 1
    assert pings[0][1] == "While you were away: 2 updates"
    assert pings[0][2].startswith("• ")
    assert db.query(NotifyHeld).count() == 0


def test_flush_held_disabled_place_dropped(db, pings):
    p = _place(db, events=tuple(notify.EVENTS))
    db.add(NotifyHeld(place_id=p.id, title="T", body="b"))
    p.enabled = False
    db.commit()
    notify_jobs.flush_held(db, at(db, "08:00"))
    db.commit()
    assert pings == [] and db.query(NotifyHeld).count() == 0


def test_overdue_fires_once_in_window(db, pings, parent, kid):
    _place(db, events=tuple(notify.EVENTS))
    make_run(db, parent, kid, day=svc.today(db), due_time="17:00", title="Dishes")
    notify_jobs.overdue(db, at(db, "16:59"))
    db.commit()
    assert pings == []
    notify_jobs.overdue(db, at(db, "17:01"))
    db.commit()
    assert len(pings) == 1 and "hasn't finished" in pings[0][1]
    assert "5:00 PM" in pings[0][2]
    notify_jobs.overdue(db, at(db, "17:02"))
    db.commit()
    assert len(pings) == 1


def test_cancelled_run_not_overdue_or_in_summary(db, pings, parent, kid):
    _place(db, events=tuple(notify.EVENTS))
    gone = make_run(db, parent, kid, day=svc.today(db), due_time="17:00", status="cancelled")
    make_run(db, parent, kid, day=svc.today(db), title="Kept")
    assert gone.status == "cancelled"
    notify_jobs.overdue(db, at(db, "16:59"))
    notify_jobs.overdue(db, at(db, "17:01"))
    db.commit()
    assert pings == []
    notify_jobs.daily_summary(db, at(db, "19:00"))
    db.commit()
    assert "0 of 1 done" in pings[0][2]


def test_box_offline_once_and_resets(db, pings, parent):
    _place(db, events=tuple(notify.EVENTS))
    fam, now = get_family(db), at(db, "12:00")
    fam.blocker_last_seen = (now - timedelta(minutes=11)).replace(tzinfo=None)
    notify_jobs.box_offline(db, now)
    db.commit()
    assert len(pings) == 1 and len(inbox.parents(db)) == 1
    notify_jobs.box_offline(db, now)
    db.commit()
    assert len(pings) == 1
    fam.blocker_last_seen = now.replace(tzinfo=None)
    notify_jobs.box_offline(db, now)
    db.commit()
    assert fam.blocker_alerted is False and len(pings) == 1


def test_box_offline_never_before_first_heartbeat(db, pings, parent):
    _place(db, events=tuple(notify.EVENTS))
    notify_jobs.box_offline(db, at(db, "12:00"))
    db.commit()
    assert pings == [] and not get_family(db).blocker_alerted


def test_box_offline_grace_after_restart(db, pings, parent, monkeypatch):
    _place(db, events=tuple(notify.EVENTS))
    fam, now = get_family(db), at(db, "12:00")
    fam.blocker_last_seen = (now - timedelta(minutes=30)).replace(tzinfo=None)
    monkeypatch.setattr(notify_jobs, "_started", now - timedelta(minutes=5))
    notify_jobs.box_offline(db, now)
    assert pings == [] and not fam.blocker_alerted
    notify_jobs.box_offline(db, now + timedelta(minutes=6))
    db.commit()
    assert len(pings) == 1


def test_summary_skipped_when_too_late(db, pings, parent, kid):
    _place(db, events=tuple(notify.EVENTS))
    make_run(db, parent, kid, day=svc.today(db), title="Dishes")
    notify_jobs.daily_summary(db, at(db, "21:30"))
    db.commit()
    assert pings == [] and get_family(db).summary_date == svc.today(db)
    notify_jobs.daily_summary(db, at(db, "22:00"))
    assert pings == []


def test_summary_once_a_day_after_19(db, pings, parent, kid):
    _place(db, events=tuple(notify.EVENTS))
    make_run(db, parent, kid, day=svc.today(db), title="Dishes")
    notify_jobs.daily_summary(db, at(db, "18:59"))
    db.commit()
    assert pings == []
    notify_jobs.daily_summary(db, at(db, "19:00"))
    db.commit()
    assert len(pings) == 1 and "0 of 1 done" in pings[0][2]
    notify_jobs.daily_summary(db, at(db, "20:00"))
    db.commit()
    assert len(pings) == 1


def test_lock_changes_baseline_then_diff(db, pings, kid):
    _place(db, events=tuple(notify.EVENTS))
    a, b = "aa:bb:cc:dd:ee:01", "aa:bb:cc:dd:ee:02"
    d1 = Device(mac=a, name="Mia's iPad", status="assigned")
    d1.owners = [kid]
    db.add_all([d1, Device(mac=b, name="Guest", status="unassigned")])
    db.commit()
    notify_jobs.lock_changes(db, [])
    notify_jobs.lock_changes(db, [a, b])
    db.commit()
    assert [p[1] for p in pings] == ["Locked: Mia's iPad"]
    notify_jobs.lock_changes(db, [])
    db.commit()
    assert [p[1] for p in pings][-1] == "Unlocked: Mia's iPad" and len(pings) == 2


def test_overdue_skips_downtime_gap(db, pings, parent, kid):
    _place(db, events=tuple(notify.EVENTS))
    make_run(db, parent, kid, day=svc.today(db), due_time="12:00")
    get_family(db).notify_scan_at = at(db, "08:00").replace(tzinfo=None)
    db.commit()
    notify_jobs.overdue(db, at(db, "17:00"))
    db.commit()
    assert pings == []
    assert get_family(db).notify_scan_at == at(db, "17:00").replace(tzinfo=None)


def test_overdue_plural_verb(db, pings, parent, kid):
    from app.models.user import User, UserRole

    _place(db, events=tuple(notify.EVENTS))
    o = User(username="leo", email="l@x.l", hashed_password="x", full_name="Leo", role=UserRole.KID)
    db.add(o)
    db.commit()
    make_run(db, parent, kids=[kid, o], mode="team", day=svc.today(db), due_time="17:00")
    notify_jobs.overdue(db, at(db, "16:59"))
    notify_jobs.overdue(db, at(db, "17:01"))
    db.commit()
    assert " and " in pings[0][1] and "haven't finished" in pings[0][1]


def test_summary_and_overdue_dropped_in_quiet(db, pings, parent, kid, monkeypatch):
    _place(db, events=tuple(notify.EVENTS))
    make_run(db, parent, kid, day=svc.today(db), due_time="17:00")
    monkeypatch.setattr(notify, "in_quiet", lambda *a: True)
    notify_jobs.overdue(db, at(db, "16:59"))
    notify_jobs.overdue(db, at(db, "17:01"))
    notify_jobs.daily_summary(db, at(db, "19:00"))
    db.commit()
    assert pings == []


def test_tick_runs_all_and_commits(db, pings, parent):
    _place(db, events=tuple(notify.EVENTS))
    fam = get_family(db)
    now = at(db, "12:00")
    fam.blocker_last_seen = (now - timedelta(minutes=11)).replace(tzinfo=None)
    notify_jobs.tick(db, now, [])
    db.rollback()  # tick already committed: state survives
    assert fam.blocker_alerted is True
    assert fam.notify_scan_at == now.replace(tzinfo=None)
    assert len(pings) == 1


def test_loop_survives_notify_failure(db, monkeypatch):
    from app.lock import loop

    pushed = []
    monkeypatch.setattr(loop, "SessionLocal", lambda: db)
    monkeypatch.setattr(loop, "tick", lambda d, n: ["aa"])
    monkeypatch.setattr(loop, "push_blocked", pushed.append)
    monkeypatch.setattr(notify_jobs, "tick", lambda *a: 1 / 0)
    monkeypatch.setattr(db, "close", lambda: None)
    loop._run_once()
    assert pushed == [["aa"]]


def test_flush_held_caps_body(db, pings):
    p = _place(db, events=tuple(notify.EVENTS))
    db.add_all([NotifyHeld(place_id=p.id, title=f"T{i}", body="b") for i in range(25)])
    db.commit()
    notify_jobs.flush_held(db, at(db, "08:00"))
    db.commit()
    assert pings[0][1] == "While you were away: 25 updates"
    body = pings[0][2]
    assert body.count("• ") == 20 and "and 5 more" in body


def test_loop_db_locked_logs_warning(db, monkeypatch):
    from app.lock import loop
    from sqlalchemy.exc import OperationalError

    warns, errs = [], []
    monkeypatch.setattr(loop, "SessionLocal", lambda: db)
    monkeypatch.setattr(loop, "tick", lambda d, n: [])
    monkeypatch.setattr(loop, "push_blocked", lambda b: None)
    monkeypatch.setattr(loop.kid_alerts, "scan", lambda *a: None)
    monkeypatch.setattr(loop.logger, "warning", lambda *a, **k: warns.append(a))
    monkeypatch.setattr(loop.logger, "error", lambda *a, **k: errs.append(a))
    monkeypatch.setattr(db, "close", lambda: None)

    def boom(*a):
        raise OperationalError("x", {}, Exception("database is locked"))

    monkeypatch.setattr(notify_jobs, "tick", boom)
    loop._run_once()
    assert warns and not errs
