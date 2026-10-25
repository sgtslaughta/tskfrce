from datetime import date

from app.models.chat import ThreadMessage
from app.models.chore_type import ChoreType
from app.models.chores import ChoreRun
from app.models.family import get_family
from app.models.inbox import Notification
from app.models.user import UserRole

from tests.conftest import _headers, _make_user

DAY = date(2026, 10, 20)


def _setup(db, client, ph, type_name="Cleaning"):
    get_family(db).last_reset_date = DAY
    db.commit()
    kid = _make_user(db, "leo", UserRole.KID)
    tid = db.query(ChoreType).filter(ChoreType.name == type_name).one().id
    r = client.post(
        "/api/v1/chores/", json={"title": "Tidy", "points": 5, "type_id": tid}, headers=ph
    )
    client.post(
        f"/api/v1/chores/{r.json()['id']}/assignments",
        json={"kid_ids": [kid.id], "mode": "each", "repeat": {"type": "daily"}},
        headers=ph,
    )
    run = db.query(ChoreRun).one()
    return kid, _headers(db, kid), run.id


def _note(client, kh, rid, label="Out of supplies", text=None):
    return client.post(
        f"/api/v1/kid/chores/{rid}/note", json={"label": label, "text": text}, headers=kh
    )


def test_note_flags_and_notifies(client, db, parent_headers):
    kid, kh, rid = _setup(db, client, parent_headers)
    assert _note(client, kh, rid, text="no spray").json() == {"ok": True}
    chores = client.get("/api/v1/today", headers=parent_headers).json()["kids"][0]["chores"]
    n = chores[0]["note"]
    assert (n["label"], n["text"], n["kid_name"]) == ("Out of supplies", "no spray", kid.full_name)
    seen = client.get("/api/v1/kid/today", headers=kh).json()["chores"][0]["note"]
    assert (seen["label"], seen["text"]) == ("Out of supplies", "no spray")
    assert db.query(Notification).filter(Notification.kind == "chore_note").count() >= 1
    assert (
        db.query(ThreadMessage).filter(ThreadMessage.note_label == "Out of supplies").count() == 1
    )
    assert client.get(f"/api/v1/chores/{rid}", headers=parent_headers).json()["note"]["label"]


def test_parent_reply_clears_note(client, db, parent_headers):
    kid, kh, rid = _setup(db, client, parent_headers)
    _note(client, kh, rid)
    tid = client.get(f"/api/v1/chat/threads/chore/{rid}", headers=parent_headers).json()["id"]
    client.post(f"/api/v1/chat/threads/{tid}/messages", json={"body": "ok"}, headers=parent_headers)
    assert client.get(f"/api/v1/chores/{rid}", headers=parent_headers).json()["note"] is None


def test_note_rules(client, db, parent_headers):
    kid, kh, rid = _setup(db, client, parent_headers)
    assert _note(client, kh, rid, "Hack").status_code == 422
    assert _note(client, kh, rid, "Need help").status_code == 200
    db.get(ChoreRun, rid).status = "submitted"
    db.commit()
    assert _note(client, kh, rid, "Need help").status_code == 409


def test_parent_view_as_cannot_note(client, db, parent_headers):
    kid, kh, rid = _setup(db, client, parent_headers)
    h = {**parent_headers, "X-View-As": str(kid.id)}
    assert _note(client, h, rid).status_code == 403
