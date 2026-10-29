"""Parent badge views: per-kid tier overview and recent awards."""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.badge import BadgeAward, CustomBadge
from app.models.user import User
from app.schemas.lock import utc_z
from app.services.badges import CATALOG, TIERS

MAX_RECENT = 50


def overview(db: Session) -> list[dict]:
    """Every badge with the kids' tiers (tier >= 1 only): catalog, then active customs."""
    tiers: dict[str, dict[str, int]] = {}
    for a in db.query(BadgeAward).filter(BadgeAward.tier >= 1):
        key = a.badge_key if a.custom_badge_id is None else f"custom:{a.custom_badge_id}"
        tiers.setdefault(key, {})[str(a.kid_id)] = a.tier
    rows = [
        {
            "key": b.key,
            "name": b.name,
            "description": b.description,
            "icon": b.icon,
            "custom": False,
            "tiers": tiers.get(b.key, {}),
        }
        for b in CATALOG.values()
    ]
    for c in db.query(CustomBadge).filter(CustomBadge.active).order_by(CustomBadge.id):
        key = f"custom:{c.id}"
        rows.append(
            {
                "key": key,
                "name": c.name,
                "description": c.description,
                "icon": c.icon,
                "custom": True,
                "tiers": tiers.get(key, {}),
            }
        )
    return rows


# key -> (one, many) templates; {n} is the tier threshold. One-tier badges are plain text.
_REASONS = {
    "first_blood": "Got a chore approved",
    "drip": "Equipped flair from the Locker",
    "task_master": ("{n} chore approved", "{n} chores approved"),
    "workhorse": ("{n} chore approved in one week", "{n} chores approved in one week"),
    "on_fire": ("{n} day in a row, all chores done", "{n} days in a row, all chores done"),
    "comeback_kid": ("{n} 7-day streak after a slip", "{n} 7-day streaks after a slip"),
    "weekend_warrior": (
        "{n} weekend in a row, all done",
        "{n} weekends in a row, all done",
    ),
    "variety_pack": ("{n} different chore approved", "{n} different chores approved"),
    "early_bird": ("{n} chore done an hour early", "{n} chores done an hour early"),
    "speedrunner": ("{n} chore done within 15 minutes", "{n} chores done within 15 minutes"),
    "clutch": (
        "{n} chore done in the last 10 minutes",
        "{n} chores done in the last 10 minutes",
    ),
    "never_late": (
        "{n} deadline chore in a row, on time",
        "{n} deadline chores in a row, on time",
    ),
    "stacking": ("{n} XP earned", "{n} XP earned"),
    "saver": ("{n} point saved up", "{n} points saved up"),
    "big_spender": ("{n} request approved", "{n} requests approved"),
    "goal_getter": ("{n} reward earned", "{n} rewards earned"),
    "patience_pays": ("{n} big reward (2000+ points)", "{n} big rewards (2000+ points)"),
    "time_lord": ("{n} screen-time request approved", "{n} screen-time requests approved"),
}


def _reason(b, tier: int) -> str:
    """Why a built-in tier was earned: "7 days in a row, all chores done", "1 request approved"."""
    t = _REASONS[b.key]
    if isinstance(t, str):
        return t
    n = b.thresholds[tier - 1]
    return t[n != 1].format(n=n)


def recent(db: Session, days: int = 7) -> list[dict]:
    """Awards earned within `days`, newest first (max 50); built-in tiers and parent awards."""
    since = datetime.utcnow() - timedelta(days=days)
    awards = (
        db.query(BadgeAward)
        .filter(BadgeAward.earned_at >= since)
        .order_by(BadgeAward.earned_at.desc(), BadgeAward.id.desc())
        .limit(MAX_RECENT)
        .all()
    )
    custom_ids = {a.custom_badge_id for a in awards if a.custom_badge_id is not None}
    customs = (
        {c.id: c for c in db.query(CustomBadge).filter(CustomBadge.id.in_(custom_ids))}
        if custom_ids
        else {}
    )
    user_ids = {a.kid_id for a in awards} | {a.awarded_by_id for a in awards if a.awarded_by_id}
    names = (
        {i: n for i, n in db.query(User.id, User.full_name).filter(User.id.in_(user_ids))}
        if user_ids
        else {}
    )
    out = []
    for a in awards:
        if a.custom_badge_id is not None:
            c = customs.get(a.custom_badge_id)
            key, name, icon = f"custom:{a.custom_badge_id}", "Badge", "military_tech"
            reason = None
            if c:
                name, icon = c.name, c.icon
        else:
            b = CATALOG[a.badge_key]
            key, name, icon = b.key, b.name, b.icon
            reason = _reason(b, a.tier)
        out.append(
            {
                "id": a.id,
                "kid_id": a.kid_id,
                "kid_name": names.get(a.kid_id),
                "key": key,
                "name": name,
                "icon": icon,
                "custom": a.custom_badge_id is not None,
                "tier": a.tier,
                "tier_name": TIERS[a.tier - 1],
                "note": a.note,
                "reason": reason,
                "by_name": names.get(a.awarded_by_id),
                "earned_at": utc_z(a.earned_at),
            }
        )
    return out
