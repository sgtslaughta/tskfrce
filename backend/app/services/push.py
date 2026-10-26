"""Push kid alerts to the box's own ntfy after the DB commit."""

import os
import threading
from urllib.parse import urlparse

import httpx
from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.models.user import User, UserRole
from app.services import inbox

logger = get_logger(__name__)
URGENT = {"due_soon", "missed_deadline", "lock_warning"}


def public_url() -> str | None:
    if settings.NTFY_PUBLIC_URL:
        return settings.NTFY_PUBLIC_URL
    host = urlparse(settings.BOX_URL or "").hostname
    return f"http://{host}:2586" if host else None


def enabled() -> bool:
    return bool(settings.NTFY_URL and public_url())


def conf_text(relay: bool) -> str:
    return 'upstream-base-url: "https://ntfy.sh"\n' if relay else "# relay off\n"


def write_conf(fam) -> None:
    path = settings.NTFY_CONF_FILE
    if not path:
        return
    try:
        text = conf_text(fam.ntfy_upstream_relay)
        try:
            with open(path) as f:
                if f.read() == text:
                    return
        except FileNotFoundError:
            pass
        tmp = f"{path}.tmp"
        with open(tmp, "w") as f:
            f.write(text)
        os.replace(tmp, path)
    except Exception as e:
        logger.warning("ntfy conf write failed", error=str(e))


def queue(db: Session, user_id: int, kind: str, title: str, body: str | None, row=None) -> None:
    """Stage a push; sent after commit. `row` lets a savepoint rollback cancel it."""
    if not enabled() or kind not in inbox.KID_KINDS:
        return
    u = db.get(User, user_id)
    if not u or u.role != UserRole.KID or not u.push_topic:
        return
    base = settings.BOX_URL
    db.info.setdefault("push_out", []).append(
        {
            "topic": u.push_topic,
            "title": title,
            "message": body or "",
            "click": f"{base.rstrip('/')}/kid" if base else None,
            "priority": 4 if kind in URGENT else 3,
            "_row": row,
        }
    )


def _spawn(fn, *args) -> None:
    threading.Thread(target=fn, args=args, daemon=True).start()


def send(item: dict) -> None:
    try:
        r = httpx.post(f"{settings.NTFY_URL}/", json=item, timeout=5)
        r.raise_for_status()
    except Exception as e:
        logger.warning("Push failed", error=str(e))


def _send_all(items: list[dict]) -> None:
    for i in items:
        send(i)


@event.listens_for(Session, "after_commit")
def _after_commit(session: Session) -> None:
    items = session.info.pop("push_out", None)
    if not items:
        return
    # rows rolled back in a savepoint are no longer persistent
    live = [
        {k: v for k, v in i.items() if k != "_row"}
        for i in items
        if i["_row"] is None or inspect(i["_row"]).persistent
    ]
    if live:
        _spawn(_send_all, live)


@event.listens_for(Session, "after_rollback")
def _after_rollback(session: Session) -> None:
    session.info.pop("push_out", None)
