"""Device activity log: lock history, left-Wi-Fi alerts, pruning. Times are naive UTC; callers commit."""

from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.lock.rules import DeviceFacts, block_reason, open_reason
from app.models.device_activity import DeviceEvent, DevicePresence
from app.models.lock import Device, Override

SLOT = timedelta(minutes=10)
_last_prune: datetime | None = None


def log(
    db: Session,
    device_id: int,
    kind: str,
    now: datetime,
    *,
    merge_minutes: int | None = None,
    count: int = 1,
    **fields,
) -> DeviceEvent:
    """Add an event, or fold it into the newest same-kind one seen within `merge_minutes`."""
    if merge_minutes:
        q = db.query(DeviceEvent).filter(
            DeviceEvent.device_id == device_id,
            DeviceEvent.kind == kind,
            func.coalesce(DeviceEvent.last_at, DeviceEvent.at)
            >= now - timedelta(minutes=merge_minutes),
        )
        if fields.get("kid_id") is not None:
            q = q.filter(DeviceEvent.kid_id == fields["kid_id"])
        found = q.order_by(DeviceEvent.at.desc(), DeviceEvent.id.desc()).first()
        if found:
            found.count += count
            found.last_at = now
            return found
    ev = DeviceEvent(
        device_id=device_id,
        kind=kind,
        at=now,
        last_at=now if merge_minutes else None,
        count=count,
        **fields,
    )
    db.add(ev)
    db.flush()
    return ev


def _manual_fields(db: Session, device_id: int, now: datetime) -> dict:
    o = (
        db.query(Override)
        .filter(
            Override.device_id == device_id,
            Override.source == "manual",
            (Override.expires_at.is_(None)) | (Override.expires_at > now),
        )
        .order_by(Override.created_at.desc(), Override.id.desc())
        .first()
    )
    if o is None:
        return {}
    minutes = round((o.expires_at - o.created_at).total_seconds() / 60) if o.expires_at else None
    return {"by_id": o.created_by_id, "minutes": minutes}


def record_transitions(
    db: Session, rows: list[tuple[Device, DeviceFacts]], now: datetime, now_local: datetime
) -> None:
    for d, f in rows:
        reason = block_reason(f, now_local)
        if reason and d.blocked_since is None:
            d.blocked_since = now
            extra = _manual_fields(db, d.id, now) if reason == "manual" else {}
            log(db, d.id, "locked", now, reason=reason, **extra)
        elif reason is None and d.blocked_since is not None:
            d.blocked_since = None
            why = open_reason(f, now_local)
            extra = _manual_fields(db, d.id, now) if why == "manual" else {}
            log(db, d.id, "unlocked", now, reason=why, **extra)
        elif reason and f.status == "assigned":
            _left_wifi(db, d, now)


def _left_wifi(db: Session, d: Device, now: datetime) -> None:
    b, seen = d.blocked_since, d.last_seen
    five = timedelta(minutes=5)
    if seen is None or now < b + five or not (b - five <= seen <= b + timedelta(minutes=2)):
        return
    if (
        db.query(DeviceEvent.id)
        .filter(DeviceEvent.device_id == d.id, DeviceEvent.kind == "left_wifi", DeviceEvent.at >= b)
        .first()
    ):
        return
    log(db, d.id, "left_wifi", now, minutes=max(0, round((seen - b).total_seconds() / 60)))


def prune(db: Session, now: datetime) -> None:
    global _last_prune
    if _last_prune is not None and now - _last_prune < timedelta(hours=1):
        return
    _last_prune = now
    db.query(DevicePresence).filter(DevicePresence.slot < now - timedelta(days=8)).delete()
    db.query(DeviceEvent).filter(DeviceEvent.at < now - timedelta(days=30)).delete()
