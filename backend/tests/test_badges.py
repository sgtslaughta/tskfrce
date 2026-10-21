from datetime import UTC, datetime, timedelta

from app.lock.reset import current_chore_day
from app.models.badge import BadgeAward
from app.models.family import get_family
from app.models.gamification import Points, PointsType
from app.models.reward import Redemption, Reward
from app.models.task import Task, TaskStatus
from app.models.user import UserRole
from app.services import badges as bd
from app.services.progression import xp_for_level as xp_for

from .conftest import _headers, _make_user

NOW = datetime(2026, 10, 20, 12, 0)


def _done(db, kid, parent, n=1, **kw):
    """n approved chore instances (one per day backwards from today)."""
    day = current_chore_day(get_family(db), datetime.now(UTC))
    for i in range(n):
        db.add(
            Task(
                title="c",
                is_recurring=False,
                due_date=datetime.combine(day - timedelta(days=i), datetime.min.time()),
                status=TaskStatus.DONE,
                assigned_to_id=kid.id,
                created_by_id=parent.id,
                approved_by_id=parent.id,
                approved_at=NOW,
                submitted_for_approval_at=NOW,
                recurrence_pattern=kw.pop("pattern", None) or {"chore": True},
                **kw,
            )
        )
    db.commit()


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
        db.add(
            Task(
                title="t",
                is_recurring=False,
                due_date=datetime.combine(day, datetime.min.time()),
                status=TaskStatus.DONE,
                assigned_to_id=kid.id,
                created_by_id=parent.id,
                approved_by_id=parent.id,
                submitted_for_approval_at=done,
                created_at=done - timedelta(days=1),
                recurrence_pattern={"chore": True, "due_time": "18:00"},
            )
        )
    db.commit()
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
        json={"name": "Dog walker", "icon": "🐕", "description": "x"},
        headers=parent_headers,
    )
    bid = r.json()["id"]
    url = f"/api/v1/custom-badges/{bid}/award"
    for tier in range(1, 6):
        assert client.post(url, json={"kid_id": kid.id}, headers=parent_headers).json() == {
            "tier": tier
        }
    r = client.post(url, json={"kid_id": kid.id}, headers=parent_headers)
    assert r.status_code == 409 and r.json()["detail"] == "Already at mega-diamond."
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
    t = Task(
        title="c",
        is_recurring=False,
        status=TaskStatus.SUBMITTED_FOR_APPROVAL,
        assigned_to_id=kid.id,
        created_by_id=parent.id,
        points=5,
        due_date=datetime.combine(NOW.date(), datetime.min.time()),
        submitted_for_approval_at=NOW,
        recurrence_pattern={"chore": True},
    )
    db.add(t)
    db.commit()
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
