"""Parent API: devices and device groups."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db, require_parent
from app.lock import blocker_client
from app.lock.loop import trigger
from app.lock.overrides import clear_override, set_override
from app.lock.rules import is_online
from app.lock.schedule import local_now
from app.lock.state import Prefetch, device_facts
from app.models.family import FamilySettings, get_family
from app.models.hours import HourRuleTarget
from app.models.lock import Device, DeviceGroup, Override, device_group_members
from app.models.user import User, UserRole
from app.schemas.lock import DevicePatch, GroupIn, OverrideIn, utc_z

router = APIRouter(prefix="/api/v1", tags=["devices"], dependencies=[Depends(require_parent)])

# Box reports resistance every 15s and polls state every 30s; 3 missed beats = offline.
BLOCKER_STALE = timedelta(seconds=90)


def device_out(
    db: Session,
    d: Device,
    fam: FamilySettings,
    now: datetime,
    pre: Prefetch | None = None,
    addresses: bool = False,
) -> dict:
    """Device JSON; `now` is aware UTC. Pass `pre` when rendering many devices.

    `addresses` adds ip, ipv6, hostname, first_seen (the Network tab); Today skips them.
    """
    if pre:
        ov = next((o for o in pre.overrides[d.id] if o.source == "manual"), None)
    else:
        ov = (
            db.query(Override)
            .filter(Override.device_id == d.id, Override.source == "manual")
            .order_by(Override.created_at.desc(), Override.id.desc())
            .first()
        )
    if ov and ov.expires_at and ov.expires_at <= now.replace(tzinfo=None):
        ov = None
    online = is_online(device_facts(db, d, fam, now, pre), local_now(fam.timezone, now))
    # two or more kids share this device and someone can sign in without a PIN
    active_kids = [k for k in d.owners if k.role == UserRole.KID and k.is_active]
    needs_pins = len(active_kids) >= 2 and any(not k.pin_hash for k in active_kids)
    out = {
        "id": d.id,
        "name": d.name,
        "mac": d.mac,
        "vendor": d.vendor,
        "status": d.status,
        "owner_ids": sorted(o.id for o in d.owners),
        "group_ids": sorted(g.id for g in d.groups),
        "online": online,
        "override": {"action": ov.action, "expires_at": utc_z(ov.expires_at)} if ov else None,
        "last_seen": utc_z(d.last_seen),
        "resisting": d.resisting_since is not None,
        "needs_pins": needs_pins,
        "exempt": bool(d.exempt),
    }
    if addresses:
        out |= {
            "first_seen": utc_z(d.first_seen),
            "ip": d.ip,
            "ipv6": d.ipv6,
            "hostname": d.hostname,
        }
    return out


def _device(db: Session, device_id: int) -> Device:
    d = db.get(Device, device_id)
    if d is None:
        raise HTTPException(404, "That device doesn't exist. Refresh the list and try again.")
    return d


def _devices(db: Session, ids: list[int]) -> list[Device]:
    rows = db.query(Device).filter(Device.id.in_(ids)).all() if ids else []
    if len(rows) != len(set(ids)):
        raise HTTPException(400, "One of the devices doesn't exist. Refresh and try again.")
    return rows


def _commit(db: Session, msg: str, code: int = 409) -> None:
    """Two taps at once can both pass a check and then collide on a unique key: answer, don't 500."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(code, msg) from None


@router.get("/blocker")
def blocker_status(db: Session = Depends(get_db)) -> dict:
    seen = get_family(db).blocker_last_seen  # naive UTC
    online = seen is not None and datetime.now(UTC).replace(tzinfo=None) - seen < BLOCKER_STALE
    return {"online": online, "last_seen": utc_z(seen)}


@router.get("/devices")
def list_devices(db: Session = Depends(get_db)):
    fam, now = get_family(db), datetime.now(UTC)
    devs = (
        db.query(Device)
        .options(
            selectinload(Device.owners), selectinload(Device.groups), selectinload(Device.ipv6_rows)
        )
        .order_by(Device.id)
        .all()
    )
    pre = Prefetch(db, devs)
    return [device_out(db, d, fam, now, pre, addresses=True) for d in devs]


@router.patch("/devices/{device_id}")
def patch_device(device_id: int, body: DevicePatch, db: Session = Depends(get_db)):
    d = _device(db, device_id)
    if body.name is not None:
        d.name = body.name
    if body.status is not None:
        d.status = body.status
    if body.exempt is not None:
        d.exempt = body.exempt
    if body.owner_ids is not None:
        kids = db.query(User).filter(User.id.in_(body.owner_ids), User.role == UserRole.KID).all()
        if len(kids) != len(set(body.owner_ids)):
            raise HTTPException(400, "Owners must be existing kids. Pick from the kid list.")
        d.owners = kids
        if body.status != "guest" and not (d.status == "guest" and not kids):
            d.status = "assigned" if kids else "unassigned"
    if body.group_ids is not None:
        groups = db.query(DeviceGroup).filter(DeviceGroup.id.in_(body.group_ids)).all()
        if len(groups) != len(set(body.group_ids)):
            raise HTTPException(400, "One of the groups doesn't exist. Refresh and try again.")
        d.groups = groups
    _commit(db, "That device just changed somewhere else. Refresh and try again.")
    trigger()
    return device_out(db, d, get_family(db), datetime.now(UTC), addresses=True)


@router.post("/devices/{device_id}/override")
def device_override(
    device_id: int,
    body: OverrideIn,
    db: Session = Depends(get_db),
    parent: User = Depends(require_parent),
):
    _device(db, device_id)
    set_override(db, [device_id], body.action, body.minutes, parent.id)
    db.commit()
    trigger()
    return {"ok": True}


@router.delete("/devices/{device_id}/override")
def device_clear_override(device_id: int, db: Session = Depends(get_db)):
    _device(db, device_id)
    clear_override(db, [device_id])
    db.commit()
    trigger()
    return {"ok": True}


@router.post("/devices/{device_id}/test-block")
def test_block(device_id: int, db: Session = Depends(get_db)):
    d = _device(db, device_id)
    result = blocker_client.test_block(d.mac)
    if result is None:
        raise HTTPException(503, "The home box didn't answer. Is it plugged in?")
    return result


@router.delete("/devices/{device_id}")
def delete_device(device_id: int, db: Session = Depends(get_db)):
    d = _device(db, device_id)
    d.owners = []
    db.query(Override).filter(Override.device_id == d.id).delete()
    db.execute(delete(device_group_members).where(device_group_members.c.device_id == d.id))
    db.expire(d)
    db.delete(d)
    db.commit()
    trigger()
    return {"ok": True}


# ---- groups ----


def _group_out(g: DeviceGroup) -> dict:
    return {
        "id": g.id,
        "name": g.name,
        "device_ids": sorted(d.id for d in g.devices),
        "icon": g.icon,
        "chore_lock": g.chore_lock,
    }


def _group(db: Session, group_id: int) -> DeviceGroup:
    g = db.get(DeviceGroup, group_id)
    if g is None:
        raise HTTPException(404, "That group doesn't exist. Refresh the list and try again.")
    return g


def _name_free(db: Session, name: str, own_id: int | None = None) -> None:
    q = db.query(DeviceGroup).filter(DeviceGroup.name == name)
    if own_id:
        q = q.filter(DeviceGroup.id != own_id)
    if q.first():
        raise HTTPException(400, "A group with that name already exists. Pick another name.")


@router.get("/groups")
def list_groups(db: Session = Depends(get_db)):
    return [_group_out(g) for g in db.query(DeviceGroup).order_by(DeviceGroup.id)]


@router.post("/groups")
def create_group(body: GroupIn, db: Session = Depends(get_db)):
    _name_free(db, body.name)
    g = DeviceGroup(name=body.name, icon=body.icon or "devices")
    if body.chore_lock is not None:
        g.chore_lock = body.chore_lock
    g.devices = _devices(db, body.device_ids)
    db.add(g)
    _commit(db, "A group with that name already exists. Pick another name.", 400)
    trigger()
    return _group_out(g)


@router.patch("/groups/{group_id}")
def patch_group(group_id: int, body: GroupIn, db: Session = Depends(get_db)):
    g = _group(db, group_id)
    _name_free(db, body.name, g.id)
    g.name = body.name
    if body.icon is not None:
        g.icon = body.icon
    if body.chore_lock is not None:
        g.chore_lock = body.chore_lock
    g.devices = _devices(db, body.device_ids)
    _commit(db, "A group with that name already exists. Pick another name.", 400)
    trigger()
    return _group_out(g)


@router.delete("/groups/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db)):
    g = _group(db, group_id)
    db.query(HourRuleTarget).filter_by(group_id=g.id).delete()
    g.devices = []
    db.flush()
    db.delete(g)
    db.commit()
    trigger()
    return {"ok": True}


@router.post("/groups/{group_id}/override")
def group_override(
    group_id: int,
    body: OverrideIn,
    db: Session = Depends(get_db),
    parent: User = Depends(require_parent),
):
    g = _group(db, group_id)
    set_override(db, [d.id for d in g.devices], body.action, body.minutes, parent.id)
    db.commit()
    trigger()
    return {"ok": True}


@router.delete("/groups/{group_id}/override")
def group_clear_override(group_id: int, db: Session = Depends(get_db)):
    g = _group(db, group_id)
    clear_override(db, [d.id for d in g.devices])
    db.commit()
    trigger()
    return {"ok": True}
