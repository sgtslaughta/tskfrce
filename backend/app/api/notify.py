"""Parent API: Apprise notification places and quiet-hours settings."""

import re
from urllib.parse import urlsplit

import apprise
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.core.config import settings
from app.core.crypto import seal, unseal
from app.core.ratelimit import limit
from app.models.family import get_family
from app.models.notify import NotifyPlace
from app.models.user import User
from app.schemas.lock import _hhmm
from app.services import notify

router = APIRouter(prefix="/api/v1/notify", tags=["notify"], dependencies=[Depends(require_parent)])

BAD_URL = "Apprise can't read that address. Check it against the Apprise wiki."
BAD_EVENTS = "Pick events from the list."
NO_PLACE = "That place doesn't exist."


def mask(url: str) -> str:
    if "://" not in url:
        return "••••"
    scheme, rest = url.split("://", 1)
    return f"{scheme}://{rest[:4]}••••"[:80]


def _check_url(url: str) -> str:
    # length is checked by hand: pydantic's 422 would echo the URL back
    if not 1 <= len(url) <= 1000:
        raise HTTPException(422, BAD_URL)
    # apprise logs don't propagate (see services/notify.py), so a failed add stays silent
    if not apprise.Apprise().add(url):
        raise HTTPException(422, BAD_URL)
    return url


def _check_events(events: list[str]) -> str:
    if any(e not in notify.EVENTS for e in events):
        raise HTTPException(422, BAD_EVENTS)
    return ",".join(dict.fromkeys(events))


class PlaceIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    url: str
    events: list[str] | None = None
    enabled: bool = True


class PlacePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    url: str | None = None
    events: list[str] | None = None
    enabled: bool | None = None


def _out(p: NotifyPlace) -> dict:
    try:
        unseal(p.url_enc)
        readable = True
    except ValueError:
        readable = False
    return {
        "id": p.id,
        "name": p.name,
        "url_mask": p.url_mask,
        "enabled": p.enabled,
        "events": [e for e in (p.events or "").split(",") if e],
        "readable": readable,
    }


def _get(db: Session, place_id: int) -> NotifyPlace:
    p = db.get(NotifyPlace, place_id)
    if not p:
        raise HTTPException(404, NO_PLACE)
    return p


@router.get("/places")
def list_places(db: Session = Depends(get_db)):
    return [_out(p) for p in db.query(NotifyPlace).order_by(NotifyPlace.id)]


@router.post("/places", status_code=201)
def create_place(body: PlaceIn, db: Session = Depends(get_db)):
    url = _check_url(body.url)
    events = _check_events(notify.DEFAULT_EVENTS if body.events is None else body.events)
    p = NotifyPlace(
        name=body.name, url_enc=seal(url), url_mask=mask(url), enabled=body.enabled, events=events
    )
    db.add(p)
    db.commit()
    return _out(p)


@router.patch("/places/{place_id}")
def patch_place(place_id: int, body: PlacePatch, db: Session = Depends(get_db)):
    p = _get(db, place_id)
    data = body.model_dump(exclude_unset=True)
    if data.get("url") is not None:
        p.url_enc, p.url_mask = seal(_check_url(data["url"])), mask(data["url"])
    if data.get("events") is not None:
        p.events = _check_events(data["events"])
    for k in ("name", "enabled"):
        if data.get(k) is not None:
            setattr(p, k, data[k])
    db.commit()
    return _out(p)


@router.delete("/places/{place_id}", status_code=204)
def delete_place(place_id: int, db: Session = Depends(get_db)):
    db.delete(_get(db, place_id))
    db.commit()
    return Response(status_code=204)


@router.post("/places/{place_id}/test")
def test_place(place_id: int, db: Session = Depends(get_db), user: User = Depends(require_parent)):
    limit(f"notify-test:{user.id}", 5, 60)
    p = _get(db, place_id)
    try:
        url = unseal(p.url_enc)
    except ValueError:
        return {"ok": False, "error": "Re-enter this address."}
    ok, error = notify.deliver(
        [url], "t@sk4ce test", "If you can read this, pings will reach this place."
    )
    return {"ok": ok, "error": error}


def _addr_ok(addr: str) -> bool:
    if not addr.startswith(("http://", "https://")) or re.search(r"\s", addr):
        return False
    try:
        return bool(urlsplit(addr).netloc)
    except ValueError:
        return False


class SettingsPatch(BaseModel):
    quiet_start: str | None = None
    quiet_end: str | None = None
    quiet_security: bool | None = None
    app_address: str | None = Field(default=None, max_length=200)

    _times = field_validator("quiet_start", "quiet_end")(_hhmm)


def _settings_out(fam) -> dict:
    return {
        "quiet_start": fam.quiet_start,
        "quiet_end": fam.quiet_end,
        "quiet_security": fam.quiet_security,
        "app_address": fam.app_address,
        "app_address_default": settings.BOX_URL,
        "events": [
            {"key": k, "label": v, "security": k in notify.SECURITY}
            for k, v in notify.EVENTS.items()
        ],
    }


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    fam = get_family(db)
    db.commit()
    return _settings_out(fam)


@router.patch("/settings")
def patch_settings(body: SettingsPatch, db: Session = Depends(get_db)):
    fam = get_family(db)
    data = body.model_dump(exclude_unset=True)
    if "app_address" in data:
        addr = data["app_address"]
        if addr and not _addr_ok(addr):
            raise HTTPException(422, "Start the address with http:// or https://.")
        data["app_address"] = addr.rstrip("/") if addr else None
    for k, v in data.items():
        if k == "quiet_security" and v is None:
            continue
        setattr(fam, k, v)
    db.commit()
    return _settings_out(fam)
