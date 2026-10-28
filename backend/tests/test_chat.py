import io
from datetime import date, datetime, timedelta

from app.models.chat import MessageReaction, ThreadMessage
from app.models.chore_extra import ChorePhoto
from app.models.chores import Chore, ChoreAssignment, ChoreRun, ChoreStep
from app.models.family import get_family
from app.models.user import User, UserRole
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


def test_kid_cannot_delete_own_system_message(client, db, parent_headers):
    leo, maya, lh, mh, _ = _world(db, client, parent_headers)
    tid = _tid(client, lh, "family", "family")
    sysm = ThreadMessage(thread_id=tid, author_id=leo.id, kind="system", body="photo submitted")
    db.add(sysm)
    db.commit()
    assert client.delete(f"{C}/messages/{sysm.id}", headers=lh).status_code == 403
    db.expire_all()
    assert db.get(ThreadMessage, sysm.id) is not None


def test_delete_kid_with_chat(client, db, parent_headers):
    leo, maya, lh, mh, _ = _world(db, client, parent_headers)
    _say(client, lh, _tid(client, lh, "family", "family"))
    _say(client, lh, _tid(client, lh, "private", leo.id))
    assert client.delete(f"/api/v1/kids/{leo.id}", headers=parent_headers).status_code == 200
    msgs = client.get(f"{C}/threads/family/family", headers=mh).json()["messages"]
    assert msgs[0]["author_id"] is None


def test_thread_list_previews_latest_message(client, db, parent_headers):
    leo, _, lh, _, _ = _world(db, client, parent_headers)
    tid = _tid(client, lh, "private", leo.id)
    _say(client, lh, tid, "first")
    _say(client, lh, tid, "can I have more time?")
    rows = client.get(f"{C}/threads", headers=parent_headers).json()["threads"]
    row = next(r for r in rows if r["kind"] == "private" and r["kid_id"] == leo.id)
    assert row["last_text"] == "can I have more time?"
    assert row["last_author"]
    assert row["last_message_at"]
    quiet = next(r for r in rows if r["kind"] == "family")
    assert quiet["last_text"] is None and quiet["last_author"] is None


def test_edit_rules(client, db, parent_headers):
    leo, maya, lh, mh, _ = _world(db, client, parent_headers)
    tid = _tid(client, lh, "family", "family")
    mine = _say(client, lh, tid).json()["id"]
    r = client.patch(f"{C}/messages/{mine}", json={"body": " fixed "}, headers=lh)
    assert r.status_code == 200 and r.json()["body"] == "fixed" and r.json()["edited_at"]
    assert client.patch(f"{C}/messages/{mine}", json={"body": " "}, headers=lh).status_code == 422
    assert client.patch(f"{C}/messages/{mine}", json={"body": "x"}, headers=mh).status_code == 403
    assert (
        client.patch(f"{C}/messages/{mine}", json={"body": "x"}, headers=parent_headers).status_code
        == 403
    )
    db.get(ThreadMessage, mine).created_at = datetime.utcnow() - timedelta(minutes=6)
    db.commit()
    assert client.patch(f"{C}/messages/{mine}", json={"body": "x"}, headers=lh).status_code == 403
    sysm = ThreadMessage(thread_id=tid, author_id=None, kind="system", body="done")
    db.add(sysm)
    db.commit()
    assert (
        client.patch(
            f"{C}/messages/{sysm.id}", json={"body": "x"}, headers=parent_headers
        ).status_code
        == 403
    )


def test_parent_edits_own_any_time(client, db, parent_headers):
    leo, maya, lh, mh, _ = _world(db, client, parent_headers)
    tid = _tid(client, parent_headers, "family", "family")
    mid = _say(client, parent_headers, tid).json()["id"]
    db.get(ThreadMessage, mid).created_at = datetime.utcnow() - timedelta(days=2)
    db.commit()
    r = client.patch(f"{C}/messages/{mid}", json={"body": "later"}, headers=parent_headers)
    assert r.status_code == 200
    got = client.get(f"{C}/threads/family/family", headers=lh).json()["messages"][-1]
    assert got["body"] == "later" and got["edited_at"].endswith("Z")


def test_step_reply(client, db, parent_headers):
    leo, maya, lh, mh, _ = _world(db, client, parent_headers)
    api_chore(client, parent_headers, [leo], title="Dishes", steps=["rinse", "stack"])
    run = (
        db.query(ChoreRun)
        .filter(ChoreRun.assignment.has(ChoreAssignment.chore.has(Chore.title == "Dishes")))
        .one()
    )
    api_chore(client, parent_headers, [maya], title="Sweep", steps=["broom"])
    step = db.query(ChoreStep).filter(ChoreStep.chore_id == run.assignment.chore_id).first()
    tid = _tid(client, parent_headers, "chore", run.id)
    r = client.post(
        f"{C}/threads/{tid}/messages",
        json={"body": "this one", "step_id": step.id},
        headers=parent_headers,
    )
    assert r.status_code == 200
    assert (r.json()["step_id"], r.json()["step_title"]) == (step.id, step.title)
    foreign = db.query(ChoreStep).filter(ChoreStep.chore_id != run.assignment.chore_id).first()
    for bad in (99999, foreign.id):
        r = client.post(
            f"{C}/threads/{tid}/messages",
            json={"body": "x", "step_id": bad},
            headers=parent_headers,
        )
        assert r.status_code == 422 and r.json()["detail"] == "We couldn't find that step."
    fid = _tid(client, parent_headers, "family", "family")
    r = client.post(
        f"{C}/threads/{fid}/messages",
        json={"body": "x", "step_id": step.id},
        headers=parent_headers,
    )
    assert r.status_code == 422


def test_proof_photo_reply(client, db, parent_headers):
    leo, maya, lh, mh, chore = _world(db, client, parent_headers)
    run, other = chore("Homework", [leo]), chore("Sweep", [maya])
    mine = [
        ChorePhoto(run_id=run, uploaded_by_id=leo.id, path="a", thumb_path="a") for _ in range(2)
    ]
    foreign = ChorePhoto(run_id=other, uploaded_by_id=maya.id, path="b", thumb_path="b")
    db.add_all([*mine, foreign])
    db.commit()
    tid = _tid(client, parent_headers, "chore", run)
    post = lambda **kw: client.post(  # noqa: E731
        f"{C}/threads/{tid}/messages", json={"body": "nice", **kw}, headers=parent_headers
    )
    r = post(proof_photo_id=mine[1].id)
    assert r.status_code == 200 and r.json()["proof_photo_n"] == 2
    got = client.get(f"{C}/threads/chore/{run}", headers=parent_headers).json()["messages"]
    assert got[-1]["proof_photo_n"] == 2
    assert post(proof_photo_id=foreign.id).status_code == 422
    fid = _tid(client, parent_headers, "family", "family")
    r = client.post(
        f"{C}/threads/{fid}/messages",
        json={"body": "x", "proof_photo_id": mine[0].id},
        headers=parent_headers,
    )
    assert r.status_code == 422


def _react(client, h, mid, emoji="👍"):
    return client.post(f"{C}/messages/{mid}/reactions", json={"emoji": emoji}, headers=h)


def test_reaction_toggles_and_aggregates(client, db, parent_headers):
    leo, maya, lh, mh, _ = _world(db, client, parent_headers)
    tid = _tid(client, lh, "family", "family")
    mid = _say(client, lh, tid).json()["id"]
    r = _react(client, lh, mid)  # kids may react, own messages included
    assert r.status_code == 200, r.text
    assert r.json()["reactions"] == [{"emoji": "👍", "count": 1, "mine": True, "names": ["Leo"]}]
    _react(client, mh, mid)
    _react(client, mh, mid, "❤️")
    msgs = client.get(f"{C}/threads/family/family", headers=parent_headers).json()["messages"]
    assert msgs[-1]["reactions"] == [
        {"emoji": "👍", "count": 2, "mine": False, "names": ["Leo", "Maya"]},
        {"emoji": "❤️", "count": 1, "mine": False, "names": ["Maya"]},
    ]
    r = _react(client, lh, mid)  # same emoji again removes it
    assert r.json()["reactions"][0] == {"emoji": "👍", "count": 1, "mine": False, "names": ["Maya"]}
    assert db.query(MessageReaction).count() == 2


def test_reaction_rules(client, db, parent_headers):
    leo, maya, lh, mh, chore = _world(db, client, parent_headers)
    mid = _say(client, lh, _tid(client, lh, "private", leo.id)).json()["id"]
    assert _react(client, mh, mid).status_code == 404  # sibling can't see the thread
    for bad in ["", "ok", "👍 ", "1", "👍" * 17, "é", "日", "\u200b👍", "\u202e👍", "\u200d", "!!"]:
        assert _react(client, lh, mid, bad).status_code == 422, bad
    sysm = ThreadMessage(thread_id=_tid(client, lh, "family", "family"), kind="system", body="x")
    db.add(sysm)
    db.commit()
    r = _react(client, lh, sysm.id)
    assert r.status_code == 422 and r.json()["detail"] == "You can't react to that."


def test_reactions_cascade_with_message(client, db, parent_headers):
    leo, maya, lh, mh, _ = _world(db, client, parent_headers)
    tid = _tid(client, lh, "family", "family")
    mid = _say(client, lh, tid).json()["id"]
    _react(client, mh, mid)
    _react(client, parent_headers, mid, "😂")
    assert client.delete(f"{C}/messages/{mid}", headers=parent_headers).status_code == 204
    db.expire_all()
    assert db.query(MessageReaction).count() == 0


def test_reactions_load_in_one_query(client, db, parent_headers):
    from sqlalchemy import event

    leo, maya, lh, mh, _ = _world(db, client, parent_headers)
    tid = _tid(client, lh, "family", "family")

    def count():
        seen = []
        hook = lambda *a: seen.append(a[2])  # noqa: E731
        event.listen(db.get_bind(), "before_cursor_execute", hook)
        client.get(f"{C}/threads/family/family", headers=parent_headers)
        event.remove(db.get_bind(), "before_cursor_execute", hook)
        return sum("message_reactions" in s for s in seen)

    for _ in range(4):
        mid = _say(client, lh, tid).json()["id"]
        _react(client, mh, mid)
    assert count() == 1


def test_reaction_cap_and_chore_access(client, db, parent_headers):
    leo, maya, lh, mh, chore = _world(db, client, parent_headers)
    cid = chore("Dishes", [leo])
    mid = _say(client, lh, _tid(client, lh, "chore", cid)).json()["id"]
    assert _react(client, mh, mid).status_code == 404  # maya isn't on leo's chore
    ten = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🎉", "🔥", "⭐", "🍕"]
    for e in ten:
        assert _react(client, lh, mid, e).status_code == 200
    r = _react(client, lh, mid, "🧑‍🍳")
    assert r.status_code == 422 and r.json()["detail"] == "That's enough reactions."
    assert _react(client, lh, mid, "👍").status_code == 200  # removing still works at the cap
    assert _react(client, parent_headers, mid, "🧑‍🍳").status_code == 200  # cap is per user


def test_kids_own_system_line_is_not_unread_for_them(client, db, parent_headers):
    leo, maya, lh, mh, chore = _world(db, client, parent_headers)
    cid = chore("Dishes", [leo])
    client.post(
        f"/api/v1/kid/chores/{cid}/photos",
        files={"file": ("a.jpg", _jpeg(), "image/jpeg")},
        headers=lh,
    )
    assert client.get(f"{C}/threads", headers=lh).json()["total"] == 0
    assert client.get(f"{C}/threads", headers=parent_headers).json()["total"] == 1
    msgs = client.get(f"{C}/threads/chore/{cid}", headers=lh).json()["messages"]
    assert msgs[0]["author_id"] is None


def test_new_kid_starts_with_existing_chat_read(client, db, parent_headers):
    leo, _, _, _, _ = _world(db, client, parent_headers)
    fam = _tid(client, parent_headers, "family", "family")
    _say(client, parent_headers, fam, "old news")
    r = client.post("/api/v1/kids", json={"full_name": "Newbie"}, headers=parent_headers)
    assert r.status_code == 200, r.text
    new = db.get(User, r.json()["id"])
    j = client.get(f"{C}/threads", headers=_headers(db, new)).json()
    assert j["total"] == 0
    _say(client, parent_headers, fam, "fresh")
    assert client.get(f"{C}/threads", headers=_headers(db, new)).json()["total"] == 1
