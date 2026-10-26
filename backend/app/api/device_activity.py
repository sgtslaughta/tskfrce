"""Parent API: device activity feed, alert actions, lock all of a kid's devices."""

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.api.devices import _device, device_out, purge_device
from app.lock import activity
from app.lock.loop import trigger
from app.lock.overrides import set_override
from app.models.device_activity import ALERT_KINDS, DeviceEvent, DevicePresence
from app.models.family import get_family
from app.models.lock import Device
from app.models.user import User, UserRole
from app.schemas.lock import OverrideIn, utc_z

router = APIRouter(prefix="/api/v1", tags=["devices"], dependencies=[Depends(require_parent)])

_COUNTED = {"locked_try": "locked_tries", "outside_hours": "outside_hours", "sign_in": "wrong_pins"}


def _name(u: User | None) -> str | None:
    return (u.full_name or u.username) if u else None


def _event_out(e: DeviceEvent, users: dict, devices: dict) -> dict:
    other = devices.get(e.other_device_id)
    return {
        "id": e.id,
        "kind": e.kind,
        "at": utc_z(e.at),
        "last_at": utc_z(e.last_at),
        "count": e.count,
        "reason": e.reason,
        "kid_id": e.kid_id,
        "kid_name": _name(users.get(e.kid_id)),
        "by_name": _name(users.get(e.by_id)),
        "other_device_id": e.other_device_id,
        "other_device_name": other.name if other else None,
        "minutes": e.minutes,
        "detail": e.detail,
        "reviewed": e.reviewed_at is not None,
    }


def _events(db: Session, did: int, kinds, since: datetime | None, limit: int) -> list[DeviceEvent]:
    q = db.query(DeviceEvent).filter(DeviceEvent.device_id == did, DeviceEvent.kind.in_(kinds))
    if since:
        q = q.filter(DeviceEvent.at >= since)
    return q.order_by(DeviceEvent.at.desc(), DeviceEvent.id.desc()).limit(limit).all()


def _days(db: Session, did: int, tz_name: str, now: datetime) -> list[dict]:
    tz = ZoneInfo(tz_name)
    today = now.replace(tzinfo=UTC).astimezone(tz).date()
    dates = [today - timedelta(days=i) for i in range(7)]
    start = datetime.combine(dates[-1], datetime.min.time(), tzinfo=tz)
    rows = (
        db.query(DevicePresence)
        .filter(
            DevicePresence.device_id == did,
            DevicePresence.slot >= start.astimezone(UTC).replace(tzinfo=None),
        )
        .all()
    )
    slots = {d: ["."] * 144 for d in dates}
    for r in rows:
        loc = r.slot.replace(tzinfo=UTC).astimezone(tz)
        if loc.date() in slots:
            slots[loc.date()][(loc.hour * 60 + loc.minute) // 10] = "l" if r.locked else "o"
    return [
        {
            "date": d.isoformat(),
            "slots": "".join(slots[d]),
            "online_minutes": 10 * slots[d].count("o"),
        }
        for d in dates
    ]


@router.get("/devices/{device_id}/activity")
def device_activity(device_id: int, db: Session = Depends(get_db)):
    _device(db, device_id)
    fam, now = get_family(db), datetime.now(UTC).replace(tzinfo=None)
    since = now - timedelta(days=7)
    counts = dict.fromkeys(("bypass", "locked_tries", "outside_hours", "wrong_pins"), 0)
    sums = (
        db.query(DeviceEvent.kind, func.sum(DeviceEvent.count), func.count())
        .filter(DeviceEvent.device_id == device_id, DeviceEvent.at >= since)
        .group_by(DeviceEvent.kind)
    )
    for kind, total, n in sums:
        if kind == "bypass":
            counts["bypass"] = n
        elif kind in _COUNTED:
            counts[_COUNTED[kind]] = int(total or 0)
    feed = _events(db, device_id, ALERT_KINDS, since, 50)
    history = _events(db, device_id, ("locked", "unlocked"), None, 20)
    uids = {i for e in feed + history for i in (e.kid_id, e.by_id) if i}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(uids))} if uids else {}
    dids = {e.other_device_id for e in feed + history if e.other_device_id}
    devs = {d.id: d for d in db.query(Device).filter(Device.id.in_(dids))} if dids else {}
    return {
        "counts": counts,
        "events": [_event_out(e, users, devs) for e in feed],
        "history": [_event_out(e, users, devs) for e in history],
        "days": _days(db, device_id, fam.timezone, now),
    }


def _event(db: Session, device_id: int, event_id: int) -> DeviceEvent:
    e = db.get(DeviceEvent, event_id)
    if e is None or e.device_id != device_id:
        raise HTTPException(404, "That alert doesn't exist. Refresh and try again.")
    return e


@router.post("/devices/{device_id}/events/{event_id}/ok")
def event_ok(device_id: int, event_id: int, db: Session = Depends(get_db)):
    e = _event(db, device_id, event_id)
    e.reviewed_at = e.reviewed_at or datetime.now(UTC).replace(tzinfo=None)
    db.commit()
    return {"ok": True}


@router.post("/devices/{device_id}/events/{event_id}/merge")
def event_merge(device_id: int, event_id: int, db: Session = Depends(get_db)):
    d = _device(db, device_id)
    e = _event(db, device_id, event_id)
    other = db.get(Device, e.other_device_id) if e.other_device_id else None
    if e.kind != "new_address" or other is None or other.id == d.id:
        raise HTTPException(409, "This alert can't merge devices.")
    addr = (other.mac, other.ip, list(other.ipv6), other.hostname, other.last_seen)
    purge_device(db, other)
    db.flush()  # frees the unique MAC
    d.mac, d.ip, d.ipv6, d.hostname, d.last_seen = addr
    e.reviewed_at = datetime.now(UTC).replace(tzinfo=None)
    db.commit()
    trigger()
    now = datetime.now(UTC)
    stats = activity.device_stats(db, now, [d.id])
    return device_out(db, d, get_family(db), now, addresses=True, stats=stats)


@router.post("/kids/{kid_id}/override")
def kid_override(
    kid_id: int,
    body: OverrideIn,
    db: Session = Depends(get_db),
    parent: User = Depends(require_parent),
):
    kid = db.get(User, kid_id)
    if kid is None or kid.role != UserRole.KID:
        raise HTTPException(404, "That kid doesn't exist. Pick a kid from the list.")
    ids = [d.id for d in kid.devices]
    if not ids:
        raise HTTPException(409, f"{_name(kid)} has no devices yet.")
    set_override(db, ids, body.action, body.minutes, parent.id)
    db.commit()
    trigger()
    return {"ok": True, "devices": len(ids)}
