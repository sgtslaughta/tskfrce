"""Apprise notifications: queued on the session, sent only after commit."""

import re
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

import apprise
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.crypto import unseal
from app.core.logging import get_logger
from app.models.family import get_family
from app.models.notify import NotifyHeld, NotifyPlace

log = get_logger(__name__)

EVENTS = {
    "chore_ok": "Chore needs OK",
    "kid_note": "Kid note",
    "reward_request": "Reward request",
    "new_device": "New device",
    "resisting": "Device resisting",
    "badge": "Badge / level up",
    "summary": "Daily summary",
    "box_offline": "Box offline",
    "lock_change": "Locked / unlocked",
    "overdue": "Overdue",
}
SECURITY = {"resisting", "box_offline"}
HELD = {"chore_ok", "kid_note", "reward_request", "new_device"}
DEFAULT_EVENTS = (
    "chore_ok",
    "kid_note",
    "reward_request",
    "new_device",
    "resisting",
    "box_offline",
)
KIND_EVENT = {
    "chore_submitted": "chore_ok",
    "chore_note": "kid_note",
    "redemption_request": "reward_request",
    "new_device": "new_device",
    "device_resisting": "resisting",
    "device_bypass": "resisting",
    "badge_earned": "badge",
    "level_up": "badge",
    "box_offline": "box_offline",
}

_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="apprise")


def in_quiet(fam, now_utc: datetime) -> bool:
    start, end = fam.quiet_start, fam.quiet_end
    if not start or not end or start == end:
        return False
    t = now_utc.astimezone(ZoneInfo(fam.timezone)).strftime("%H:%M")
    return start <= t < end if start < end else t >= start or t < end


def link(fam, path: str | None) -> str | None:
    base = fam.app_address or settings.BOX_URL
    return base.rstrip("/") + path if base and path else None


def ping(db, event: str, title: str, body: str | None = None, path: str | None = None) -> None:
    fam = get_family(db)
    quiet = in_quiet(fam, datetime.now(UTC))
    url = link(fam, path)
    text = (body or "") + (("\n\n" if body else "") + url if url else "")
    for p in db.query(NotifyPlace).filter(NotifyPlace.enabled.is_(True)).order_by(NotifyPlace.id):
        if event not in (p.events or "").split(","):
            continue
        if quiet and event in SECURITY and not fam.quiet_security:
            continue
        if quiet and event not in SECURITY:
            if event in HELD:
                db.add(NotifyHeld(place_id=p.id, title=title[:120], body=(body or "")[:300]))
            continue
        try:
            urls = [unseal(p.url_enc)]
        except ValueError:
            log.warning("notify place unreadable", place_id=p.id)
            continue
        db.info.setdefault("pings", []).append((urls, title, text))


def _redact(msg: str, urls: list[str]) -> str:
    """Mask every URL and credential-ish piece of it, then cap at 300 chars."""
    secrets = set()
    for u in urls:
        secrets.add(u)
        parts = urlsplit(u)
        for chunk in (u.split("://", 1)[-1], parts.netloc, parts.path, parts.query):
            secrets.add(chunk)
            secrets.update(re.split(r"[/@:?&=]", chunk))
    scheme = {u.split("://", 1)[0] for u in urls}
    for sec in sorted(secrets, key=len, reverse=True):
        if len(sec) >= 4 and sec not in scheme:
            msg = msg.replace(sec, "••••")
    return msg[:300]


def deliver(urls: list[str], title: str, body: str) -> tuple[bool, str | None]:
    try:
        ap = apprise.Apprise()
        for u in urls:
            ap.add(u)
        with apprise.LogCapture(level=apprise.logging.WARNING) as cap:
            ok = ap.notify(title=title, body=body, body_format=apprise.NotifyFormat.TEXT)
        if ok:
            return True, None
        lines = [x for x in cap.getvalue().splitlines() if x.strip()]
        return False, _redact(lines[-1] if lines else "It didn't go through.", urls)
    except Exception as exc:  # noqa: BLE001 - delivery must never raise
        return False, _redact(str(exc), urls)


def _submit(fn, *args) -> None:
    _pool.submit(fn, *args)


def _send(urls, title, text) -> None:
    ok, err = deliver(urls, title, text)
    if not ok:
        log.warning("notify delivery failed", error=err)


@event.listens_for(Session, "after_commit")
def _after_commit(session) -> None:
    for urls, title, text in session.info.pop("pings", []):
        _submit(_send, urls, title, text)


@event.listens_for(Session, "after_rollback")
def _after_rollback(session) -> None:
    session.info.pop("pings", None)
