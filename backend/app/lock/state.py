"""Turn rules + DB rows into the list of MACs that must be offline."""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.lock.reset import current_chore_day, reset_due
from app.lock.rules import DeviceFacts, OwnerChores, is_online
from app.lock.schedule import Window, local_now
from app.models.family import FamilySettings, get_family
from app.models.lock import Device, Override, TimeWindow
from app.services import chores


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


class Prefetch:
    """Overrides and windows for many devices in two queries (avoids N+1 in list endpoints).

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
        self.windows: dict[tuple[str, int], list[TimeWindow]] = {}
        for w in db.query(TimeWindow).all():
            key = ("kid_id", w.kid_id) if w.kid_id is not None else ("group_id", w.group_id)
            self.windows.setdefault(key, []).append(w)
        self.counts = counts or {}


def _split(rows) -> tuple[list[Window], list[Window]]:
    return (
        [Window.from_row(r) for r in rows if r.kind == "allowed"],
        [Window.from_row(r) for r in rows if r.kind == "free"],
    )


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
    allowed_sets: list[tuple[Window, ...]] = []
    free: list[Window] = []
    targets = [{"kid_id": o.id} for o in device.owners] + [
        {"group_id": g.id} for g in device.groups
    ]
    for t in targets:
        a, f = _split(pre.windows.get(next(iter(t.items())), [])) if pre else _windows(db, **t)
        if a:
            allowed_sets.append(tuple(a))
        free.extend(f)
    return DeviceFacts(
        status=device.status,
        owners=tuple(
            OwnerChores(t, a)
            for a, t in (
                pre.counts[o.id] if pre and o.id in pre.counts else chores.counts(db, o.id, day)
                for o in device.owners
            )
        ),
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
        chores.run_reset(db, now_local.date())
    db.query(Override).filter(
        Override.expires_at.isnot(None), Override.expires_at <= _naive_utc(now_utc)
    ).delete()
    db.commit()
    return desired_blocked(db, now_utc)
