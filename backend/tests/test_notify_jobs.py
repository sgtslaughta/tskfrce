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


def test_tick_runs_all_and_commits(db, pings):
    notify_jobs.tick(db, at(db, "12:00"), [])


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
