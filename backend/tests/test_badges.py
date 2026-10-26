from datetime import UTC, datetime, timedelta

from app.lock.reset import current_chore_day
from app.models.badge import BadgeAward
from app.models.family import get_family
from app.models.points import Points, PointsType
from app.models.reward import Redemption, Reward
from app.models.user import UserRole
from app.services import badges as bd
from app.services.progression import xp_for_level as xp_for

from .conftest import _headers, _make_user
from .factories import make_run

NOW = datetime(2026, 10, 20, 12, 0)


def _done(db, kid, parent, n=1, **kw):
    """n approved runs (one per day backwards from today)."""
    day = current_chore_day(get_family(db), datetime.now(UTC))
    for i in range(n):
        make_run(
            db,
            parent,
            kid,
            status="done",
            approved=True,
            day=day - timedelta(days=i),
            submitted_at=NOW,
            **kw,
        )


def _keys(awards):
    return {a.badge_key: a.tier for a in awards}


def test_task_master_tiers_and_first_blood(db, parent, kid):
    fam = get_family(db)
    _done(db, kid, parent, 20)
    got = _keys(bd.check_badges(db, kid, fam))
    assert got["first_blood"] == 1 and got["task_master"] == 1
    _done(db, kid, parent, 30)  # 50 total
    assert _keys(bd.check_badges(db, kid, fam))["task_master"] == 2


def test_on_fire_from_streak(db, parent, kid):
    _done(db, kid, parent, 7)
    got = _keys(bd.check_badges(db, kid, get_family(db)))
    assert got["on_fire"] == 1


def test_second_check_awards_nothing_new(db, parent, kid):
    fam = get_family(db)
    _done(db, kid, parent, 3)
    assert bd.check_badges(db, kid, fam)
    db.commit()
    assert bd.check_badges(db, kid, fam) == []
    assert db.query(BadgeAward).filter_by(kid_id=kid.id, badge_key="first_blood").count() == 1


def test_tier_up_resets_seen(db, parent, kid):
    fam = get_family(db)
    _done(db, kid, parent, 20)
    bd.check_badges(db, kid, fam)
    db.query(BadgeAward).update({"seen_by_kid": True})
    db.commit()
    _done(db, kid, parent, 30)
    bd.check_badges(db, kid, fam)
    a = db.query(BadgeAward).filter_by(badge_key="task_master").one()
    assert a.tier == 2 and a.seen_by_kid is False


def test_timing_metrics(db, parent, kid):
    fam = get_family(db)
    day = current_chore_day(fam, datetime.now(UTC))
    dl = datetime.combine(day, datetime.min.time()) + timedelta(hours=18)  # UTC tz default
    fam.timezone = "UTC"
    for done in (dl - timedelta(hours=2), dl - timedelta(minutes=5), dl + timedelta(minutes=5)):
        make_run(
            db,
            parent,
            kid,
            status="done",
            approved=True,
            day=day,
            submitted_at=done,
            due_time="18:00",
            title=f"t{done}",
        )
    m = bd.metrics(db, kid, fam)
    assert (m["early"], m["clutch"], m["on_time_run"], m["speed"]) == (1, 1, 2, 0)


def test_spending_metrics(db, parent, kid):
    db.add(Points(user_id=kid.id, points_type=PointsType.BONUS, amount=3000, description="a"))
    rw = Reward(name="Big", price=2000)
    db.add(rw)
    db.flush()
    for kind, cost in (("reward", 2000), ("screen_time", 30)):
        db.add(
            Redemption(
                kid_id=kid.id,
                kind=kind,
                reward_id=rw.id if kind == "reward" else None,
                minutes=30 if kind == "screen_time" else None,
                cost=cost,
                status="approved",
            )
        )
    db.commit()
    m = bd.metrics(db, kid, get_family(db))
    assert (m["redemptions"], m["rewards"], m["big_rewards"], m["screen_redemptions"]) == (
        2,
        1,
        1,
        1,
    )
    assert m["xp"] == 3000


def test_custom_badge_flow(client, db, kid, kid_headers, parent_headers):
    r = client.post(
        "/api/v1/custom-badges",
        json={"name": "Dog walker", "icon": "pets", "description": "x"},
        headers=parent_headers,
    )
    bid = r.json()["id"]
    url = f"/api/v1/custom-badges/{bid}/award"
    for tier in range(1, 6):
        assert client.post(url, json={"kid_id": kid.id}, headers=parent_headers).json() == {
            "tier": tier,
            "tier_name": bd.TIERS[tier - 1],
        }
    r = client.post(url, json={"kid_id": kid.id}, headers=parent_headers)
    assert r.status_code == 409 and r.json()["detail"] == "This badge is already at the top tier."
    shown = bd.badges_for(db, kid.id)
    assert shown[0]["custom"] and shown[0]["tier_name"] == "mega-diamond"
    assert (
        client.get("/api/v1/custom-badges", headers=parent_headers).json()[0]["name"]
        == "Dog walker"
    )
    assert (
        client.patch(
            f"/api/v1/custom-badges/{bid}", json={"name": "Walker"}, headers=parent_headers
        ).json()["name"]
        == "Walker"
    )
    assert client.delete(f"/api/v1/custom-badges/{bid}", headers=parent_headers).status_code == 204
    assert client.get("/api/v1/custom-badges", headers=parent_headers).json() == []


def test_kid_forbidden_on_custom_badges(client, kid, kid_headers):
    assert client.get("/api/v1/custom-badges", headers=kid_headers).status_code == 403
    r = client.post("/api/v1/custom-badges/1/award", json={"kid_id": kid.id}, headers=kid_headers)
    assert r.status_code == 403


def test_celebrations_level_badge_reward_and_seen(client, db, parent, kid, kid_headers):
    db.add(Points(user_id=kid.id, points_type=PointsType.BONUS, amount=60, description="a"))
    rw = Reward(name="Movie night", price=10)
    db.add(rw)
    db.flush()
    red = Redemption(
        kid_id=kid.id, kind="reward", reward_id=rw.id, cost=10, status="approved", decided_at=NOW
    )
    db.add(red)
    db.add(BadgeAward(kid_id=kid.id, badge_key="first_blood", tier=1, earned_at=NOW))
    db.commit()
    feed = client.get("/api/v1/kid/celebrations", headers=kid_headers).json()
    assert [f["key"] for f in feed] == [f"r:{red.id}", "b:1", "l:2"]
    assert [f["size"] for f in feed] == ["big", "small", "big"]
    assert feed[0]["kind"] == "reward" and feed[0]["title"] == "Movie night"
    for f in feed:
        assert (
            client.post(
                f"/api/v1/kid/celebrations/{f['key']}/seen", headers=kid_headers
            ).status_code
            == 204
        )
    assert client.get("/api/v1/kid/celebrations", headers=kid_headers).json() == []
    db.refresh(kid)
    assert kid.celebrated_level == 2


def test_celebration_seen_not_others(client, db, kid, kid_headers):
    sis = _make_user(db, "sis", UserRole.KID)
    a = BadgeAward(kid_id=sis.id, badge_key="first_blood", tier=1)
    db.add(a)
    db.commit()
    r = client.post(f"/api/v1/kid/celebrations/b:{a.id}/seen", headers=kid_headers)
    assert r.status_code == 404
    assert client.post("/api/v1/kid/celebrations/zzz/seen", headers=kid_headers).status_code == 404
    assert _headers(db, sis)


def test_approve_awards_badges_and_redemption_check(
    client, db, parent, kid, parent_headers, kid_headers
):
    t = make_run(
        db, parent, kid, status="submitted", points=5, day=NOW.date(), submitted_at=NOW, title="c"
    )
    assert client.post(f"/api/v1/chores/{t.id}/approve", headers=parent_headers).status_code == 200
    assert db.query(BadgeAward).filter_by(kid_id=kid.id, badge_key="first_blood").count() == 1
    feed = client.get("/api/v1/kid/celebrations", headers=kid_headers).json()
    assert feed[0]["detail"] == "copper"


def test_level_celebration_lists_new_flair(client, db, kid, kid_headers):
    kid.celebrated_level = 7
    db.add(Points(user_id=kid.id, points_type=PointsType.BONUS, amount=xp_for(8), description="a"))
    db.commit()
    lv = [
        f
        for f in client.get("/api/v1/kid/celebrations", headers=kid_headers).json()
        if f["kind"] == "level"
    ][0]
    assert lv["key"] == "l:8"
    assert "Crown" in lv["detail"] and "Rocket" in lv["detail"] and "Sun name" in lv["detail"]
    assert {u["label"] for u in lv["unlocked"]} >= {"Crown", "Rocket"}
    assert "Slate" not in lv["detail"]


def test_emblem_map(client, kid_headers):
    r = client.get("/api/v1/flair/emblems", headers=kid_headers).json()
    assert r["emblem-crown"] == "👑" and "card-grid" not in r


def _custom(client, headers, icon="volunteer_activism"):
    return client.post(
        "/api/v1/custom-badges", json={"name": "Kindness", "icon": icon}, headers=headers
    )


def test_custom_badge_glyph_only(client, parent_headers):
    assert _custom(client, parent_headers).status_code == 200
    assert _custom(client, parent_headers, "🏅").status_code == 422
    bid = _custom(client, parent_headers).json()["id"]
    r = client.patch(f"/api/v1/custom-badges/{bid}", json={"icon": "🏅"}, headers=parent_headers)
    assert r.status_code == 422


def test_award_note_and_recent(client, db, parent, kid, parent_headers, kid_headers):
    from app.models.inbox import Notification

    bid = _custom(client, parent_headers).json()["id"]
    r = client.post(
        f"/api/v1/custom-badges/{bid}/award",
        json={"kid_id": kid.id, "note": " shared her snack "},
        headers=parent_headers,
    )
    assert r.json() == {"tier": 1, "tier_name": "copper"}
    n = db.query(Notification).filter_by(kind="badge_earned").one()
    assert n.body == "copper · shared her snack"
    _done(db, kid, parent, 1)
    bd.check_badges(db, kid, get_family(db))
    db.commit()
    rec = client.get("/api/v1/badges/recent", headers=parent_headers).json()
    assert len(rec) == 2
    cust = next(x for x in rec if x["custom"])
    assert cust["note"] == "shared her snack" and cust["by_name"] == parent.full_name
    assert (
        cust["tier"] == 1 and cust["kid_name"] == kid.full_name and cust["key"] == f"custom:{bid}"
    )
    built = next(x for x in rec if not x["custom"])
    assert built["by_name"] is None and built["key"] == "first_blood"
    assert cust["earned_at"].endswith("Z")
    assert [x["earned_at"] for x in rec] == sorted((x["earned_at"] for x in rec), reverse=True)
    old = db.query(BadgeAward).filter_by(custom_badge_id=bid).one()
    old.earned_at = datetime.utcnow() - timedelta(days=9)
    db.commit()
    assert len(client.get("/api/v1/badges/recent", headers=parent_headers).json()) == 1
    assert len(client.get("/api/v1/badges/recent?days=30", headers=parent_headers).json()) == 2
    assert client.get("/api/v1/badges/recent", headers=kid_headers).status_code == 403


def test_overview_tiers(client, db, kid, parent_headers, kid_headers):
    from app.models.user import UserRole

    other = _make_user(db, "sis", UserRole.KID)
    bid = _custom(client, parent_headers).json()["id"]
    client.post(
        f"/api/v1/custom-badges/{bid}/award", json={"kid_id": kid.id}, headers=parent_headers
    )
    rows = client.get("/api/v1/badges/overview", headers=parent_headers).json()
    assert len(rows) == len(bd.CATALOG) + 1 == 19
    assert [r["key"] for r in rows[:18]] == list(bd.CATALOG)
    assert rows[0]["icon"] == "🩸" and not rows[0]["custom"] and rows[0]["tiers"] == {}
    last = rows[-1]
    assert (
        last["key"] == f"custom:{bid}" and last["custom"] and last["icon"] == "volunteer_activism"
    )
    assert last["tiers"] == {str(kid.id): 1} and str(other.id) not in last["tiers"]
    assert client.get("/api/v1/badges/overview", headers=kid_headers).status_code == 403


def test_custom_celebration_has_glyph(client, db, kid, parent_headers, kid_headers):
    bid = _custom(client, parent_headers).json()["id"]
    client.post(
        f"/api/v1/custom-badges/{bid}/award",
        json={"kid_id": kid.id, "note": "so kind"},
        headers=parent_headers,
    )
    db.add(BadgeAward(kid_id=kid.id, badge_key="first_blood", tier=1, earned_at=NOW))
    db.commit()
    feed = client.get("/api/v1/kid/celebrations", headers=kid_headers).json()
    c = next(f for f in feed if f["kind"] == "badge" and f["title"] == "Kindness")
    assert c["glyph"] == "volunteer_activism" and c["detail"] == "so kind"
    b = next(f for f in feed if f["kind"] == "badge" and "First Blood" in f["title"])
    assert "glyph" not in b and b["title"].startswith("🩸")
