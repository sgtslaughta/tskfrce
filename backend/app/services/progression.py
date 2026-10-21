"""XP, levels and streaks, all derived from existing data (nothing stored)."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.flair.catalog import equipped
from app.lock.reset import current_chore_day, is_chore_filter, kid_chores_filter
from app.lock.schedule import local_now
from app.models.family import FamilySettings
from app.models.gamification import Points, PointsType
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole

TITLES = [
    (1, "Rookie"),
    (3, "Regular"),
    (5, "Grinder"),
    (8, "Clutch"),
    (12, "Elite"),
    (16, "Veteran"),
    (20, "Legend"),
    (25, "Mythic"),
]
LOOKBACK_DAYS = 400
_DONE = (TaskStatus.DONE, TaskStatus.SUBMITTED_FOR_APPROVAL)


@dataclass(frozen=True)
class Level:
    level: int
    title: str
    xp: int
    floor: int
    next: int


@dataclass(frozen=True)
class Streak:
    current: int
    longest: int
    runs: list[int]  # completed (broken) run lengths, chronological


def xp(db: Session, kid_id: int) -> int:
    """Lifetime points earned; spending and penalties never lower it."""
    total = db.query(func.coalesce(func.sum(Points.amount), 0)).filter(
        Points.user_id == kid_id,
        Points.amount > 0,
        Points.points_type.notin_([PointsType.REDEMPTION, PointsType.TRANSFER]),
    )
    return int(total.scalar())


def xp_for_level(n: int) -> int:
    return round(50 * (n - 1) ** 1.6)


def level_for(total: int) -> Level:
    n = 1
    while xp_for_level(n + 1) <= total:
        n += 1
    title = [t for lv, t in TITLES if lv <= n][-1]
    return Level(n, title, total, xp_for_level(n), xp_for_level(n + 1))


def chore_days(db: Session, kid_id: int, today: date) -> dict[date, bool]:
    """chore day -> every instance that day is done/submitted (past and today only)."""
    start = datetime.combine(today - timedelta(days=LOOKBACK_DAYS), datetime.min.time())
    rows = (
        db.query(Task.due_date, Task.status)
        .filter(
            is_chore_filter(),
            Task.is_recurring.is_(False),
            kid_chores_filter(kid_id),
            Task.status != TaskStatus.CANCELLED,
            Task.due_date >= start,
        )
        .all()
    )
    days: dict[date, bool] = {}
    for due, status in rows:
        d = due.date()
        if d <= today:
            days[d] = days.get(d, True) and status in _DONE
    return days


def streak(db: Session, kid_id: int, today: date) -> Streak:
    days = chore_days(db, kid_id, today)
    runs, run, longest = [], 0, 0
    for d in sorted(days):
        if days[d]:
            run += 1
            longest = max(longest, run)
        elif d == today:
            continue  # still open: pauses, never breaks
        else:
            if run:
                runs.append(run)
            run = 0
    return Streak(run, longest, runs)


def progress(db: Session, kid: User, fam: FamilySettings) -> dict:
    lv = level_for(xp(db, kid.id))
    today = current_chore_day(fam, datetime.now(UTC))
    return {
        "level": lv.level,
        "title": lv.title,
        "xp": lv.xp,
        "floor": lv.floor,
        "next": lv.next,
        "streak": streak(db, kid.id, today).current,
        "flair": equipped(kid),
    }


def leaderboard(db: Session, fam: FamilySettings, now_utc: datetime) -> dict:
    """Weekly (Mon 00:00 family-local) XP-style score for every kid; ties share a rank."""
    tz = ZoneInfo(fam.timezone)
    monday = local_now(fam.timezone, now_utc).date()
    monday -= timedelta(days=monday.weekday())

    def utc(d: date) -> datetime:
        return (
            datetime.combine(d, datetime.min.time(), tzinfo=tz).astimezone(UTC).replace(tzinfo=None)
        )

    scores = dict(
        db.query(Points.user_id, func.sum(Points.amount))
        .filter(
            Points.amount > 0,
            Points.points_type.notin_([PointsType.REDEMPTION, PointsType.TRANSFER]),
            Points.created_at >= utc(monday),
            Points.created_at < utc(monday + timedelta(days=7)),
        )
        .group_by(Points.user_id)
        .all()
    )
    rows = []
    for k in db.query(User).filter(User.role == UserRole.KID, User.is_active):
        lv = level_for(xp(db, k.id))
        rows.append(
            {
                "kid_id": k.id,
                "name": k.full_name or k.username,
                "avatar": k.avatar,
                "score": int(scores.get(k.id) or 0),
                "level": lv.level,
                "title": lv.title,
                "flair": equipped(k),
            }
        )
    rows.sort(key=lambda r: (-r["score"], r["name"]))
    for i, r in enumerate(rows):
        same = i and r["score"] == rows[i - 1]["score"]
        r["rank"] = rows[i - 1]["rank"] if same else i + 1
    return {"week_start": monday.isoformat(), "rows": rows}
