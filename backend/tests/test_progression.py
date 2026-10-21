from datetime import UTC, date, datetime, timedelta

from app.lock.reset import current_chore_day
from app.models.family import get_family
from app.models.gamification import Points, PointsType
from app.models.task import Task, TaskStatus
from app.models.user import UserRole
from app.services import progression as pr

from tests.conftest import _headers, _make_user


def _kid(db):
    return _make_user(db, "leo", UserRole.KID)


def _day(db, kid, d, *statuses):
    for st in statuses:
        db.add(
            Task(
                title="c",
                is_recurring=False,
                due_date=datetime.combine(d, datetime.min.time()),
                status=st,
                assigned_to_id=kid.id,
                created_by_id=kid.id,
                recurrence_pattern={"chore": True},
            )
        )
    db.commit()


def test_xp_for_level():
    assert pr.xp_for_level(1) == 0
    assert pr.xp_for_level(2) == 50
    assert pr.xp_for_level(25) == round(50 * 24**1.6)


def test_level_titles():
    titles = {n: pr.level_for(pr.xp_for_level(n)) for n in (1, 2, 3, 7, 8, 25, 30)}
    assert [titles[n].title for n in (1, 2, 3, 7, 8, 25, 30)] == [
        "Rookie",
        "Rookie",
        "Regular",
        "Grinder",
        "Clutch",
        "Mythic",
        "Mythic",
    ]
    lv = pr.level_for(60)
    assert (lv.level, lv.floor, lv.next) == (2, 50, pr.xp_for_level(3))


def test_xp_ignores_spending(db):
    k = _kid(db)
    db.add(Points(user_id=k.id, points_type=PointsType.BONUS, amount=500, description="a"))
    db.add(Points(user_id=k.id, points_type=PointsType.REDEMPTION, amount=-450, description="b"))
    db.add(Points(user_id=k.id, points_type=PointsType.PENALTY, amount=-20, description="c"))
    db.add(Points(user_id=k.id, points_type=PointsType.TRANSFER, amount=30, description="d"))
    db.commit()
    assert pr.xp(db, k.id) == 500
    assert pr.level_for(pr.xp(db, k.id)).level == pr.level_for(500).level


T = date(2026, 10, 20)
D, S, TODO = TaskStatus.DONE, TaskStatus.SUBMITTED_FOR_APPROVAL, TaskStatus.TODO


def test_streak_counts_and_breaks(db):
    k = _kid(db)
    for i in (1, 2, 3):
        _day(db, k, T - timedelta(days=i), D)
    assert pr.streak(db, k.id, T).current == 3
    _day(db, k, T - timedelta(days=2), TODO)  # same day, one chore open
    s = pr.streak(db, k.id, T)
    assert s.current == 1 and s.longest == 1 and s.runs == [1]


def test_streak_submitted_counts_and_gaps_skipped(db):
    k = _kid(db)
    _day(db, k, T - timedelta(days=1), S)
    _day(db, k, T - timedelta(days=4), D)  # 2 and 3 have no chores
    assert pr.streak(db, k.id, T).current == 2


def test_streak_today_open_never_breaks(db):
    k = _kid(db)
    _day(db, k, T - timedelta(days=1), D)
    _day(db, k, T, TODO)
    assert pr.streak(db, k.id, T).current == 1
    _day(db, k, T, D)  # today's second chore, done -> still open day
    assert pr.streak(db, k.id, T).current == 1


def test_streak_today_complete_counts(db):
    k = _kid(db)
    _day(db, k, T - timedelta(days=1), D)
    _day(db, k, T, S)
    assert pr.streak(db, k.id, T).current == 2


def test_streak_runs_chronological(db):
    k = _kid(db)
    for off, st in [(6, D), (5, D), (4, TODO), (3, D), (2, TODO), (1, D)]:
        _day(db, k, T - timedelta(days=off), st)
    s = pr.streak(db, k.id, T)
    assert s.runs == [2, 1] and s.current == 1 and s.longest == 2


def test_progress_in_today_payloads(client, db, parent_headers):
    k = _kid(db)
    get_family(db).last_reset_date = current_chore_day(get_family(db), datetime.now(UTC))
    db.add(Points(user_id=k.id, points_type=PointsType.BONUS, amount=60, description="a"))
    db.commit()
    kid_p = client.get("/api/v1/kid/today", headers=_headers(db, k)).json()["progress"]
    assert kid_p["level"] == 2 and kid_p["title"] == "Rookie" and kid_p["xp"] == 60
    assert set(kid_p) == {"level", "title", "xp", "floor", "next", "streak", "flair"}
    par = client.get("/api/v1/today", headers=parent_headers).json()["kids"][0]
    assert par["progress"] == kid_p
