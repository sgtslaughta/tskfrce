"""Screen-time purchase rules: daily max, per-kid limits, allowed hours."""

from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.lock.reset import current_chore_day
from app.lock.rules import in_allowed, in_off
from app.lock.schedule import local_now
from app.lock.state import device_facts
from app.models.family import FamilySettings, get_family
from app.models.reward import Redemption
from app.models.screen_time import ScreenTimeLimit
from app.models.user import User
from app.services import economy


def day_start_utc(fam: FamilySettings, now_utc: datetime) -> datetime:
    """Naive UTC start of the current chore day (its reset time)."""
    return economy.deadline_utc(fam, current_chore_day(fam, _aware(now_utc)), fam.reset_time)


def _aware(now: datetime) -> datetime:
    return now.replace(tzinfo=UTC) if now.tzinfo is None else now


def bought_today(db: Session, fam: FamilySettings, kid_ids: list[int], now_utc: datetime):
    """Minutes bought (pending + approved) since today's reset, per kid."""
    rows = (
        db.query(Redemption.kid_id, func.coalesce(func.sum(Redemption.minutes), 0))
        .filter(
            Redemption.kid_id.in_(kid_ids),
            Redemption.kind == "screen_time",
            Redemption.status.in_(("pending", "approved")),
            Redemption.created_at >= day_start_utc(fam, now_utc),
        )
        .group_by(Redemption.kid_id)
        .all()
    )
    out = {k: 0 for k in kid_ids}
    out.update({k: int(m) for k, m in rows})
    return out


def limit_for(db: Session, fam: FamilySettings, kid_id: int) -> tuple[int | None, int | None]:
    """(effective max minutes per day, min points) for a kid."""
    row = db.get(ScreenTimeLimit, kid_id)
    caps = [m for m in (fam.screen_max_minutes, row.max_minutes if row else None) if m]
    return (min(caps) if caps else None), (row.min_points if row else None)


def in_allowed_hours(db: Session, kid: User, now_utc: datetime) -> bool:
    if not kid.devices:
        return True
    fam = get_family(db)
    now_local = local_now(fam.timezone, now_utc)
    return any(in_allowed(device_facts(db, d, fam, now_utc), now_local) for d in kid.devices)


def all_in_off_window(db: Session, kid: User, now_utc: datetime) -> bool:
    """Every device of the kid is inside an internet-off window (bonus can't open those)."""
    if not kid.devices:
        return False
    fam = get_family(db)
    now_local = local_now(fam.timezone, now_utc)
    return all(in_off(device_facts(db, d, fam, now_utc), now_local) for d in kid.devices)


def check(db: Session, fam: FamilySettings, kid: User, minutes: int, now_utc: datetime) -> None:
    cap, min_points = limit_for(db, fam, kid.id)
    if min_points and economy.balance(db, kid.id) < min_points:
        raise HTTPException(409, f"You can buy screen time once you have {min_points} points.")
    if cap is not None:
        left = cap - bought_today(db, fam, [kid.id], now_utc)[kid.id]
        if left <= 0:
            raise HTTPException(409, "You've had all your screen time for today.")
        if minutes > left:
            raise HTTPException(
                409, f"That's over today's limit. You can buy {left} more minutes today."
            )
    if fam.screen_only_allowed_hours and not in_allowed_hours(db, kid, now_utc):
        raise HTTPException(409, "Screen time only works during your allowed hours.")
    if not fam.screen_only_allowed_hours and all_in_off_window(db, kid, now_utc):
        raise HTTPException(409, "Screen time can't turn the internet on during off hours.")
