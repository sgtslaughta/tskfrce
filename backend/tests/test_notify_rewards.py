"""Auto-approved rewards and screen time ping parents (reward_request, quiet-hours held)."""

from app.models.notify import NotifyHeld
from app.models.reward import Reward
from app.services import notify

from tests.test_notify_core import _place
from tests.test_screen_time import _setup

REDEEM = "/api/v1/kid/redeem"


def test_auto_screen_time_pings_parents(client, db, kid, kid_headers, pings):
    _setup(db, kid, screen_auto_approve=True)
    _place(db)
    db.commit()
    r = client.post(REDEEM, json={"kind": "screen_time", "minutes": 15}, headers=kid_headers)
    assert r.status_code == 200, r.text
    assert [p[1] for p in pings] == [f"{kid.full_name} bought 15 min of screen time from Phone"]
    assert pings[0][2].startswith("Approved automatically · 20 points")


def test_auto_reward_pings_parents(client, db, kid, kid_headers, pings):
    _setup(db, kid)
    rw = Reward(name="Ice cream", price=50, needs_approval=False)
    db.add(rw)
    _place(db)
    db.commit()
    r = client.post(REDEEM, json={"kind": "reward", "reward_id": rw.id}, headers=kid_headers)
    assert r.status_code == 200, r.text
    assert [p[1] for p in pings] == [f"{kid.full_name} got Ice cream"]


def test_auto_ping_off_when_reward_event_unticked(client, db, kid, kid_headers, pings):
    _setup(db, kid, screen_auto_approve=True)
    _place(db, events=("chore_ok",))
    db.commit()
    client.post(REDEEM, json={"kind": "screen_time", "minutes": 15}, headers=kid_headers)
    assert pings == []


def test_auto_ping_held_in_quiet_hours(client, db, kid, kid_headers, pings, monkeypatch):
    monkeypatch.setattr(notify, "in_quiet", lambda f, n: True)
    _setup(db, kid, screen_auto_approve=True)
    _place(db)
    db.commit()
    client.post(REDEEM, json={"kind": "screen_time", "minutes": 15}, headers=kid_headers)
    assert pings == []
    held = db.query(NotifyHeld).all()
    assert [h.title for h in held] == [f"{kid.full_name} bought 15 min of screen time from Phone"]
