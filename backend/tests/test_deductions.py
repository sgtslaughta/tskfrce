from datetime import date

from app.models.chat import ThreadMessage
from app.models.chores import ChoreRun
from app.models.family import get_family
from app.models.points import Points, PointsType
from app.services import economy

from tests.conftest import _headers
from tests.factories import api_chore

DAY = date(2026, 10, 20)


def _run(db, client, ph, kid, **kw):
    get_family(db).last_reset_date = DAY
    db.commit()
    api_chore(client, ph, [kid], **kw)
    return db.query(ChoreRun).one().id


def _give(db, kid, n):
    db.add(Points(user_id=kid.id, points_type=PointsType.BONUS, amount=n, reason="bonus"))
    db.commit()


def test_chore_deduct(client, db, kid, parent, parent_headers):
    rid = _run(db, client, parent_headers, kid)
    _give(db, kid, 30)
    r = client.post(
        f"/api/v1/chores/{rid}/deduct",
        json={"kid_id": kid.id, "amount": 10, "note": "Left a mess"},
        headers=parent_headers,
    )
    assert r.json() == {"balance": 20, "deducted": 10}
    p = db.query(Points).filter(Points.reason == "deduction").one()
    assert (p.run_id, p.by_id, p.amount, p.seen_by_kid) == (rid, parent.id, -10, False)
    msg = db.query(ThreadMessage).filter(ThreadMessage.kind == "system").one()
    assert msg.body == "−10 points: Left a mess"
    today = client.get("/api/v1/today", headers=parent_headers).json()
    assert today["kids"][0]["chores"][0]["deducted"] == 10
    kh = _headers(db, kid)
    ded = client.get("/api/v1/kid/today", headers=kh).json()["chores"][0]["deductions"]
    assert ded[0]["by_name"] == parent.full_name
    assert (ded[0]["amount"], ded[0]["note"]) == (10, "Left a mess")


def test_chore_deduct_wrong_kid(client, db, kid, parent_headers):
    from app.models.user import UserRole

    from tests.conftest import _make_user

    other = _make_user(db, "zed", UserRole.KID)
    rid = _run(db, client, parent_headers, kid)
    r = client.post(
        f"/api/v1/chores/{rid}/deduct",
        json={"kid_id": other.id, "amount": 5, "note": "x"},
        headers=parent_headers,
    )
    assert r.status_code == 422 and r.json()["detail"] == "That kid isn't on this chore."


def test_deduct_never_negative(client, db, kid, parent_headers):
    rid = _run(db, client, parent_headers, kid)
    _give(db, kid, 5)
    r = client.post(
        f"/api/v1/chores/{rid}/deduct",
        json={"kid_id": kid.id, "amount": 10, "note": "x"},
        headers=parent_headers,
    )
    assert r.json() == {"balance": 0, "deducted": 5}
    assert economy.balance(db, kid.id) == 0
