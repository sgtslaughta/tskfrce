"""Turn rules + DB rows into the list of MACs that must be offline."""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.lock.reset import chore_counts, current_chore_day, reset_due, run_reset
from app.lock.rules import DeviceFacts, is_online
from app.lock.schedule import Window, local_now
from app.models.family import FamilySettings, get_family
from app.models.lock import Device, Override, TimeWindow


def _naive_utc(now: datetime) -> datetime:
    if now.tzinfo is not None:
        now = now.astimezone(UTC).replace(tzinfo=None)
    return now


def _aware_utc(now: datetime) -> datetime:
    return now.replace(tzinfo=UTC) if now.tzinfo is None else now


def _windows(db: Session, **target) -> tuple[list[Window], list[Window]]:
    rows = db.query(TimeWindow).filter_by(**target).all()
    allowed = [Window.from_row(r) for r in rows if r.kind == "allowed"]
    free = [Window.from_row(r) for r in rows if r.kind == "free"]
    return allowed, free


def device_facts(
    db: Session, device: Device, fam: FamilySettings, now_utc: datetime
) -> DeviceFacts:
    now = _naive_utc(now_utc)
    day = current_chore_day(fam, _aware_utc(now_utc))
    overrides = (
        db.query(Override)
        .filter(Override.device_id == device.id)
        .order_by(Override.created_at.desc(), Override.id.desc())
        .all()
    )
    live = [o for o in overrides if o.expires_at is None or o.expires_at > now]
    manual = [o for o in live if o.source == "manual"]
    allowed_sets: list[tuple[Window, ...]] = []
    free: list[Window] = []
    targets = [{"kid_id": o.id} for o in device.owners] + [
        {"group_id": g.id} for g in device.groups
    ]
    for t in targets:
        a, f = _windows(db, **t)
        if a:
            allowed_sets.append(tuple(a))
        free.extend(f)
    return DeviceFacts(
        status=device.status,
        owners=tuple(chore_counts(db, o.id, day) for o in device.owners),
        allowed_sets=tuple(allowed_sets),
        free=tuple(free),
        override=manual[0].action if manual else None,
        bonus_active=any(o.source == "bonus" for o in live),
        new_devices_blocked=fam.new_devices_blocked,
        points_unlock_early=fam.points_unlock_early,
    )


def desired_blocked(db: Session, now_utc: datetime) -> list[str]:
    fam = get_family(db)
    now_local = local_now(fam.timezone, _aware_utc(now_utc))
    return sorted(
        d.mac
        for d in db.query(Device).all()
        if not is_online(device_facts(db, d, fam, now_utc), now_local)
    )


def tick(db: Session, now_utc: datetime) -> list[str]:
    fam = get_family(db)
    now_local = local_now(fam.timezone, _aware_utc(now_utc))
    if reset_due(fam, now_local):
        run_reset(db, now_local.date())
    db.query(Override).filter(
        Override.expires_at.isnot(None), Override.expires_at <= _naive_utc(now_utc)
    ).delete()
    db.commit()
    return desired_blocked(db, now_utc)
