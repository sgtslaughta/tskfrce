"""Internal endpoints used by the network blocker (shared-token auth)."""

import hmac
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.lock.loop import trigger
from app.lock.state import desired_blocked
from app.models.lock import Device

router = APIRouter(prefix="/api/v1/internal", tags=["internal"])


def require_token(x_internal_token: str = Header(default="")) -> None:
    expected = (settings.INTERNAL_TOKEN or "").encode()
    if not expected or not hmac.compare_digest(x_internal_token.encode(), expected):
        raise HTTPException(403, "Missing or wrong internal token.")


class SeenReport(BaseModel):
    mac: str
    ip: str | None = None
    ipv6: list[str] = []
    hostname: str | None = None
    vendor: str | None = None


@router.post("/devices/seen", dependencies=[Depends(require_token)])
def devices_seen(body: SeenReport, db: Session = Depends(get_db)) -> dict:
    mac = body.mac.lower()
    now = datetime.now(UTC).replace(tzinfo=None)
    dev = db.query(Device).filter(Device.mac == mac).first()
    new = dev is None
    if new:
        dev = Device(
            mac=mac,
            name=body.hostname or body.vendor or "Unknown device",
            status="unassigned",
            first_seen=now,
        )
        db.add(dev)
    dev.ip, dev.ipv6, dev.last_seen = body.ip, body.ipv6, now
    dev.hostname = body.hostname or dev.hostname
    dev.vendor = body.vendor or dev.vendor
    db.commit()
    if new:
        trigger()
    return {"id": dev.id}


@router.get("/state", dependencies=[Depends(require_token)])
def state(db: Session = Depends(get_db)) -> dict:
    return {"blocked": desired_blocked(db, datetime.now(UTC))}
