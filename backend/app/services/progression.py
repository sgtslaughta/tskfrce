"""XP, levels and streaks, all derived from existing data (nothing stored)."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.flair.catalog import equipped_many
from app.lock.reset import current_chore_day
from app.lock.schedule import local_now
from app.models.chores import ChoreRun, run_kids
from app.models.family import FamilySettings
from app.models.points import Points, PointsType
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
_DONE = ("done", "submitted")


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


def totals_many(db: Session, kid_ids: list[int]) -> dict[int, tuple[int, int]]:
    """kid -> (lifetime xp, points balance) in one query."""
    earned = case(
        (
            (Points.amount > 0)
            & Points.points_type.notin_([PointsType.REDEMPTION, PointsType.TRANSFER]),
            Points.amount,
        ),
        else_=0,
    )
    rows = (
        db.query(Points.user_id, func.sum(earned), func.sum(Points.amount))
        .filter(Points.user_id.in_(kid_ids))
        .group_by(Points.user_id)
        .all()
    )
    got = {u: (int(x or 0), int(b or 0)) for u, x, b in rows}
    return {i: got.get(i, (0, 0)) for i in kid_ids}


def xp_many(db: Session, kid_ids: list[int]) -> dict[int, int]:
    return {i: x for i, (x, _) in totals_many(db, kid_ids).items()}


def xp_for_level(n: int) -> int:
    return round(50 * (n - 1) ** 1.6)


def level_for(total: int) -> Level:
    n = 1
    while xp_for_level(n + 1) <= total:
        n += 1
    title = [t for lv, t in TITLES if lv <= n][-1]
    return Level(n, title, total, xp_for_level(n), xp_for_level(n + 1))


def chore_days_many(db: Session, kid_ids: list[int], today: date) -> dict[int, dict[date, bool]]:
    """kid -> {chore day -> every instance that day is done/submitted (past and today only)}."""
    start = today - timedelta(days=LOOKBACK_DAYS)
    out: dict[int, dict[date, bool]] = {i: {} for i in kid_ids}
    kid = func.coalesce(ChoreRun.kid_id, run_kids.c.kid_id)
    rows = (
        db.query(kid, ChoreRun.day, ChoreRun.status)
        .outerjoin(run_kids, run_kids.c.run_id == ChoreRun.id)
        .filter(
            kid.in_(kid_ids),
            ChoreRun.status.notin_(["cancelled", "skipped"]),
            ChoreRun.day >= start,
        )
        .all()
    )
    for kid_id, d, status in rows:
        if d <= today:
            days = out[kid_id]
            days[d] = days.get(d, True) and status in _DONE
    return out


def chore_days(db: Session, kid_id: int, today: date) -> dict[date, bool]:
    return chore_days_many(db, [kid_id], today)[kid_id]


def streak_of(days: dict[date, bool], today: date) -> Streak:
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


def streak(db: Session, kid_id: int, today: date) -> Streak:
    return streak_of(chore_days(db, kid_id, today), today)


def progress(db: Session, kid: User, fam: FamilySettings, balances: dict | None = None) -> dict:
    return progress_many(db, [kid], fam, balances)[kid.id]


def progress_many(
    db: Session, kids: list[User], fam: FamilySettings, balances: dict | None = None
) -> dict[int, dict]:
    """Level, streak and flair for many kids in a fixed number of queries.

    Pass a dict as `balances` to also receive each kid's points balance (same query).
    """
    ids = [k.id for k in kids]
    today = current_chore_day(fam, datetime.now(UTC))
    totals = totals_many(db, ids)
    if balances is not None:
        balances.update({i: b for i, (_, b) in totals.items()})
    days = chore_days_many(db, ids, today)
    flair = equipped_many(db, ids)
    out = {}
    for i in ids:
        lv = level_for(totals[i][0])
        out[i] = {
            "level": lv.level,
            "title": lv.title,
            "xp": lv.xp,
            "floor": lv.floor,
            "next": lv.next,
            "streak": streak_of(days[i], today).current,
            "flair": flair[i],
        }
    return out


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
    kids = db.query(User).filter(User.role == UserRole.KID, User.is_active).all()
    ids = [k.id for k in kids]
    totals, flair = xp_many(db, ids), equipped_many(db, ids)
    for k in kids:
        lv = level_for(totals[k.id])
        rows.append(
            {
                "kid_id": k.id,
                "name": k.full_name or k.username,
                "avatar": k.avatar,
                "score": int(scores.get(k.id) or 0),
                "level": lv.level,
                "title": lv.title,
                "flair": flair[k.id],
            }
        )
    rows.sort(key=lambda r: (-r["score"], r["name"]))
    for i, r in enumerate(rows):
        same = i and r["score"] == rows[i - 1]["score"]
        r["rank"] = rows[i - 1]["rank"] if same else i + 1
    return {"week_start": monday.isoformat(), "rows": rows}
