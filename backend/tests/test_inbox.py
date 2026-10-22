from datetime import UTC, datetime

from app.models.chores import ChoreRun
from app.models.family import get_family
from app.models.inbox import Notification
from app.models.lock import Device
from app.models.reward import Reward
from app.models.user import UserRole
from app.services import chores as svc

from tests.conftest import _make_user
from tests.factories import make_run
from tests.test_internal_resisting import tok
from tests.test_kid_api import from_ip, kid_hdr, mkdev

N = "/api/v1/notifications"


def _all(db, **kw):
    return db.query(Notification).filter_by(**kw).all()


def _submit(db, parent, kid):
    get_family(db)
    day = svc.today(db, datetime.now(UTC))
    r = make_run(db, parent, kid, day=day)
    mkdev(db, kid)
    res = from_ip("192.168.1.50").post(f"/api/v1/kid/chores/{r.id}/done", headers=kid_hdr(db, kid))
    assert res.status_code == 200
    return r


def test_submit_notifies_each_parent_once(client, db, parent, kid):
    dad = _make_user(db, "dad", UserRole.PARENT)
    r = _submit(db, parent, kid)
    rows = _all(db, kind="chore_submitted")
    assert {n.user_id for n in rows} == {parent.id, dad.id} and len(rows) == 2
    assert all(n.run_id == r.id for n in rows)


def test_redemption_request_and_decision(client, db, parent, kid, kid_headers, parent_headers):
    from app.models.gamification import Points, PointsType

    db.add(Points(user_id=kid.id, points_type=PointsType.BONUS, amount=200, reason="bonus"))
    rw = Reward(name="Movie", price=100)
    db.add(rw)
    db.commit()
    rid = client.post(
        "/api/v1/kid/redeem", json={"kind": "reward", "reward_id": rw.id}, headers=kid_headers
    ).json()["id"]
    assert [n.user_id for n in _all(db, kind="redemption_request")] == [parent.id]
    client.post(f"/api/v1/redemptions/{rid}/approve", headers=parent_headers)
    done = _all(db, kind="redemption_decided")
    assert [(n.user_id, n.redemption_id) for n in done] == [(kid.id, rid)]


def test_resisting_and_new_device_notify_parents(client, db, parent, kid):
    d = Device(mac="aa:bb:cc:dd:ee:09", name="Pad", status="assigned")
    db.add(d)
    db.commit()
    client.post("/api/v1/internal/devices/resisting", json={"resisting": [d.mac]}, headers=tok())
    assert [(n.user_id, n.device_id) for n in _all(db, kind="device_resisting")] == [
        (parent.id, d.id)
    ]
    client.post(
        "/api/v1/internal/devices/seen",
        json={"mac": "aa:bb:cc:dd:ee:77", "hostname": "Newbie"},
        headers=tok(),
    )
    n = _all(db, kind="new_device")
    assert [x.user_id for x in n] == [parent.id] and n[0].device_id


def test_badge_and_level_notify_kid(client, db, parent, kid, parent_headers):
    _submit(db, parent, kid)
    run = db.query(ChoreRun).one()
    run.assignment.chore.points = 500
    db.commit()
    client.post(f"/api/v1/chores/{run.id}/approve", headers=parent_headers)
    assert _all(db, kind="level_up", user_id=kid.id)
    assert _all(db, kind="badge_earned", user_id=kid.id)


def test_list_read_and_privacy(client, db, parent, kid, kid_headers, parent_headers):
    _submit(db, parent, kid)
    j = client.get(N, headers=parent_headers).json()
    assert j["unread"] == 1 and j["items"][0]["kind"] == "chore_submitted" and not j["has_more"]
    nid = j["items"][0]["id"]
    assert client.get(N, headers=kid_headers).json()["items"] == []
    assert client.post(f"{N}/{nid}/read", headers=kid_headers).status_code == 404
    assert client.post(f"{N}/{nid}/read", headers=parent_headers).json()["read"] is True
    assert client.get(f"{N}?unread=true", headers=parent_headers).json()["items"] == []


def test_read_all_and_paging(client, db, parent, parent_headers):
    for i in range(55):
        db.add(Notification(user_id=parent.id, kind="level_up", title=f"n{i}"))
    db.commit()
    j = client.get(N, headers=parent_headers).json()
    assert len(j["items"]) == 50 and j["has_more"] and j["unread"] == 55
    rest = client.get(f"{N}?before={j['items'][-1]['id']}", headers=parent_headers).json()
    assert len(rest["items"]) == 5 and not rest["has_more"]
    client.post(f"{N}/read-all", headers=parent_headers)
    assert client.get(N, headers=parent_headers).json()["unread"] == 0


def test_cascades(client, db, parent, kid, parent_headers):
    r = _submit(db, parent, kid)
    d = Device(mac="aa:bb:cc:dd:ee:55", name="X", status="assigned")
    db.add(d)
    db.commit()
    db.add(Notification(user_id=kid.id, kind="new_device", title="t", device_id=d.id))
    db.commit()
    db.query(Device).filter_by(id=d.id).delete()
    db.commit()
    assert not _all(db, device_id=d.id)
    assert _all(db, run_id=r.id)
    assert client.delete(f"/api/v1/kids/{kid.id}", headers=parent_headers).status_code == 200
    db.expire_all()
    assert not _all(db, run_id=r.id) and not _all(db, user_id=kid.id)
