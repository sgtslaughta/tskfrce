from datetime import UTC, datetime, timedelta

from app.lock.rules import is_online
from app.lock.schedule import local_now
from app.lock.state import device_facts
from app.models.family import get_family
from app.models.inbox import Notification
from app.models.lock import Device, Override
from app.models.points import Points, PointsType
from app.models.reward import Redemption, Reward
from app.models.user import UserRole

from tests.factories import make_rule

from .conftest import _headers, _make_user

R = "/api/v1/kid/redeem"


def _fund(db, kid, amount):
    db.add(Points(user_id=kid.id, points_type=PointsType.BONUS, amount=amount, description="t"))
    db.commit()


def _reward(db, price=100):
    r = Reward(name="Movie night", price=price, icon="x")
    db.add(r)
    db.commit()
    return r


def _device(db, kid):
    d = Device(mac="aa:bb:cc:dd:ee:01", name="Phone", status="assigned")
    d.owners.append(kid)
    db.add(d)
    db.commit()
    return d


def _ask(client, h, rid):
    return client.post(R, json={"kind": "reward", "reward_id": rid}, headers=h)


def _balance(client, h):
    return client.get("/api/v1/kid/rewards", headers=h).json()["balance"]


def test_request_pending_balance_unchanged(client, db, kid, kid_headers):
    _fund(db, kid, 150)
    rw = _reward(db)
    assert _ask(client, kid_headers, rw.id).status_code == 200
    data = client.get("/api/v1/kid/rewards", headers=kid_headers).json()
    assert data["balance"] == 150 and len(data["pending"]) == 1
    assert data["rewards"][0]["name"] == "Movie night"


def test_request_needs_points(client, db, kid, kid_headers):
    _fund(db, kid, 40)
    r = _ask(client, kid_headers, _reward(db).id)
    assert r.status_code == 409 and "60 more points" in r.json()["detail"]


def test_approve_deducts_and_award_seen(client, db, kid, kid_headers, parent_headers):
    _fund(db, kid, 150)
    rid = _ask(client, kid_headers, _reward(db).id).json()["id"]
    assert (
        client.post(f"/api/v1/redemptions/{rid}/approve", headers=parent_headers).status_code == 200
    )
    assert _balance(client, kid_headers) == 50
    spent = db.query(Points).filter(Points.points_type == PointsType.REDEMPTION).one()
    assert spent.description == "Movie night"
    aw = client.get("/api/v1/kid/awards", headers=kid_headers).json()
    assert aw[0]["id"] == rid and aw[0]["name"] == "Movie night"
    assert client.post(f"/api/v1/kid/awards/{rid}/seen", headers=kid_headers).status_code == 204
    assert client.get("/api/v1/kid/awards", headers=kid_headers).json() == []


def test_deny_keeps_balance(client, db, kid, kid_headers, parent_headers):
    _fund(db, kid, 150)
    rid = _ask(client, kid_headers, _reward(db).id).json()["id"]
    assert client.post(f"/api/v1/redemptions/{rid}/deny", headers=parent_headers).status_code == 200
    assert _balance(client, kid_headers) == 150
    assert client.get("/api/v1/kid/awards", headers=kid_headers).json() == []


def test_double_spend_second_approve_409(client, db, kid, kid_headers, parent_headers):
    _fund(db, kid, 150)
    rw = _reward(db)
    a = _ask(client, kid_headers, rw.id).json()["id"]
    b = _ask(client, kid_headers, rw.id).json()["id"]
    assert (
        client.post(f"/api/v1/redemptions/{a}/approve", headers=parent_headers).status_code == 200
    )
    r = client.post(f"/api/v1/redemptions/{b}/approve", headers=parent_headers)
    assert r.status_code == 409 and "Not enough" in r.json()["detail"]
    assert _balance(client, kid_headers) == 50
    assert db.query(Points).filter(Points.points_type == PointsType.REDEMPTION).count() == 1


def test_approve_twice_409_one_row(client, db, kid, kid_headers, parent_headers):
    _fund(db, kid, 150)
    rid = _ask(client, kid_headers, _reward(db).id).json()["id"]
    url = f"/api/v1/redemptions/{rid}/approve"
    assert client.post(url, headers=parent_headers).status_code == 200
    assert client.post(url, headers=parent_headers).status_code == 409
    assert db.query(Points).filter(Points.points_type == PointsType.REDEMPTION).count() == 1


def test_screen_time_switch_off(client, db, kid, kid_headers):
    _fund(db, kid, 500)
    _device(db, kid)
    r = client.post(R, json={"kind": "screen_time", "minutes": 30}, headers=kid_headers)
    assert r.status_code == 400 and "isn't turned on" in r.json()["detail"]


def test_screen_time_no_devices(client, db, kid, kid_headers):
    _fund(db, kid, 500)
    get_family(db).points_unlock_early = True
    db.commit()
    r = client.post(R, json={"kind": "screen_time", "minutes": 30}, headers=kid_headers)
    assert r.status_code == 400 and r.json()["detail"] == "Ask a parent to add your device first."


def _screen(client, db, kid, kid_headers, parent_headers, monkeypatch):
    _fund(db, kid, 500)
    fam = get_family(db)
    fam.points_unlock_early = True
    db.commit()
    dev = _device(db, kid)
    calls = []
    monkeypatch.setattr("app.lock.loop.trigger", lambda: calls.append(1))
    rid = client.post(R, json={"kind": "screen_time", "minutes": 30}, headers=kid_headers).json()[
        "id"
    ]
    r = client.post(f"/api/v1/redemptions/{rid}/approve", headers=parent_headers)
    assert r.status_code == 200
    return dev, fam, calls


def test_screen_time_bonus_override(client, db, kid, kid_headers, parent_headers, monkeypatch):
    dev, _, calls = _screen(client, db, kid, kid_headers, parent_headers, monkeypatch)
    o = db.query(Override).filter(Override.device_id == dev.id).one()
    assert o.source == "bonus" and o.action == "unlock"
    delta = o.expires_at - datetime.now(UTC).replace(tzinfo=None)
    assert abs(delta - timedelta(minutes=30)) < timedelta(seconds=5)
    assert calls == [1]
    assert _balance(client, kid_headers) == 500 - 40


def test_bonus_not_online_outside_window(client, db, kid, kid_headers, parent_headers, monkeypatch):
    dev, fam, _ = _screen(client, db, kid, kid_headers, parent_headers, monkeypatch)
    now = datetime.now(UTC)
    local = local_now(fam.timezone, now)
    start = (local + timedelta(hours=2)).strftime("%H:%M")
    end = (local + timedelta(hours=3)).strftime("%H:%M")
    if start < end:  # skip the midnight-wrap edge
        make_rule(db, times=((start, end),), kid_ids=[kid.id])
        facts = device_facts(db, dev, fam, now)
        assert facts.bonus_active and not is_online(facts, local)


def test_other_kid_cannot_mark_seen(client, db, kid, kid_headers, parent_headers):
    _fund(db, kid, 150)
    rid = _ask(client, kid_headers, _reward(db).id).json()["id"]
    client.post(f"/api/v1/redemptions/{rid}/approve", headers=parent_headers)
    other = _headers(db, _make_user(db, "sis", UserRole.KID))
    assert client.post(f"/api/v1/kid/awards/{rid}/seen", headers=other).status_code == 404


def test_parents_notified_and_listed(client, db, parent, kid, kid_headers, parent_headers):
    _fund(db, kid, 150)
    rid = _ask(client, kid_headers, _reward(db).id).json()["id"]
    n = db.query(Notification).filter(Notification.kind == "redemption_request").all()
    assert [(x.user_id, x.redemption_id) for x in n] == [(parent.id, rid)]
    rows = client.get("/api/v1/redemptions?status=pending", headers=parent_headers).json()
    assert rows[0]["kid_name"] == kid.full_name and rows[0]["kid_balance"] == 150
    assert rows[0]["name"] == "Movie night" and rows[0]["cost"] == 100
    assert db.query(Redemption).count() == 1


def _notes(db, uid, kind):
    return db.query(Notification).filter_by(user_id=uid, kind=kind).all()


def test_hidden_reward_invisible_to_kid(client, db, kid, kid_headers):
    _fund(db, kid, 500)
    rw = _reward(db)
    rw.visible = False
    db.commit()
    assert client.get("/api/v1/kid/rewards", headers=kid_headers).json()["rewards"] == []
    assert _ask(client, kid_headers, rw.id).status_code == 400


def test_no_approval_reward_pays_now(client, db, kid, parent, kid_headers):
    _fund(db, kid, 500)
    rw = _reward(db, 120)
    rw.needs_approval = False
    db.commit()
    r = _ask(client, kid_headers, rw.id)
    assert r.json()["status"] == "approved"
    assert _balance(client, kid_headers) == 380
    red = db.query(Redemption).one()
    assert red.auto and red.decided_by_id is None
    assert len(_notes(db, parent.id, "redemption_decided")) == 1
    assert _notes(db, parent.id, "redemption_request") == []


def test_decline_note_reaches_kid(client, db, kid, kid_headers, parent_headers):
    _fund(db, kid, 150)
    rid = _ask(client, kid_headers, _reward(db).id).json()["id"]
    r = client.post(
        f"/api/v1/redemptions/{rid}/deny", json={"note": "let's talk Sat"}, headers=parent_headers
    )
    assert r.status_code == 200
    assert _notes(db, kid.id, "redemption_decided")[0].body == "let's talk Sat"
    assert db.get(Redemption, rid).note == "let's talk Sat"


def test_approve_all_skips_unaffordable(client, db, kid, kid_headers, parent_headers):
    _fund(db, kid, 300)
    rw = _reward(db, 200)
    a = _ask(client, kid_headers, rw.id).json()["id"]
    b = _ask(client, kid_headers, rw.id).json()["id"]
    r = client.post("/api/v1/redemptions/approve-all", headers=parent_headers)
    assert r.json() == {"approved": 1, "skipped": 1}
    assert _balance(client, kid_headers) == 100
    assert db.get(Redemption, a).status == "approved"
    assert db.get(Redemption, b).status == "pending"
    row = client.get("/api/v1/redemptions", headers=parent_headers).json()[0]
    assert row["kid_balance_after"] == row["kid_balance"] - row["cost"]


def test_history_filters_and_totals(client, db, kid, parent, parent_headers):
    kid2 = _make_user(db, "sally", UserRole.KID)
    rw = _reward(db, 200)
    now = datetime.utcnow()

    def red(k, status, cost, by=parent.id, ago=1, **kw):
        r = Redemption(kid_id=k.id, cost=cost, status=status, decided_by_id=by, **kw)
        r.created_at = now - timedelta(days=ago)
        r.decided_at = r.created_at + timedelta(minutes=5)
        db.add(r)

    red(kid, "approved", 40, by=None, kind="screen_time", minutes=30, auto=True)
    red(kid, "approved", 200, kind="reward", reward_id=rw.id)
    red(kid2, "denied", 150, kind="reward", reward_id=rw.id, note="Not this week")
    red(kid, "approved", 200, ago=40, kind="reward", reward_id=rw.id)  # too old
    db.add(Redemption(kid_id=kid.id, cost=10, kind="reward", reward_id=rw.id))  # pending
    db.commit()
    H = "/api/v1/redemptions/history"
    d = client.get(H, headers=parent_headers).json()
    assert d["totals"] == {"spent": 240, "screen_minutes": 30, "approved": 2, "declined": 1}
    assert len(d["rows"]) == 3
    assert d["rows"][0]["created_at"] >= d["rows"][-1]["created_at"]
    denied = next(r for r in d["rows"] if r["status"] == "denied")
    assert denied["kid_name"] == "Sally" and denied["note"] == "Not this week"
    assert denied["name"] == "Movie night" and denied["decided_by_name"] == "Mom"
    d = client.get(H, params={"kid_id": kid.id}, headers=parent_headers).json()
    assert d["totals"]["approved"] == 2 and d["totals"]["declined"] == 0
    d = client.get(H, params={"kind": "screen_time"}, headers=parent_headers).json()
    assert len(d["rows"]) == 1 and d["rows"][0]["auto"] is True
    assert d["rows"][0]["decided_by_name"] is None and d["rows"][0]["minutes"] == 30
    d = client.get(H, params={"days": 60}, headers=parent_headers).json()
    assert len(d["rows"]) == 4
    assert client.get(H, params={"days": 0}, headers=parent_headers).status_code == 422


def test_history_parent_only(client, kid_headers):
    assert client.get("/api/v1/redemptions/history", headers=kid_headers).status_code == 403


def test_pending_list_carries_the_reward_icon(client, db, kid, parent_headers):
    movie = Reward(name="Treat", price=10, icon="movie")
    other = Reward(name="Treat", price=10, icon="cake")
    db.add_all([movie, other])
    db.commit()
    db.add_all(
        [
            Redemption(kid_id=kid.id, kind="reward", reward_id=other.id, cost=10),
            Redemption(kid_id=kid.id, kind="screen_time", minutes=15, cost=20),
            Redemption(kid_id=kid.id, kind="reward", reward_id=movie.id, cost=10),
        ]
    )
    db.commit()
    rows = client.get("/api/v1/redemptions", headers=parent_headers).json()
    assert [r["icon"] for r in rows] == ["cake", None, "movie"]


def test_approve_all_skips_concurrently_answered(
    client, db, kid, kid_headers, parent_headers, monkeypatch
):
    from app.services import economy
    from fastapi import HTTPException

    _fund(db, kid, 500)
    rw = _reward(db, 100)
    a = _ask(client, kid_headers, rw.id).json()["id"]
    b = _ask(client, kid_headers, rw.id).json()["id"]
    real = economy.decide

    def flaky(db_, r, *args, **kw):
        if r.id == a:
            raise HTTPException(409, "Someone already answered this request.")
        return real(db_, r, *args, **kw)

    monkeypatch.setattr(economy, "decide", flaky)
    r = client.post("/api/v1/redemptions/approve-all", headers=parent_headers)
    assert r.status_code == 200
    assert r.json() == {"approved": 1, "skipped": 1}
    assert db.get(Redemption, b).status == "approved"


def test_approve_all_kid_forbidden_and_empty(client, kid_headers, parent_headers):
    url = "/api/v1/redemptions/approve-all"
    assert client.post(url, headers=kid_headers).status_code == 403
    assert client.post(url, headers=parent_headers).json() == {"approved": 0, "skipped": 0}
