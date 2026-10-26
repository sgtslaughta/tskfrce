from app.models.chores import ChoreRun
from app.models.family import get_family
from app.models.inbox import Notification
from app.models.points import Points, PointsType
from app.models.user import UserRole
from app.services import chat, kid_events

from tests.conftest import _make_user
from tests.factories import DAY, api_chore, make_run

NEW_KINDS = {
    "chore_new",
    "chore_approved",
    "chore_sent_back",
    "points_taken",
    "chat_message",
}


def _rows(db, user, kind=None):
    q = db.query(Notification).filter_by(user_id=user.id)
    return q.filter_by(kind=kind).all() if kind else q.all()


def _waiting(db, parent, kid, **kw):
    return make_run(db, parent, kid, status="submitted", day=DAY, **kw)


def _give(db, kid, n):
    db.add(Points(user_id=kid.id, points_type=PointsType.BONUS, amount=n, reason="bonus"))
    db.commit()


def test_approve_alerts_kid(client, db, parent, kid, parent_headers):
    r = _waiting(db, parent, kid, title="Dishes", points=10)
    client.post(f"/api/v1/chores/{r.id}/approve", headers=parent_headers)
    (n,) = _rows(db, kid, "chore_approved")
    assert (n.title, n.body, n.run_id) == ("Dishes approved", "+10 points", r.id)


def test_send_back_alerts_kid_with_note(client, db, parent, kid, parent_headers):
    r = _waiting(db, parent, kid, title="Dishes")
    client.post(
        f"/api/v1/chores/{r.id}/send-back", json={"note": "Do the pans"}, headers=parent_headers
    )
    (n,) = _rows(db, kid, "chore_sent_back")
    assert (n.title, n.body, n.run_id) == ("Dishes was sent back", "Do the pans", r.id)
    kid_events.chore_decided(db, db.get(ChoreRun, r.id), False)
    assert _rows(db, kid, "chore_sent_back")[-1].body == "Take another look."


def test_deduct_alerts_kid(client, db, parent, kid, parent_headers):
    r = _waiting(db, parent, kid)
    _give(db, kid, 30)
    client.post(
        f"/api/v1/chores/{r.id}/deduct",
        json={"kid_id": kid.id, "amount": 10, "note": "Mess"},
        headers=parent_headers,
    )
    client.post(
        f"/api/v1/kids/{kid.id}/deduct", json={"amount": 5, "note": "Rude"}, headers=parent_headers
    )
    got = _rows(db, kid, "points_taken")
    assert [(n.title, n.body) for n in got] == [
        ("Mom took 10 points", "Mess"),
        ("Mom took 5 points", "Rude"),
    ]
    _give(db, kid, -15)  # balance now 0
    client.post(
        f"/api/v1/kids/{kid.id}/deduct", json={"amount": 5, "note": "x"}, headers=parent_headers
    )
    assert len(_rows(db, kid, "points_taken")) == 2


def test_new_assignment_alerts_each_kid(client, db, parent, kid, parent_headers):
    get_family(db).last_reset_date = DAY
    db.commit()
    k2 = _make_user(db, "zed", UserRole.KID)
    api_chore(client, parent_headers, [kid, k2], title="Trash", due_time="16:05")
    for k in (kid, k2):
        (n,) = _rows(db, k, "chore_new")
        assert (n.title, n.body) == ("New chore: Trash", "Due 4:05 PM")
    api_chore(client, parent_headers, [kid], title="Bins")
    assert _rows(db, kid, "chore_new")[-1].body is None


def test_parent_reply_alerts_kid_not_family(db, parent, kid):
    r = _waiting(db, parent, kid, title="Dishes")
    t = chat.thread_for(db, "chore", run_id=r.id)
    chat.post(db, t, parent, "Nice " * 40)
    (n,) = _rows(db, kid, "chat_message")
    assert (n.title, n.thread_id, n.run_id, len(n.body)) == (
        "Mom replied on Dishes",
        t.id,
        r.id,
        120,
    )
    chat.post(db, t, kid, "thanks")
    chat.post(db, chat.thread_for(db, "family"), parent, "hi all")
    assert len(_rows(db, kid, "chat_message")) == 1
    p = chat.thread_for(db, "private", kid_id=kid.id)
    chat.post(db, p, parent, None, photo_id=None)
    n = _rows(db, kid, "chat_message")[-1]
    assert (n.title, n.body, n.run_id, n.thread_id) == (
        "Mom sent you a message",
        "Sent a photo",
        None,
        p.id,
    )


def test_parent_never_gets_kid_kinds(client, db, parent, kid, parent_headers):
    r = _waiting(db, parent, kid)
    client.post(f"/api/v1/chores/{r.id}/approve", headers=parent_headers)
    r2 = _waiting(db, parent, kid)
    client.post(f"/api/v1/chores/{r2.id}/send-back", json={"note": "n"}, headers=parent_headers)
    _give(db, kid, 10)
    client.post(
        f"/api/v1/kids/{kid.id}/deduct", json={"amount": 5, "note": "x"}, headers=parent_headers
    )
    chat.post(db, chat.thread_for(db, "private", kid_id=kid.id), parent, "yo")
    db.commit()
    assert not {n.kind for n in _rows(db, parent)} & NEW_KINDS
    assert _rows(db, kid)
