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


def _reason(b, tier: int) -> str:
    """Why a built-in tier was earned, from the catalog: "7 days in a row, all chores done"."""
    if len(b.thresholds) == 1:
        return b.description.rstrip(".")
    return f"{b.thresholds[tier - 1]} {b.description[0].lower()}{b.description[1:].rstrip('.')}"


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
