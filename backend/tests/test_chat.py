import io
from datetime import date, datetime, timedelta

from app.models.chat import ThreadMessage
from app.models.chore_extra import ChorePhoto
from app.models.chores import Chore, ChoreAssignment, ChoreRun
from app.models.family import get_family
from app.models.user import UserRole
from PIL import Image

from tests.conftest import _headers, _make_user
from tests.factories import api_chore

DAY = date(2026, 10, 20)
C = "/api/v1/chat"


def _world(db, client, ph):
    get_family(db).last_reset_date = DAY
    db.commit()
    leo = _make_user(db, "leo", UserRole.KID)
    maya = _make_user(db, "maya", UserRole.KID)

    def chore(title, kids, mode="each"):
        api_chore(client, ph, kids, mode, title=title, points=15)
        return (
            db.query(ChoreRun)
            .filter(ChoreRun.assignment.has(ChoreAssignment.chore.has(Chore.title == title)))
            .first()
            .id
        )

    return leo, maya, _headers(db, leo), _headers(db, maya), chore


def _jpeg():
    out = io.BytesIO()
    Image.new("RGB", (40, 30), "red").save(out, "JPEG")
    return out.getvalue()


def _tid(client, h, kind, ref):
    r = client.get(f"{C}/threads/{kind}/{ref}", headers=h)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _say(client, h, tid, body="hi"):
    return client.post(f"{C}/threads/{tid}/messages", json={"body": body}, headers=h)


def test_family_thread_is_singleton(client, db, parent_headers):
    leo, maya, lh, mh, _ = _world(db, client, parent_headers)
    a = _tid(client, lh, "family", "family")
    assert _tid(client, mh, "family", "family") == a
    assert _tid(client, parent_headers, "family", "family") == a


def test_private_threads_hide_from_siblings(client, db, parent_headers):
    leo, maya, lh, mh, _ = _world(db, client, parent_headers)
    assert client.get(f"{C}/threads/private/{leo.id}", headers=lh).status_code == 200
    assert client.get(f"{C}/threads/private/{maya.id}", headers=lh).status_code == 404
    assert client.get(f"{C}/threads/private/{maya.id}", headers=parent_headers).status_code == 200
    assert client.get(f"{C}/threads/private/9999", headers=parent_headers).status_code == 404
    assert client.get(f"{C}/threads/chore/1", headers=lh).status_code == 404


def test_chore_thread_access(client, db, parent_headers):
    leo, maya, lh, mh, chore = _world(db, client, parent_headers)
    mine = chore("Dishes", [maya])
    shared = chore("Trash", [leo, maya], "race")
    assert client.get(f"{C}/threads/chore/{mine}", headers=lh).status_code == 404
    assert client.get(f"{C}/threads/chore/{mine}", headers=mh).status_code == 200
    assert client.get(f"{C}/threads/chore/{mine}", headers=parent_headers).status_code == 200
    for h in (lh, mh):
        assert client.get(f"{C}/threads/chore/{shared}", headers=h).status_code == 200
    third = _make_user(db, "zed", UserRole.KID)
    assert client.get(f"{C}/threads/chore/{shared}", headers=_headers(db, third)).status_code == 404
    # a kid can't read a thread by id either
    tid = _tid(client, mh, "chore", mine)
    assert _say(client, lh, tid).status_code == 404


def test_post_and_page(client, db, parent_headers):
    leo, maya, lh, mh, _ = _world(db, client, parent_headers)
    tid = _tid(client, lh, "family", "family")
    for i in range(55):
        assert _say(client, lh, tid, f"m{i}").status_code == 200
    r = client.get(f"{C}/threads/family/family", headers=lh).json()
    assert len(r["messages"]) == 50 and r["has_more"] is True
    assert r["messages"][-1]["body"] == "m54" and r["messages"][-1]["author_name"] == "Leo"
    first = r["messages"][0]["id"]
    r2 = client.get(f"{C}/threads/family/family?before={first}", headers=lh).json()
    assert [m["body"] for m in r2["messages"]] == [f"m{i}" for i in range(5)]
    assert r2["has_more"] is False


def test_body_validation(client, db, parent_headers):
    leo, maya, lh, *_ = _world(db, client, parent_headers)
    tid = _tid(client, lh, "family", "family")
    assert _say(client, lh, tid, "   ").status_code == 422
    assert client.post(f"{C}/threads/{tid}/messages", json={}, headers=lh).status_code == 422
    assert _say(client, lh, tid, "x" * 2001).status_code == 422
    assert _say(client, lh, tid, "x" * 2000).status_code == 200
    assert _say(client, lh, tid, "  hi  ").json()["body"] == "hi"


def test_photo_in_private_thread(client, db, parent_headers):
    leo, maya, lh, mh, _ = _world(db, client, parent_headers)
    tid = _tid(client, lh, "private", leo.id)
    r = client.post(
        f"{C}/threads/{tid}/photos", files={"file": ("a.jpg", _jpeg(), "image/jpeg")}, headers=lh
    )
    assert r.status_code == 200, r.text
    pid = r.json()["photo_id"]
    m = client.post(f"{C}/threads/{tid}/messages", json={"photo_id": pid}, headers=lh).json()
    assert m["photo_url"] == f"/api/v1/chat/photos/{pid}" and m["body"] is None
    assert client.get(m["photo_url"], headers=lh).status_code == 200
    assert client.get(m["photo_url"] + "/thumb", headers=parent_headers).status_code == 200
    assert client.get(m["photo_url"], headers=mh).status_code == 404
    bad = client.post(f"{C}/threads/{tid}/messages", json={"photo_id": 999}, headers=lh)
    assert bad.status_code == 422


def test_chat_photo_in_chore_thread_is_never_proof(client, db, parent_headers):
    leo, maya, lh, mh, chore = _world(db, client, parent_headers)
    cid = chore("Dishes", [leo])
    assert client.post(f"/api/v1/kid/chores/{cid}/done", headers=lh).status_code == 200
    tid = _tid(client, lh, "chore", cid)
    # chore already with a parent: chat upload still works but adds no proof
    pid = client.post(
        f"{C}/threads/{tid}/photos", files={"file": ("a.jpg", _jpeg(), "image/jpeg")}, headers=lh
    ).json()["photo_id"]
    m = client.post(f"{C}/threads/{tid}/messages", json={"photo_id": pid}, headers=lh).json()
    assert m["photo_url"] == f"/api/v1/chat/photos/{pid}"
    assert client.get(m["photo_url"], headers=parent_headers).status_code == 200
    assert db.query(ChorePhoto).filter(ChorePhoto.run_id == cid).count() == 0


def test_proof_photo_shows_in_chore_thread(client, db, parent_headers):
    leo, maya, lh, mh, chore = _world(db, client, parent_headers)
    cid = chore("Dishes", [leo])
    proof = client.post(
        f"/api/v1/kid/chores/{cid}/photos",
        files={"file": ("a.jpg", _jpeg(), "image/jpeg")},
        headers=lh,
    ).json()["id"]
    msgs = client.get(f"{C}/threads/chore/{cid}", headers=lh).json()["messages"]
    assert msgs[-1]["photo_url"] == f"/api/v1/chore-photos/{proof}"
    # a chore photo id can't be smuggled into a user message
    tid = _tid(client, lh, "chore", cid)
    bad = client.post(f"{C}/threads/{tid}/messages", json={"photo_id": proof}, headers=lh)
    assert bad.status_code == 422


def test_chore_actions_write_system_messages(client, db, parent_headers):
    leo, maya, lh, mh, chore = _world(db, client, parent_headers)
    cid = chore("Dishes", [leo])
    client.post(
        f"/api/v1/kid/chores/{cid}/photos",
        files={"file": ("a.jpg", _jpeg(), "image/jpeg")},
        headers=lh,
    )
    assert client.post(f"/api/v1/kid/chores/{cid}/done", headers=lh).status_code == 200
    r = client.post(
        f"/api/v1/chores/{cid}/send-back", json={"note": "Wipe the sink"}, headers=parent_headers
    )
    assert r.status_code == 200
    client.post(f"/api/v1/kid/chores/{cid}/done", headers=lh)
    assert client.post(f"/api/v1/chores/{cid}/approve", headers=parent_headers).status_code == 200
    msgs = client.get(f"{C}/threads/chore/{cid}", headers=lh).json()["messages"]
    assert [(m["kind"], m["author_id"], m["body"]) for m in msgs] == [
        ("system", None, "Photo added"),
        ("system", None, "Sent back: Wipe the sink"),
        ("system", None, "Approved · +15"),
    ]


def test_unread_excludes_own_includes_system_and_read_clears(client, db, parent_headers):
    leo, maya, lh, mh, chore = _world(db, client, parent_headers)
    cid = chore("Dishes", [leo])
    tid = _tid(client, lh, "chore", cid)
    _say(client, lh, tid, "mine")
    from app.services import chat

    chat.system(db, db.get(ChoreRun, cid), "Photo added")
    db.commit()

    def row(h, tid):
        j = client.get(f"{C}/threads", headers=h).json()
        return j, next((t for t in j["threads"] if t["id"] == tid), None)

    j, t = row(lh, tid)
    assert t["unread"] == 1 and t["title"] == "Dishes"  # system only, not own
    j, t = row(parent_headers, tid)
    assert t["unread"] == 2 and j["total"] >= 2
    assert client.post(f"{C}/threads/{tid}/read", headers=parent_headers).status_code == 200
    assert row(parent_headers, tid)[1]["unread"] == 0
    _say(client, lh, tid, "again")
    assert row(parent_headers, tid)[1]["unread"] == 1
    assert row(lh, tid)[1]["unread"] == 1


def test_thread_list_scope(client, db, parent_headers):
    leo, maya, lh, mh, chore = _world(db, client, parent_headers)
    other = chore("Mow", [maya])
    tid = _tid(client, parent_headers, "chore", other)
    _say(client, parent_headers, tid)
    quiet = chore("Quiet", [leo])
    kinds = lambda h: {  # noqa: E731
        (t["kind"], t["kid_id"] or t["task_id"])
        for t in client.get(f"{C}/threads", headers=h).json()["threads"]
    }
    assert kinds(lh) == {("family", None), ("private", leo.id)}
    assert kinds(mh) == {("family", None), ("private", maya.id), ("chore", other)}
    ph = kinds(parent_headers)
    assert ("private", leo.id) in ph and ("private", maya.id) in ph and ("chore", other) in ph
    assert ("chore", quiet) not in ph


def test_delete_rules(client, db, parent_headers):
    leo, maya, lh, mh, _ = _world(db, client, parent_headers)
    tid = _tid(client, lh, "family", "family")
    mine = _say(client, lh, tid).json()["id"]
    theirs = _say(client, mh, tid).json()["id"]
    assert client.delete(f"{C}/messages/{theirs}", headers=lh).status_code == 403
    assert client.delete(f"{C}/messages/{mine}", headers=lh).status_code == 204
    old = _say(client, lh, tid).json()["id"]
    db.get(ThreadMessage, old).created_at = datetime.utcnow() - timedelta(minutes=6)
    db.commit()
    assert client.delete(f"{C}/messages/{old}", headers=lh).status_code == 403
    assert client.delete(f"{C}/messages/{old}", headers=parent_headers).status_code == 204
    assert client.delete(f"{C}/messages/{old}", headers=parent_headers).status_code == 404


def test_delete_kid_with_chat(client, db, parent_headers):
    leo, maya, lh, mh, _ = _world(db, client, parent_headers)
    _say(client, lh, _tid(client, lh, "family", "family"))
    _say(client, lh, _tid(client, lh, "private", leo.id))
    assert client.delete(f"/api/v1/kids/{leo.id}", headers=parent_headers).status_code == 200
    msgs = client.get(f"{C}/threads/family/family", headers=mh).json()["messages"]
    assert msgs[0]["author_id"] is None
