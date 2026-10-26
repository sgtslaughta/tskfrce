from datetime import UTC, datetime, timedelta

from app.models.family import get_family
from app.models.inbox import Notification
from app.models.lock import Device, TimeWindow
from app.services import inbox, kid_alerts

from tests.factories import make_run


def at(h, m=0):
    """Local New York time on DAY as UTC (EDT = UTC-4)."""
    return datetime(2026, 10, 20, tzinfo=UTC) + timedelta(hours=h + 4, minutes=m)


def _fam(db):
    fam = get_family(db)
    fam.timezone = "America/New_York"
    fam.reset_time = "03:00"
    db.commit()


def _rows(db, kid, kind=None):
    q = db.query(Notification).filter_by(user_id=kid.id)
    return q.filter_by(kind=kind).all() if kind else q.all()


def test_due_soon_once(db, parent, kid):
    _fam(db)
    make_run(db, parent, kid, title="Dishes", due_time="17:00")
    assert kid_alerts.scan(db, at(16, 40)) == 1
    (n,) = _rows(db, kid, "due_soon")
    assert n.title == "Dishes is due in 20 min"
    assert kid_alerts.scan(db, at(16, 41)) == 0
    assert len(_rows(db, kid)) == 1


def test_missed_only_when_box_was_off(db, parent, kid):
    _fam(db)
    make_run(db, parent, kid, title="Dishes", due_time="16:30")
    kid_alerts.scan(db, at(17, 5))
    (n,) = _rows(db, kid)
    assert (n.kind, n.title) == ("missed_deadline", "Dishes is late")
    assert n.body == "It was due at 4:30 PM. Finish it as soon as you can."


def test_step_deadlines(db, parent, kid):
    _fam(db)
    r = make_run(db, parent, kid, title="Room", due_time="18:00", steps=("Bed", "Floor"))
    steps = r.assignment.chore.steps
    steps[0].due_time = "16:30"
    db.commit()
    kid_alerts.scan(db, at(16, 10))
    (n,) = _rows(db, kid)
    assert (n.kind, n.title, n.body) == ("due_soon", "Bed is due in 20 min", "Part of Room")


def test_no_alert_for_submitted_or_skipped(db, parent, kid):
    _fam(db)
    make_run(db, parent, kid, status="submitted", due_time="16:30")
    make_run(db, parent, kid, status="skipped", due_time="16:30")
    assert kid_alerts.scan(db, at(17, 0)) == 0


def _device(db, kid, end, kind="allowed"):
    d = Device(mac="aa:bb:cc:dd:ee:01", name="Tab", status="assigned")
    d.owners = [kid]
    db.add(d)
    db.add(TimeWindow(kind=kind, days="0123456", start="00:00", end=end, kid_id=kid.id))
    db.commit()


def test_lock_warning(db, parent, kid):
    _fam(db)
    _device(db, kid, "21:00")
    make_run(db, parent, kid, status="done", approved=True)
    kid_alerts.scan(db, at(20, 40))
    assert _rows(db, kid) == []
    kid_alerts.scan(db, at(20, 52))
    (n,) = _rows(db, kid, "lock_warning")
    assert (n.title, n.body) == ("Internet goes off in 8 min", "Time to wrap up.")


def test_lock_warning_counts_chores_left(db, parent, kid):
    _fam(db)
    _device(db, kid, "18:00", kind="free")
    db.add(TimeWindow(kind="allowed", days="0123456", start="00:00", end="23:59", kid_id=kid.id))
    make_run(db, parent, kid, title="A")
    make_run(db, parent, kid, title="B")
    kid_alerts.scan(db, at(17, 55))
    (n,) = _rows(db, kid, "lock_warning")
    assert n.body == "Finish 2 more chores to keep it on."


def test_scan_survives_duplicate_race(db, parent, kid, monkeypatch):
    _fam(db)
    make_run(db, parent, kid, title="Dishes", due_time="17:00")
    kid_alerts.scan(db, at(16, 40))

    def racy(db_, ids, kind, title, body=None, **kw):  # dedup pre-check lost the race
        db_.add(Notification(user_id=ids[0], kind=kind, title=title, dedup_key=kw["dedup_key"]))
        db_.flush()
        return 1

    monkeypatch.setattr(inbox, "notify", racy)
    assert kid_alerts.scan(db, at(16, 50)) == 0
    assert len(_rows(db, kid)) == 1
