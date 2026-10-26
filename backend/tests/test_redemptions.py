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
