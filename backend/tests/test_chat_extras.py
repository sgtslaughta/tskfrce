from datetime import date

from app.models.chore_type import ChoreType
from app.models.chores import ChoreRun
from app.models.family import get_family
from app.models.inbox import Notification
from app.models.user import UserRole
from app.services import typing as typ

from tests.conftest import _headers, _make_user

DAY = date(2026, 10, 20)
C = "/api/v1/chat"


def _pings(db, user):
    return db.query(Notification).filter(
        Notification.user_id == user.id, Notification.kind == "chat_message"
    )


def _fam(client, h):
    return client.get(f"{C}/threads/family/family", headers=h).json()


def _chore(client, db, ph, kid, type_name="Cleaning"):
    get_family(db).last_reset_date = DAY
    db.commit()
    tid = db.query(ChoreType).filter(ChoreType.name == type_name).one().id
    r = client.post(
        "/api/v1/chores/", json={"title": "Tidy", "points": 5, "type_id": tid}, headers=ph
    )
    client.post(
        f"/api/v1/chores/{r.json()['id']}/assignments",
        json={"kid_ids": [kid.id], "mode": "each", "repeat": {"type": "daily"}},
        headers=ph,
    )
    return db.query(ChoreRun).one().id


def test_typing_expires():
    typ._seen.clear()
    typ.ping(1, 10, "Leo", now=0)
    assert typ.who(1, 11, now=5) == ["Leo"]
    assert typ.who(1, 10, now=5) == []
    assert typ.who(1, 11, now=7) == []
    assert typ._seen == {}


def test_typing_endpoint(client, db, parent, kid, parent_headers, kid_headers):
    typ._seen.clear()
    tid = _fam(client, parent_headers)["id"]
    assert client.post(f"{C}/threads/{tid}/typing", headers=kid_headers).status_code == 204
    assert _fam(client, parent_headers)["typing"] == [kid.full_name]
    assert _fam(client, kid_headers)["typing"] == []


def test_typing_enforces_access(client, db, parent, kid, parent_headers):
    typ._seen.clear()
    sib = _make_user(db, "mia", UserRole.KID)
    pid = client.get(f"{C}/threads/private/{sib.id}", headers=parent_headers).json()["id"]
    assert client.post(f"{C}/threads/{pid}/typing", headers=_headers(db, kid)).status_code == 404
    assert typ.who(pid, 0) == []


def test_mentions_only_members(client, db, parent, parent_headers):
    leo = _make_user(db, "leo", UserRole.KID)
    mia = _make_user(db, "mia", UserRole.KID)
    lh = _headers(db, leo)
    fid = _fam(client, parent_headers)["id"]
    client.post(f"{C}/threads/{fid}/messages", json={"body": "@mia @Mom thanks"}, headers=lh)
    assert _pings(db, mia).count() == 1
    assert _pings(db, parent).count() == 1
    rid = _chore(client, db, parent_headers, leo)
    cid = client.get(f"{C}/threads/chore/{rid}", headers=parent_headers).json()["id"]
    before = _pings(db, mia).count()
    client.post(f"{C}/threads/{cid}/messages", json={"body": "@mia"}, headers=lh)
    assert _pings(db, mia).count() == before
    client.post(f"{C}/threads/{fid}/messages", json={"body": "@leo"}, headers=lh)
    assert _pings(db, leo).count() == 0


def test_kid_mentions_and_members(client, db, parent, parent_headers):
    typ._seen.clear()
    leo = _make_user(db, "leo", UserRole.KID)
    mia = _make_user(db, "mia", UserRole.KID)
    lh, mh = _headers(db, leo), _headers(db, mia)
    d = _fam(client, lh)
    client.post(f"{C}/threads/{d['id']}/messages", json={"body": "@mia hi"}, headers=lh)
    assert _pings(db, mia).count() == 1
    assert {m["name"] for m in d["members"]} == {"Mom", "Leo", "Mia"}
    client.post(f"{C}/threads/{d['id']}/typing", headers=lh)
    assert _fam(client, mh)["typing"] == ["Leo"]
    assert _fam(client, lh)["typing"] == []


def test_thread_list_note_and_glyph(client, db, parent, parent_headers):
    leo = _make_user(db, "leo", UserRole.KID)
    rid = _chore(client, db, parent_headers, leo, "Pets")
    lh = _headers(db, leo)
    r = client.post(f"/api/v1/kid/chores/{rid}/note", json={"label": "Out of pet food"}, headers=lh)
    assert r.status_code == 200
    rows = client.get(f"{C}/threads", headers=parent_headers).json()["threads"]
    row = next(t for t in rows if t["kind"] == "chore")
    assert row["note"] is True and row["glyph"] == "pets"
    fam = next(t for t in rows if t["kind"] == "family")
    assert fam["note"] is False and fam["glyph"] is None


def test_search_messages(client, db, parent, parent_headers):
    leo = _make_user(db, "leo", UserRole.KID)
    mia = _make_user(db, "mia", UserRole.KID)
    fid = _fam(client, parent_headers)["id"]
    pid = client.get(f"{C}/threads/private/{mia.id}", headers=parent_headers).json()["id"]
    client.post(f"{C}/threads/{fid}/messages", json={"body": "hello"}, headers=parent_headers)
    client.post(
        f"{C}/threads/{pid}/messages", json={"body": "fraction help 100%"}, headers=parent_headers
    )
    r = client.get(f"{C}/search", params={"q": "fraction"}, headers=parent_headers)
    assert r.json() == {"thread_ids": [pid]}
    assert client.get(f"{C}/search", params={"q": "100%"}, headers=parent_headers).json() == {
        "thread_ids": [pid]
    }
    assert client.get(f"{C}/search", params={"q": "h_lp"}, headers=parent_headers).json() == {
        "thread_ids": []
    }
    assert client.get(
        f"{C}/search", params={"q": "fraction"}, headers=_headers(db, leo)
    ).json() == {"thread_ids": []}
    assert client.get(f"{C}/search", params={"q": "a"}, headers=parent_headers).status_code == 422


def test_parent_mention_not_double_pinged(client, db, parent, parent_headers):
    leo = _make_user(db, "leo", UserRole.KID)
    rid = _chore(client, db, parent_headers, leo)
    cid = client.get(f"{C}/threads/chore/{rid}", headers=parent_headers).json()["id"]
    client.post(f"{C}/threads/{cid}/messages", json={"body": "@leo nice"}, headers=parent_headers)
    assert _pings(db, leo).count() == 1
    fid = _fam(client, parent_headers)["id"]  # family thread has no parent_reply ping
    client.post(f"{C}/threads/{fid}/messages", json={"body": "@leo hi"}, headers=parent_headers)
    assert _pings(db, leo).count() == 2
