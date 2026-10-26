from app.models.family import get_family
from app.models.inbox import Notification
from app.services import economy, inbox, notify

from tests.test_inbox import _submit
from tests.test_notify_core import _place


def test_submit_pings_with_chore_link(client, db, parent, kid, pings):
    get_family(db).app_address = "http://box"
    _place(db)
    db.commit()
    r = _submit(db, parent, kid)
    assert len(pings) == 1 and pings[0][2].endswith(f"http://box/?chore={r.id}")


def test_kid_rows_do_not_ping(db, kid, pings):
    _place(db, events=tuple(notify.EVENTS))
    inbox.notify(db, [kid.id], "level_up", "You reached level 3!")
    db.commit()
    assert pings == []


def test_level_up_also_tells_parents(db, parent, kid, pings):
    _place(db, events=("badge",))
    economy.level_check(db, kid.id, before=-1)
    db.commit()
    rows = db.query(Notification).filter_by(user_id=parent.id, kind="level_up").all()
    assert rows and rows[0].title == (
        f"{kid.full_name} levelled up to {economy.level_of(db, kid.id)}"
    )
    assert len(pings) == 1


def test_device_bypass_is_security(db, parent, pings, monkeypatch):
    monkeypatch.setattr(notify, "in_quiet", lambda f, n: True)
    _place(db)
    inbox.notify_parents(db, "device_bypass", "Pad got around the lock", device_id=None)
    db.commit()
    assert len(pings) == 1


def test_path_for():
    assert inbox.path_for("new_device", device_id=4) == "/devices?item=4"
    assert inbox.path_for("chore_note", run_id=7) == "/?chore=7"
    assert inbox.path_for("redemption_request", redemption_id=2) == "/?tab=needs"
    assert inbox.path_for("box_offline") == "/devices"
    assert inbox.path_for("level_up") == "/"
