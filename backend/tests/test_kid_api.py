from datetime import date, datetime

import pytest
from app.core.auth import AuthService
from app.main import app
from app.models.chore_type import ChoreType
from app.models.family import get_family
from app.models.lock import Device
from app.models.points import Points, PointsType
from app.models.reward import Redemption
from app.models.user import User, UserRole
from app.services import chores as svc
from fastapi.testclient import TestClient

from tests.factories import make_run

IP = "192.168.1.50"
DAY = datetime(2026, 10, 20)


def from_ip(ip):
    """TestClient whose requests appear to come from `ip` (installed TestClient has no client=)."""

    async def asgi(scope, receive, send):
        if scope["type"] == "http":
            scope["client"] = (ip, 5000)
        await app(scope, receive, send)

    return TestClient(asgi, base_url="http://localhost")


@pytest.fixture
def kc(client):
    """Client whose requests come from IP (the kid's tablet)."""
    return from_ip(IP)


def mkdev(db, owner=None, ip=IP, mac="aa:bb:cc:dd:ee:01"):
    d = Device(mac=mac, name="Tablet", status="assigned", ip=ip)
    if owner:
        d.owners.append(owner)
    db.add(d)
    db.commit()
    return d


def mkchore(db, parent, kid, **kw):
    return make_run(db, parent, kid, day=DAY.date(), **kw)


def other_kid(db):
    u = User(
        username="sis",
        email="sis@family.local",
        hashed_password="x",
        full_name="Sis",
        role=UserRole.KID,
    )
    db.add(u)
    db.commit()
    return u


def kid_hdr(db, kid):
    return {"Authorization": f"Bearer {AuthService(db).create_access_token({'sub': str(kid.id)})}"}


def test_whoami_unknown_ip_returns_null_device(kc, db, kid):
    mkdev(db, kid, ip="10.0.0.9")
    assert kc.get("/api/v1/kid/whoami").json() == {"device": None, "kids": []}


def test_whoami_lists_owners_by_ip_or_ipv6(kc, db, kid):
    d = mkdev(db, kid, ip=None)
    d.ipv6 = [IP]
    db.commit()
    j = kc.get("/api/v1/kid/whoami").json()
    assert j["device"]["id"] == d.id
    assert j["kids"] == [{"id": kid.id, "full_name": "Timmy", "avatar": None, "has_pin": False}]


def test_login_ok_returns_kid_token(kc, db, kid):
    mkdev(db, kid)
    r = kc.post("/api/v1/kid/login", json={"kid_id": kid.id})
    assert r.status_code == 200
    me = kc.get(
        "/api/v1/kid/today", headers={"Authorization": f"Bearer {r.json()['access_token']}"}
    )
    assert me.status_code == 200


def test_login_from_other_kids_device_403(kc, db, kid):
    mkdev(db, other_kid(db))
    r = kc.post("/api/v1/kid/login", json={"kid_id": kid.id})
    assert (
        r.status_code == 403
        and r.json()["detail"] == "This device doesn't belong to you. Ask a parent."
    )


def test_login_unknown_ip_403(kc, db, kid):
    mkdev(db, kid, ip="10.0.0.9")
    assert kc.post("/api/v1/kid/login", json={"kid_id": kid.id}).status_code == 403


def test_login_wrong_pin_401(kc, db, kid):
    kid.pin_hash = AuthService(db).get_password_hash("1234")
    db.commit()
    mkdev(db, kid)
    r = kc.post("/api/v1/kid/login", json={"kid_id": kid.id, "pin": "0000"})
    assert r.status_code == 401 and r.json()["detail"] == "Wrong PIN. Try again."
    assert kc.post("/api/v1/kid/login", json={"kid_id": kid.id}).status_code == 401
    assert kc.post("/api/v1/kid/login", json={"kid_id": kid.id, "pin": "1234"}).status_code == 200


def test_kid_login_rate_limited(kc, db, kid):
    kid.pin_hash = AuthService(db).get_password_hash("1234")
    db.commit()
    mkdev(db, kid)
    bad = {"kid_id": kid.id, "pin": "0"}
    codes = [kc.post("/api/v1/kid/login", json=bad).status_code for _ in range(6)]
    assert codes == [401] * 5 + [429]


def test_successful_kid_logins_do_not_count(kc, db, kid):
    mkdev(db, kid)
    codes = {kc.post("/api/v1/kid/login", json={"kid_id": kid.id}).status_code for _ in range(8)}
    assert codes == {200}


def test_ipv6_matched_after_normalizing(kc, db, kid):
    d = mkdev(db, kid, ip=None)
    d.ipv6 = ["FE80:0:0:0:0:0:0:ABCD"]
    db.commit()
    c = from_ip("fe80::abcd")
    assert c.get("/api/v1/kid/whoami").json()["device"]["id"] == d.id
    d.ipv6, d.ip = None, "192.168.1.50"
    db.commit()
    assert from_ip("::ffff:192.168.1.50").get("/api/v1/kid/whoami").json()["device"]["id"] == d.id


def test_done_chore_from_another_day_409(kc, db, parent, kid):
    get_family(db).last_reset_date = date(2026, 10, 21)
    t = mkchore(db, parent, kid)  # due 2026-10-20
    r = kc.post(f"/api/v1/kid/chores/{t.id}/done", headers=kid_hdr(db, kid))
    assert r.status_code == 409 and r.json()["detail"] == "That chore is from another day."


def test_login_rate_limit_is_per_real_ip(client, db):
    lc = from_ip("127.0.0.1")
    bad = {"username": "nobody", "password": "x"}
    for _ in range(10):
        lc.post("/api/v1/auth/login", json=bad, headers={"X-Real-IP": "10.0.0.1"})
    r = lc.post("/api/v1/auth/login", json=bad, headers={"X-Real-IP": "10.0.0.1"})
    assert r.status_code == 429
    r = lc.post("/api/v1/auth/login", json=bad, headers={"X-Real-IP": "10.0.0.2"})
    assert r.status_code == 401


def test_today_only_own_chores_points_and_locked(kc, db, parent, kid):
    get_family(db).last_reset_date = DAY.date()
    mkdev(db, kid)
    mine = mkchore(db, parent, kid)
    mkchore(db, parent, other_kid(db))
    db.add(Points(user_id=kid.id, points_type=PointsType.TASK_COMPLETION, amount=7))
    db.commit()
    j = kc.get("/api/v1/kid/today", headers=kid_hdr(db, kid)).json()
    assert [(c["id"], c["title"], c["points"], c["state"]) for c in j["chores"]] == [
        (mine.id, "x", 3, "todo")
    ]
    assert j["points_balance"] == 7 and j["locked"] is True


def test_today_reports_points_held_by_pending_requests(kc, db, parent, kid):
    get_family(db).last_reset_date = DAY.date()
    mkdev(db, kid)
    mkchore(db, parent, kid)
    db.add(Points(user_id=kid.id, points_type=PointsType.TASK_COMPLETION, amount=7))
    db.add(Redemption(kid_id=kid.id, kind="screen_time", minutes=15, cost=5, status="pending"))
    db.commit()
    j = kc.get("/api/v1/kid/today", headers=kid_hdr(db, kid)).json()
    assert (j["points_balance"], j["points_held"]) == (7, 5)


def test_kid_marks_own_chore_done(kc, db, parent, kid, monkeypatch):
    calls = []
    monkeypatch.setattr("app.api.kid.trigger", lambda: calls.append(1))
    get_family(db).last_reset_date = DAY.date()
    t = mkchore(db, parent, kid)
    r = kc.post(f"/api/v1/kid/chores/{t.id}/done", headers=kid_hdr(db, kid))
    assert r.status_code == 200 and r.json()["status"] == "submitted_for_approval"
    assert r.json()["submitted_for_approval_at"] and calls == [1]
    db.refresh(t)
    assert t.status == "submitted"


def test_kid_cannot_mark_other_kids_chore(kc, db, parent, kid):
    t = mkchore(db, parent, other_kid(db))
    r = kc.post(f"/api/v1/kid/chores/{t.id}/done", headers=kid_hdr(db, kid))
    assert r.status_code == 403
    db.refresh(t)
    assert t.status == "todo"


def test_parent_token_rejected(kc, db, parent, parent_headers):
    assert kc.get("/api/v1/kid/today", headers=parent_headers).status_code == 403


def test_x_real_ip_ignored_from_non_loopback(kc, db, kid):
    mkdev(db, kid, ip="10.9.9.9")
    h = {"X-Real-IP": "10.9.9.9"}
    assert kc.get("/api/v1/kid/whoami", headers=h).json()["device"] is None
    assert kc.post("/api/v1/kid/login", json={"kid_id": kid.id}, headers=h).status_code == 403


def test_x_real_ip_trusted_from_loopback(client, db, kid):
    mkdev(db, kid, ip="10.9.9.9")
    lc = from_ip("127.0.0.1")
    j = lc.get("/api/v1/kid/whoami", headers={"X-Real-IP": "10.9.9.9"}).json()
    assert j["device"] is not None


def test_done_timestamp_is_utc_z(kc, db, parent, kid):
    get_family(db).last_reset_date = DAY.date()
    t = mkchore(db, parent, kid)
    r = kc.post(f"/api/v1/kid/chores/{t.id}/done", headers=kid_hdr(db, kid))
    assert r.json()["submitted_for_approval_at"].endswith("Z")


# --- parent "view as kid" preview (GET only) ---


def view(h, kid_id):
    return {**h, "X-View-As": str(kid_id)}


def test_parent_preview_today_shows_kids_chores(client, db, parent, kid, parent_headers):
    get_family(db).last_reset_date = DAY.date()
    mkdev(db, kid, ip="10.9.9.9")  # not the parent's IP: lock comes from the kid's device
    mkchore(db, parent, kid)
    db.commit()
    r = client.get("/api/v1/kid/today", headers=view(parent_headers, kid.id))
    assert r.status_code == 200 and len(r.json()["chores"]) == 1
    assert r.json()["locked"] is True


def test_parent_preview_other_gets(client, db, parent, kid, parent_headers):
    h = view(parent_headers, kid.id)
    for p in ("rewards", "awards", "celebrations"):
        assert client.get(f"/api/v1/kid/{p}", headers=h).status_code == 200, p


def test_parent_preview_non_kid_404(client, parent, parent_headers):
    r = client.get("/api/v1/kid/today", headers=view(parent_headers, parent.id))
    assert r.status_code == 404 and r.json()["detail"] == "We couldn't find that kid."
    assert client.get("/api/v1/kid/today", headers=view(parent_headers, 9999)).status_code == 404


def test_parent_without_header_403(client, parent_headers):
    assert client.get("/api/v1/kid/today", headers=parent_headers).status_code == 403
    r = client.get("/api/v1/kid/today", headers={**parent_headers, "X-View-As": "x"})
    assert r.status_code == 403


def test_kid_ignores_view_header(client, db, parent, kid, kid_headers):
    sis = other_kid(db)
    mkchore(db, parent, sis)
    r = client.get("/api/v1/kid/today", headers=view(kid_headers, sis.id))
    assert r.status_code == 200 and r.json()["chores"] == []


def test_parent_preview_writes_403(client, db, parent, kid, parent_headers):
    run = mkchore(db, parent, kid)
    h = view(parent_headers, kid.id)
    assert client.post(f"/api/v1/kid/chores/{run.id}/done", headers=h).status_code == 403
    r = client.post("/api/v1/kid/redeem", headers=h, json={"kind": "screen_time", "minutes": 15})
    assert r.status_code == 403
    assert client.post("/api/v1/kid/celebrations/x/seen", headers=h).status_code == 403


def _chain_run(db, parent, kid, **kw):
    r = mkchore(db, parent, kid, steps=["A", "B"], **kw)
    get_family(db).last_reset_date = DAY.date()
    steps = svc.chore_of(r).steps
    steps[1].after_previous = True
    db.commit()
    return r, [s.id for s in steps]


def _tick(client, h, rid, sid, done=True):
    return client.post(f"/api/v1/kid/chores/{rid}/subtasks/{sid}", json={"done": done}, headers=h)


def test_chained_step_order(client, db, parent, kid, kid_headers):
    r, (a, b) = _chain_run(db, parent, kid)
    steps = client.get("/api/v1/kid/today", headers=kid_headers).json()["chores"][0]["subtasks"]
    assert [s["locked"] for s in steps] == [False, True]
    x = _tick(client, kid_headers, r.id, b)
    assert x.status_code == 409 and x.json()["detail"] == "Do the step before this one first."
    assert _tick(client, kid_headers, r.id, a).status_code == 200
    assert _tick(client, kid_headers, r.id, b).status_code == 200


def test_untick_blocked_by_chained_next(client, db, parent, kid, kid_headers):
    r, (a, b) = _chain_run(db, parent, kid)
    _tick(client, kid_headers, r.id, a)
    _tick(client, kid_headers, r.id, b)
    x = _tick(client, kid_headers, r.id, a, False)
    assert x.status_code == 409 and x.json()["detail"] == "Untick the step after it first."
    assert _tick(client, kid_headers, r.id, b, False).status_code == 200
    assert _tick(client, kid_headers, r.id, a, False).status_code == 200


def test_due_at_uses_family_tz(client, db, parent, kid, kid_headers):
    get_family(db).timezone = "America/New_York"
    r = mkchore(db, parent, kid, due_time="19:00", steps=["A"])
    get_family(db).last_reset_date = DAY.date()
    svc.chore_of(r).steps[0].due_time = "20:30"
    db.commit()
    c = client.get("/api/v1/kid/today", headers=kid_headers).json()["chores"][0]
    assert c["due_at"] == "2026-10-21T00:30:00Z"
    assert c["subtasks"][0]["due_at"] == "2026-10-21T00:30:00Z"
    assert c["sent_back"] is False


def test_today_has_type_and_notes(client, db, parent, kid, kid_headers):
    r = mkchore(db, parent, kid)
    get_family(db).last_reset_date = DAY.date()
    pets = db.query(ChoreType).filter_by(name="Pets").one()
    svc.chore_of(r).type_id = pets.id
    db.commit()
    c = client.get("/api/v1/kid/today", headers=kid_headers).json()["chores"][0]
    assert c["type"] == {"id": pets.id, "name": "Pets", "glyph": "pets"}
    assert [n["label"] for n in c["notes"]] == [
        "Out of pet food",
        "Pet seems sick",
        "Someone already did it",
        "Need help",
        "Ran out of time",
        "Can't do it today",
    ]


def test_wrong_pin_logged_per_device(kc, db, kid):
    from app.models.device_activity import DeviceEvent

    kid.pin_hash = AuthService(db).get_password_hash("1234")
    db.commit()
    d = mkdev(db, kid)
    for _ in range(2):
        assert kc.post("/api/v1/kid/login", json={"kid_id": kid.id, "pin": "0"}).status_code == 401
    (e,) = db.query(DeviceEvent).filter_by(kind="sign_in").all()
    assert (e.device_id, e.count, e.kid_id) == (d.id, 2, kid.id)
