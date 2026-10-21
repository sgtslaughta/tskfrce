"""Tiered badges: built-in catalog, metrics, awarding and the celebration feed."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.flair.catalog import CATALOG as FLAIR
from app.flair.catalog import FlairItem, equipped
from app.lock.reset import current_chore_day, is_chore_filter, kid_chores_filter
from app.models.badge import BadgeAward, CustomBadge
from app.models.family import FamilySettings
from app.models.reward import Redemption
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.services import economy, progression

TIERS = ("copper", "silver", "gold", "platinum", "mega-diamond")


@dataclass(frozen=True)
class BadgeDef:
    key: str
    name: str
    icon: str
    description: str
    metric: str
    thresholds: tuple[int, ...]


def _d(key, name, icon, desc, metric, *thresholds) -> tuple[str, BadgeDef]:
    return key, BadgeDef(key, name, icon, desc, metric, thresholds)


# fmt: off
CATALOG: dict[str, BadgeDef] = dict(
    [
        _d("first_blood", "First Blood", "🩸", "Get a chore approved.", "approved", 1),
        _d("task_master", "Task Master", "📋", "Chores approved.", "approved", 20, 50, 100, 250, 500),
        _d("workhorse", "Workhorse", "🐴", "Chores approved in one week.", "best_week", 10, 15, 20, 30, 40),
        _d("on_fire", "On Fire", "🔥", "Days in a row, all chores done.", "longest_streak", 7, 30, 60, 100, 365),
        _d("comeback_kid", "Comeback Kid", "💪", "7-day streaks after a slip.", "comebacks", 1, 3, 5, 10, 20),
        _d("weekend_warrior", "Weekend Warrior", "🛡️", "Weekends in a row, all done.", "weekend_run", 4, 8, 12, 26, 52),
        _d("variety_pack", "Variety Pack", "🎲", "Different chores approved.", "variety", 10, 20, 30, 40, 50),
        _d("early_bird", "Early Bird", "🐦", "Chores done an hour early.", "early", 10, 25, 50, 100, 250),
        _d("speedrunner", "Speedrunner", "⚡", "Chores done within 15 minutes.", "speed", 1, 5, 10, 25, 50),
        _d("clutch", "Clutch", "🎯", "Chores done in the last 10 minutes.", "clutch", 1, 5, 10, 25, 50),
        _d("never_late", "Never Late", "⏰", "Deadline chores in a row, on time.", "on_time_run", 30, 60, 100, 200, 365),
        _d("stacking", "Stacking", "🏔️", "Lifetime XP.", "xp", 1000, 2500, 5000, 10000, 25000),
        _d("saver", "Saver", "🏦", "Points saved up.", "balance", 500, 1000, 2000, 5000, 10000),
        _d("big_spender", "Big Spender", "🛍️", "Requests approved.", "redemptions", 1, 5, 10, 25, 50),
        _d("goal_getter", "Goal Getter", "🏆", "Rewards earned.", "rewards", 1, 3, 5, 10, 20),
        _d("patience_pays", "Patience Pays", "🧘", "Big rewards (2000+ points).", "big_rewards", 1, 2, 3, 5, 10),
        _d("time_lord", "Time Lord", "📱", "Screen time earned.", "screen_redemptions", 10, 25, 50, 100, 250),
        _d("drip", "Drip", "💧", "Equip flair from the Locker.", "slots_equipped", 1),
    ]
)
# fmt: on

BIG_REWARD = 2000


def _longest_run(flags) -> int:
    best = run = 0
    for ok in flags:
        run = run + 1 if ok else 0
        best = max(best, run)
    return best


def _weekend_run(days: dict[date, bool]) -> int:
    """Longest run of consecutive weekends fully done; weekends without chores are skipped."""
    weekends: dict[date, bool] = {}
    for d, ok in days.items():
        if d.weekday() >= 5:
            sat = d - timedelta(days=d.weekday() - 5)
            weekends[sat] = weekends.get(sat, True) and ok
    return _longest_run(weekends[w] for w in sorted(weekends))


def _task_metrics(db: Session, kid: User, fam: FamilySettings) -> dict[str, int]:
    rows = (
        db.query(Task)
        .filter(
            is_chore_filter(),
            Task.is_recurring.is_(False),
            kid_chores_filter(kid.id),
            Task.status == TaskStatus.DONE,
            Task.approved_by_id.isnot(None),
        )
        .order_by(Task.due_date, Task.id)
        .all()
    )
    rows = [t for t in rows if kid.id in economy._recipients(t)]
    weeks: dict[tuple, int] = {}
    defs, early, speed, clutch, on_time = set(), 0, 0, 0, []
    for t in rows:
        if t.due_date:
            wk = t.due_date.isocalendar()[:2]
            weeks[wk] = weeks.get(wk, 0) + 1
        if t.parent_task_id:
            defs.add(t.parent_task_id)
        done = t.submitted_for_approval_at
        if done is None:
            continue
        if t.created_at and done - t.created_at <= timedelta(minutes=15):
            speed += 1
        due = (t.recurrence_pattern or {}).get("due_time")
        dl = economy.deadline_utc(fam, t.due_date.date(), due) if t.due_date else None
        if dl is None:
            continue
        on_time.append(done <= dl)
        early += done <= dl - timedelta(minutes=60)
        clutch += dl - timedelta(minutes=10) <= done <= dl
    return {
        "approved": len(rows),
        "best_week": max(weeks.values(), default=0),
        "variety": len(defs),
        "early": early,
        "speed": speed,
        "clutch": clutch,
        "on_time_run": _longest_run(on_time),
    }


def metrics(db: Session, kid: User, fam: FamilySettings) -> dict[str, int]:
    today = current_chore_day(fam, datetime.now(UTC))
    days = progression.chore_days(db, kid.id, today)
    st = progression.streak(db, kid.id, today)
    all_runs = [*st.runs, st.current] if st.current else st.runs
    reds = db.query(Redemption).filter(Redemption.kid_id == kid.id, Redemption.status == "approved")
    reds = reds.all()
    rewards = [r for r in reds if r.kind == "reward"]
    return {
        **_task_metrics(db, kid, fam),
        "longest_streak": st.longest,
        "comebacks": sum(1 for n in all_runs[1:] if n >= 7),
        "weekend_run": _weekend_run(days),
        "xp": progression.xp(db, kid.id),
        "balance": economy.balance(db, kid.id),
        "redemptions": len(reds),
        "rewards": len(rewards),
        "big_rewards": sum(1 for r in rewards if r.cost >= BIG_REWARD),
        "screen_redemptions": len(reds) - len(rewards),
        "slots_equipped": sum(v is not None for v in equipped(kid).values()),
    }


def check_badges(db: Session, kid: User, fam: FamilySettings) -> list[BadgeAward]:
    """Upsert newly reached tiers (never lowers one). Caller commits."""
    db.flush()
    m = metrics(db, kid, fam)
    have = {a.badge_key: a for a in db.query(BadgeAward).filter(BadgeAward.kid_id == kid.id)}
    won = []
    for b in CATALOG.values():
        tier = sum(m[b.metric] >= t for t in b.thresholds)
        a = have.get(b.key)
        if tier == 0 or (a and a.tier >= tier):
            continue
        if a is None:
            a = BadgeAward(kid_id=kid.id, badge_key=b.key, tier=tier)
            db.add(a)
        a.tier, a.seen_by_kid, a.earned_at = tier, False, datetime.utcnow()
        won.append(a)
    db.flush()
    return won


def check_for_task(db: Session, task: Task, fam: FamilySettings) -> None:
    """Re-check badges for every kid paid for an approved chore."""
    for kid_id in economy._recipients(task):
        kid = db.get(User, kid_id)
        if kid:
            check_badges(db, kid, fam)


def badge_info(db: Session, key: str, tier: int) -> dict:
    if key.startswith("custom:"):
        c = db.get(CustomBadge, int(key[7:]))
        name, icon, desc = (c.name, c.icon, c.description) if c else ("Badge", "🏅", "")
    else:
        b = CATALOG[key]
        name, icon, desc = b.name, b.icon, b.description
    return {
        "key": key,
        "name": name,
        "icon": icon,
        "description": desc,
        "tier": tier,
        "tier_name": TIERS[tier - 1],
        "custom": key.startswith("custom:"),
    }


def badges_for(db: Session, kid_id: int) -> list[dict]:
    rows = db.query(BadgeAward).filter(BadgeAward.kid_id == kid_id).order_by(BadgeAward.id)
    return [badge_info(db, a.badge_key, a.tier) for a in rows]


def give_custom(db: Session, kid: User, badge: CustomBadge) -> BadgeAward:
    """Parent award: that kid's tier +1 (409 at max). Caller commits."""
    key = f"custom:{badge.id}"
    a = db.query(BadgeAward).filter_by(kid_id=kid.id, badge_key=key).first()
    if a is None:
        a = BadgeAward(kid_id=kid.id, badge_key=key, tier=0)
        db.add(a)
    if a.tier >= len(TIERS):
        raise HTTPException(409, "Already at mega-diamond.")
    a.tier, a.seen_by_kid, a.earned_at = a.tier + 1, False, datetime.utcnow()
    db.flush()
    return a


def _flair_label(f: FlairItem) -> str:
    return f.name if f.slot == "emblem" else f"{f.name} {f.slot}"


def celebrations(db: Session, kid: User) -> list[dict]:
    """Unseen moments, oldest first: rewards, badge tiers, then a level-up."""
    items: list[tuple[datetime, dict]] = []
    for r in db.query(Redemption).filter(
        Redemption.kid_id == kid.id,
        Redemption.status == "approved",
        Redemption.seen_by_kid.is_(False),
    ):
        from app.api.rewards import redemption_name

        reward = r.kind == "reward"
        items.append(
            (
                r.decided_at or r.created_at,
                {
                    "key": f"r:{r.id}",
                    "kind": r.kind,
                    "title": redemption_name(db, r),
                    "detail": f"{r.cost} points",
                    "size": "big" if reward else "small",
                },
            )
        )
    for a in db.query(BadgeAward).filter(
        BadgeAward.kid_id == kid.id, BadgeAward.seen_by_kid.is_(False)
    ):
        info = badge_info(db, a.badge_key, a.tier)
        items.append(
            (
                a.earned_at,
                {
                    "key": f"b:{a.id}",
                    "kind": "badge",
                    "title": f"{info['icon']} {info['name']}",
                    "detail": info["tier_name"],
                    "size": "big" if a.tier >= 3 else "small",
                },
            )
        )
    items.sort(key=lambda x: x[0])
    out = [i for _, i in items]
    lv = progression.level_for(progression.xp(db, kid.id))
    if lv.level > kid.celebrated_level:
        new = [f for f in FLAIR if kid.celebrated_level < f.unlock_level <= lv.level]
        out.append(
            {
                "key": f"l:{lv.level}",
                "kind": "level",
                "title": f"Level {lv.level} · {lv.title}",
                "detail": f"New flair: {', '.join(_flair_label(f) for f in new)}"
                if new
                else lv.title,
                "unlocked": [
                    {"id": f.id, "label": _flair_label(f), "emblem": f.emblem} for f in new
                ],
                "size": "big",
            }
        )
    return out
