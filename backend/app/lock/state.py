"""Turn rules + DB rows into the list of MACs that must be offline."""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.lock import activity, hours
from app.lock.reset import current_chore_day, reset_due
from app.lock.rules import DeviceFacts, OwnerChores, is_online
from app.lock.schedule import local_now
from app.models.family import FamilySettings, get_family
from app.models.lock import Device, Override
from app.services import chores


def _naive_utc(now: datetime) -> datetime:
    if now.tzinfo is not None:
        now = now.astimezone(UTC).replace(tzinfo=None)
    return now


def _aware_utc(now: datetime) -> datetime:
    return now.replace(tzinfo=UTC) if now.tzinfo is None else now


class Prefetch:
    """Overrides and hour rules for many devices in a few queries (avoids N+1 in list endpoints).

    `counts` maps kid id -> (approved, total) for the chore day; pass it when the caller
    already holds today's runs, otherwise each owner is counted on demand.
    """

    def __init__(self, db: Session, devices: list[Device], counts: dict | None = None):
        ids = {d.id for d in devices}
        self.overrides: dict[int, list[Override]] = {i: [] for i in ids}
        for o in (
            db.query(Override)
            .filter(Override.device_id.in_(ids))
            .order_by(Override.created_at.desc(), Override.id.desc())
        ):
            self.overrides[o.device_id].append(o)
        self.rules = hours.load(db)
        self.counts = counts or {}


def device_facts(
    db: Session, device: Device, fam: FamilySettings, now_utc: datetime, pre: Prefetch | None = None
) -> DeviceFacts:
    now = _naive_utc(now_utc)
    day = current_chore_day(fam, _aware_utc(now_utc))
    overrides = (
        pre.overrides.get(device.id, [])
        if pre
        else db.query(Override)
        .filter(Override.device_id == device.id)
        .order_by(Override.created_at.desc(), Override.id.desc())
        .all()
    )
    live = [o for o in overrides if o.expires_at is None or o.expires_at > now]
    manual = [o for o in live if o.source == "manual"]
    r = hours.resolve(
        pre.rules if pre else hours.load(db),
        {o.id for o in device.owners},
        {g.id for g in device.groups},
        local_now(fam.timezone, _aware_utc(now_utc)).date(),
    )
    return DeviceFacts(
        status=device.status,
        owners=tuple(
            OwnerChores(t, a)
            for a, t in (
                pre.counts[o.id] if pre and o.id in pre.counts else chores.counts(db, o.id, day)
                for o in device.owners
            )
        ),
        allowed_sets=r.allowed_sets,
        free=r.free,
        off=r.off,
        exempt=device.exempt,
        chores_apply=fam.chores_lock and all(g.chore_lock for g in device.groups),
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
        chores.run_reset(db, now_local.date())
    now = _naive_utc(now_utc)
    db.query(Override).filter(Override.expires_at.isnot(None), Override.expires_at <= now).delete()
    db.commit()
    devices = db.query(Device).all()
    pre = Prefetch(db, devices)
    rows = [(d, device_facts(db, d, fam, now_utc, pre)) for d in devices]
    blocked = sorted(d.mac for d, f in rows if not is_online(f, now_local))
    activity.record_transitions(db, rows, now, now_local)
    activity.prune(db, now)
    db.commit()
    return blocked
