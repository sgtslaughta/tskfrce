from datetime import UTC, datetime

from app.core.crypto import seal
from app.models.family import get_family
from app.models.notify import NotifyHeld, NotifyPlace
from app.services import notify


def _place(db, events=notify.DEFAULT_EVENTS, url="json://localhost/x"):
    p = NotifyPlace(name="P", url_enc=seal(url), url_mask="json://…", events=",".join(events))
    db.add(p)
    db.flush()
    return p


def test_ping_sends_after_commit_only(db, pings):
    _place(db)
    notify.ping(db, "chore_ok", "Mia finished Homework", "Take a look.", "/?chore=7")
    assert pings == []
    db.commit()
    assert pings == [(["json://localhost/x"], "Mia finished Homework", "Take a look.")]


def test_link_uses_app_address(db, pings):
    fam = get_family(db)
    fam.app_address = "http://chores.local"
    _place(db)
    notify.ping(db, "chore_ok", "T", "B", "/?chore=7")
    db.commit()
    assert pings[0][2] == "B\n\nhttp://chores.local/?chore=7"


def test_rollback_sends_nothing(db, pings):
    _place(db)
    notify.ping(db, "chore_ok", "T")
    db.rollback()
    db.commit()
    assert pings == []


def test_event_not_selected_or_disabled(db, pings):
    _place(db, events=("badge",))
    p = _place(db)
    p.enabled = False
    notify.ping(db, "chore_ok", "T")
    db.commit()
    assert pings == []


def test_quiet_hours_cross_midnight_family_tz(db):
    fam = get_family(db)
    fam.timezone = "America/New_York"
    fam.quiet_start, fam.quiet_end = "21:30", "07:00"
    assert notify.in_quiet(fam, datetime(2026, 1, 10, 3, 0, tzinfo=UTC))
    assert notify.in_quiet(fam, datetime(2026, 1, 10, 11, 59, tzinfo=UTC))
    assert not notify.in_quiet(fam, datetime(2026, 1, 10, 12, 0, tzinfo=UTC))
    fam.quiet_end = None
    assert not notify.in_quiet(fam, datetime(2026, 1, 10, 3, 0, tzinfo=UTC))


def test_quiet_holds_drops_and_lets_security_through(db, pings, monkeypatch):
    monkeypatch.setattr(notify, "in_quiet", lambda fam, now: True)
    p = _place(db, events=tuple(notify.EVENTS))
    for ev in ("chore_ok", "badge", "resisting"):
        notify.ping(db, ev, ev)
    db.commit()
    assert [t for _, t, _ in pings] == ["resisting"]
    assert [h.title for h in db.query(NotifyHeld).filter_by(place_id=p.id)] == ["chore_ok"]


def test_quiet_security_off_drops_security(db, pings, monkeypatch):
    monkeypatch.setattr(notify, "in_quiet", lambda fam, now: True)
    get_family(db).quiet_security = False
    _place(db)
    notify.ping(db, "resisting", "x")
    db.commit()
    assert pings == []


def test_unreadable_place_is_skipped(db, pings):
    bad = _place(db)
    bad.url_enc = "garbage"
    _place(db, url="json://ok/y")
    notify.ping(db, "chore_ok", "T")
    db.commit()
    assert [u for u, _, _ in pings] == [["json://ok/y"]]


def test_deliver_swallows_errors(monkeypatch):
    import apprise

    def boom(*a, **k):
        raise RuntimeError("boom")

    monkeypatch.setattr(apprise.Apprise, "notify", boom)
    assert notify.deliver(["json://localhost/x"], "t", "b") == (False, "boom")
