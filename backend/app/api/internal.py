"""Internal endpoints used by the network blocker (shared-token auth)."""

import hmac
import ipaddress
import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.lock.loop import trigger
from app.lock.state import desired_blocked
from app.models.lock import Device

MAC_RE = re.compile(r"^([0-9a-f]{2}:){5}[0-9a-f]{2}$")

router = APIRouter(prefix="/api/v1/internal", tags=["internal"])


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


def _apply(dev: Device, body: SeenReport, now: datetime) -> None:
    dev.ip, dev.ipv6, dev.last_seen = body.ip, body.ipv6, now
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
            db.commit()
        except IntegrityError:  # concurrent first report for the same MAC
            db.rollback()
            dev = db.query(Device).filter(Device.mac == body.mac).one()
            new = False
    if new:
        trigger()
    else:
        _apply(dev, body, now)
        db.commit()
    return {"id": dev.id}


@router.get("/state", dependencies=[Depends(require_token)])
def state(db: Session = Depends(get_db)) -> dict:
    return {"blocked": desired_blocked(db, datetime.now(UTC))}
