"""Internal endpoints used by the network blocker (shared-token auth)."""

import hmac
import ipaddress
import re
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.lock import activity
from app.lock.loop import trigger
from app.lock.rules import block_reason
from app.lock.schedule import local_now
from app.lock.state import Prefetch, desired_blocked, device_facts
from app.models.device_activity import DeviceEvent
from app.models.family import get_family
from app.models.lock import Device
from app.services import inbox

MAC_RE = re.compile(r"^([0-9a-f]{2}:){5}[0-9a-f]{2}$")

router = APIRouter(prefix="/api/v1/internal", tags=["internal"])


def _touch(db: Session) -> None:
    """Stamp blocker liveness; called from the endpoints its loops hit periodically."""
    get_family(db).blocker_last_seen = datetime.now(UTC).replace(tzinfo=None)
    db.commit()


def require_token(x_internal_token: str = Header(default="")) -> None:
    expected = (settings.INTERNAL_TOKEN or "").encode()
    if not expected or not hmac.compare_digest(x_internal_token.encode(), expected):
        raise HTTPException(403, "Missing or wrong internal token.")


class SeenReport(BaseModel):
    mac: str
    ip: str | None = None
    ipv6: list[str] = Field(default_factory=list, max_length=8)
    hostname: str | None = Field(default=None, max_length=255)
    vendor: str | None = Field(default=None, max_length=255)

    @field_validator("mac")
    @classmethod
    def _mac(cls, v: str) -> str:
        v = v.strip().lower().replace("-", ":")
        if not MAC_RE.match(v):
            raise ValueError("MAC address must look like aa:bb:cc:dd:ee:ff.")
        return v

    @field_validator("ip")
    @classmethod
    def _ip(cls, v: str | None) -> str | None:
        if v is not None:
            ipaddress.IPv4Address(v)
        return v

    @field_validator("ipv6")
    @classmethod
    def _ipv6(cls, v: list[str]) -> list[str]:
        for a in v:
            ipaddress.IPv6Address(a)
        return v


class ResistingReport(BaseModel):
    resisting: list[str] = Field(max_length=1000)

    @field_validator("resisting")
    @classmethod
    def _macs(cls, v: list[str]) -> list[str]:
        out = [m.strip().lower().replace("-", ":") for m in v]
        if not all(MAC_RE.match(m) for m in out):
            raise ValueError("MAC address must look like aa:bb:cc:dd:ee:ff.")
        return out


class HitsReport(BaseModel):
    hits: dict[str, Annotated[int, Field(ge=1, le=10000)]] = Field(max_length=1000)

    @field_validator("hits")
    @classmethod
    def _macs(cls, v: dict[str, int]) -> dict[str, int]:
        out = {m.strip().lower().replace("-", ":"): n for m, n in v.items()}
        if not all(MAC_RE.match(m) for m in out):
            raise ValueError("MAC address must look like aa:bb:cc:dd:ee:ff.")
        return out


def _apply(dev: Device, body: SeenReport, now: datetime) -> None:
    dev.ip, dev.last_seen = body.ip, now
    dev.ipv6 = body.ipv6
    dev.hostname = body.hostname or dev.hostname
    dev.vendor = body.vendor or dev.vendor


@router.post("/devices/seen", dependencies=[Depends(require_token)])
def devices_seen(body: SeenReport, db: Session = Depends(get_db)) -> dict:
    now = datetime.now(UTC).replace(tzinfo=None)
    dev = db.query(Device).filter(Device.mac == body.mac).first()
    new = dev is None
    if new:
        dev = Device(
            mac=body.mac,
            name=(body.hostname or body.vendor or "Unknown device")[:100],
            status="unassigned",
            first_seen=now,
        )
        _apply(dev, body, now)
        db.add(dev)
        try:
            db.flush()
            inbox.notify_parents(
                db,
                "new_device",
                f"New device: {dev.name}",
                "Say whose it is so it follows their rules.",
                device_id=dev.id,
            )
            db.commit()
        except IntegrityError:  # concurrent first report for the same MAC
            db.rollback()
            dev = db.query(Device).filter(Device.mac == body.mac).one()
            new = False
    if new:
        trigger()
    else:
        old_ip = dev.ip
        _apply(dev, body, now)
        if old_ip is not None and body.ip is not None and old_ip != body.ip:
            activity.log(db, dev.id, "address_change", now, detail=f"{old_ip} → {body.ip}")
    if new and dev.hostname:
        _note_new_address(db, dev, now)
    activity.sample(db, dev, now)
    db.commit()
    return {"id": dev.id}


def _note_new_address(db: Session, new: Device, now: datetime) -> None:
    """A fresh device sharing a hostname with one locked moments ago is probably the same hardware."""
    other = (
        db.query(Device)
        .filter(
            Device.id != new.id,
            func.lower(Device.hostname) == new.hostname.lower(),
            Device.blocked_since >= now - activity.SLOT,
        )
        .first()
    )
    if other:
        mins = round((now - other.blocked_since).total_seconds() / 60)
        activity.log(db, other.id, "new_address", now, other_device_id=new.id, minutes=mins)


@router.get("/state", dependencies=[Depends(require_token)])
def state(db: Session = Depends(get_db)) -> dict:
    _touch(db)
    return {"blocked": desired_blocked(db, datetime.now(UTC))}


@router.post("/devices/resisting", dependencies=[Depends(require_token)])
def devices_resisting(body: ResistingReport, db: Session = Depends(get_db)) -> dict:
    _touch(db)
    now = datetime.now(UTC).replace(tzinfo=None)
    listed = set(body.resisting)
    flagged = cleared = 0
    try:
        for dev in db.query(Device).all():
            if dev.mac in listed:
                if dev.resisting_since is not None:
                    continue
                dev.resisting_since = now
                flagged += 1
                activity.log(db, dev.id, "bypass", now)
                # security ping: notify.ping applies quiet hours (quiet_security)
                inbox.notify_parents(
                    db,
                    "device_bypass",
                    f"{dev.name} is getting around the block",
                    f"{dev.name} is still reaching the internet while it "
                    "should be paused. Someone may have changed its network "
                    "settings. Tap for what to check.",
                    device_id=dev.id,
                )
            elif dev.resisting_since is not None:
                dev.resisting_since = None
                cleared += 1
                open_ev = (
                    db.query(DeviceEvent)
                    .filter(
                        DeviceEvent.device_id == dev.id,
                        DeviceEvent.kind == "bypass",
                        DeviceEvent.last_at.is_(None),
                    )
                    .order_by(DeviceEvent.at.desc(), DeviceEvent.id.desc())
                    .first()
                )
                if open_ev:
                    open_ev.last_at = now
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"flagged": flagged, "cleared": cleared}


@router.post("/devices/hits", dependencies=[Depends(require_token)])
def devices_hits(body: HitsReport, db: Session = Depends(get_db)) -> dict:
    """Portal hits from blocked devices become 'tried while locked' alerts."""
    _touch(db)
    now = datetime.now(UTC).replace(tzinfo=None)
    devs = (
        db.query(Device).filter(Device.mac.in_(body.hits), Device.blocked_since.isnot(None)).all()
    )
    fam, logged = get_family(db), 0
    local, pre = local_now(fam.timezone, now), Prefetch(db, devs)
    for d in devs:
        reason = block_reason(device_facts(db, d, fam, now, pre), local)
        if reason is None:  # open now; the next tick clears blocked_since
            continue
        kind = "outside_hours" if reason == "schedule" else "locked_try"
        activity.log(db, d.id, kind, now, merge_minutes=30, count=body.hits[d.mac], reason=reason)
        logged += 1
    db.commit()
    return {"logged": logged}
