from datetime import UTC, datetime, timedelta

from app.models.family import get_family
from app.models.inbox import Notification
from app.models.lock import Device, Override
from app.models.points import Points, PointsType
from app.models.reward import Redemption
from app.services import screen_time

from tests.factories import make_rule

R = "/api/v1/kid/redeem"
S = "/api/v1/screen-time"


def _setup(db, kid, balance=500, **fam_kw):
    fam = get_family(db)
    fam.points_unlock_early = True
    fam.screen_time_price = 20
    for k, v in fam_kw.items():
        setattr(fam, k, v)
    d = Device(mac="aa:bb:cc:dd:ee:01", name="Phone", status="assigned")
    d.owners.append(kid)
    db.add(d)
    db.add(Points(user_id=kid.id, points_type=PointsType.BONUS, amount=balance, description="t"))
    db.commit()
    return d


def _red(db, kid, minutes, created, status="approved"):
    db.add(
        Redemption(
            kid_id=kid.id,
            kind="screen_time",
            minutes=minutes,
            cost=minutes // 15 * 20,
            status=status,
            created_at=created,
        )
    )
    db.commit()


def _ask(client, h, minutes=15):
    return client.post(R, json={"kind": "screen_time", "minutes": minutes}, headers=h)


def _now():
    return datetime.now(UTC).replace(tzinfo=None)


def test_daily_max_boundary_and_reset(client, db, kid, kid_headers):
    _setup(db, kid, screen_max_minutes=60)
    fam = get_family(db)
    start = screen_time.day_start_utc(fam, datetime.now(UTC))
    _red(db, kid, 60, start - timedelta(minutes=5))  # before reset: ignored
    _red(db, kid, 45, start + timedelta(seconds=1))
    assert screen_time.bought_today(db, fam, [kid.id], datetime.now(UTC)) == {kid.id: 45}
    assert _ask(client, kid_headers).status_code == 200
    r = _ask(client, kid_headers)
    assert r.status_code == 409
    assert r.json()["detail"] == "You've had all your screen time for today."


def test_over_limit_message(client, db, kid, kid_headers):
    _setup(db, kid, screen_max_minutes=60)
    fam = get_family(db)
    _red(db, kid, 45, screen_time.day_start_utc(fam, datetime.now(UTC)) + timedelta(seconds=1))
    r = _ask(client, kid_headers, 30)
    assert r.status_code == 409
    assert r.json()["detail"] == "That's over today's limit. You can buy 15 more minutes today."


def test_kid_limit_tighter_than_family(client, db, kid, kid_headers, parent_headers):
    _setup(db, kid, screen_max_minutes=60)
    r = client.put(
        f"{S}/limits/{kid.id}", json={"max_minutes": 30, "min_points": None}, headers=parent_headers
    )
    assert r.status_code == 200
    data = client.get("/api/v1/kid/rewards", headers=kid_headers).json()
    assert data["screen"]["max_today"] == 30 and data["screen"]["left_today"] == 30


def test_min_points(client, db, kid, kid_headers, parent_headers):
    _setup(db, kid, balance=95)
    client.put(
        f"{S}/limits/{kid.id}",
        json={"max_minutes": None, "min_points": 100},
        headers=parent_headers,
    )
    r = _ask(client, kid_headers)
    assert r.status_code == 409
    assert r.json()["detail"] == "You can buy screen time once you have 100 points."


def test_auto_approve_pays_and_unlocks(client, db, kid, kid_headers, parent):
    dev = _setup(db, kid, screen_auto_approve=True)
    r = _ask(client, kid_headers)
    assert r.status_code == 200 and r.json()["status"] == "approved"
    assert client.get("/api/v1/kid/rewards", headers=kid_headers).json()["balance"] == 480
    assert db.query(Override).filter_by(device_id=dev.id, source="bonus").count() == 1
    n = db.query(Notification).filter_by(user_id=parent.id, kind="redemption_decided").one()
    assert n.title == "Timmy bought 15 min of screen time from Phone"
    assert n.body == "Approved automatically · 20 points"
    assert db.query(Redemption).one().auto is True
    ledger = db.query(Points).filter_by(user_id=kid.id).order_by(Points.id.desc()).first()
    assert ledger.description == "15 min of screen time"


def _counts(db):
    return (
        db.query(Points).count(),
        db.query(Override).count(),
        db.query(Redemption).count(),
    )


def test_auto_approve_refusals_write_nothing(client, db, kid, kid_headers):
    _setup(db, kid, balance=10, screen_auto_approve=True)
    before = _counts(db)
    assert _ask(client, kid_headers).status_code == 409
    assert _counts(db) == before
    db.add(Points(user_id=kid.id, points_type=PointsType.BONUS, amount=500, description="t"))
    make_rule(db, kind="off", times=(("00:00", "00:00"),), kid_ids=(kid.id,))  # off all day
    before = _counts(db)
    r = _ask(client, kid_headers)
    assert r.status_code == 409
    assert r.json()["detail"] == "Screen time only works during your allowed hours."
    assert _counts(db) == before


def test_patch_and_limits_api(client, db, kid, kid_headers, parent_headers):
    assert (
        client.patch(S, json={"max_minutes_per_day": 50}, headers=parent_headers).status_code == 422
    )
    r = client.patch(S, json={"max_minutes_per_day": 60, "price": 30}, headers=parent_headers)
    assert r.status_code == 200
    assert r.json()["max_minutes_per_day"] == 60 and r.json()["price"] == 30
    r = client.put(
        f"{S}/limits/{kid.id}", json={"max_minutes": 30, "min_points": 5}, headers=parent_headers
    )
    assert r.json()["kids"][0]["limit"] == {"max_minutes": 30, "min_points": 5}
    assert (
        client.put(f"{S}/limits/999", json={"max_minutes": 30}, headers=parent_headers).status_code
        == 404
    )
    assert client.delete(f"{S}/limits/{kid.id}", headers=parent_headers).status_code == 204
    assert client.get(S, headers=parent_headers).json()["kids"][0]["limit"] is None
    assert client.get(S, headers=kid_headers).status_code == 403


def test_any_hours_bonus_cannot_buy_or_open_an_off_window(client, db, kid, kid_headers):
    from app.lock.state import desired_blocked

    dev = _setup(db, kid, screen_only_allowed_hours=False, screen_auto_approve=True)
    make_rule(db, kind="off", times=(("00:00", "00:00"),), kid_ids=(kid.id,))  # off all day
    before = _counts(db)
    r = _ask(client, kid_headers)
    assert r.status_code == 409
    assert r.json()["detail"] == "Screen time can't turn the internet on during off hours."
    assert _counts(db) == before
    db.add(
        Override(
            device_id=dev.id,
            action="unlock",
            source="bonus",
            expires_at=_now() + timedelta(minutes=30),
        )
    )
    db.commit()
    assert dev.mac in desired_blocked(db, datetime.now(UTC))


def test_day_start_never_in_the_future(db):
    fam = get_family(db)
    fam.reset_time = "06:00"
    fam.last_reset_date = None
    db.commit()
    early = datetime(2026, 10, 27, 0, 16, tzinfo=UTC)  # after midnight, before the reset
    assert screen_time.day_start_utc(fam, early) == datetime(2026, 10, 26, 6, 0)
    later = datetime(2026, 10, 27, 7, 0, tzinfo=UTC)
    assert screen_time.day_start_utc(fam, later) == datetime(2026, 10, 27, 6, 0)


def test_kid_rewards_says_when_an_off_window_blocks_bonus(client, db, kid, kid_headers):
    _setup(db, kid, screen_only_allowed_hours=False)
    sc = client.get("/api/v1/kid/rewards", headers=kid_headers).json()["screen"]
    assert sc["off_now"] is False
    make_rule(db, kind="off", times=(("00:00", "00:00"),), kid_ids=(kid.id,))
    sc = client.get("/api/v1/kid/rewards", headers=kid_headers).json()["screen"]
    assert sc["off_now"] is True


def test_min_points_counts_only_free_points(client, db, kid, kid_headers, parent_headers):
    _setup(db, kid, balance=130)  # a 15 min request costs 20
    client.put(
        f"{S}/limits/{kid.id}",
        json={"max_minutes": None, "min_points": 100},
        headers=parent_headers,
    )
    assert _ask(client, kid_headers).status_code == 200  # 130 free
    assert _ask(client, kid_headers).status_code == 200  # 110 free
    assert _ask(client, kid_headers).status_code == 409  # 90 free, under the 100 minimum
