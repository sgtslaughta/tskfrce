"""Background loop: re-evaluate who is blocked and push to the blocker."""

import asyncio
from datetime import UTC, datetime

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging import get_logger
from app.lock.blocker_client import push_blocked
from app.lock.state import tick

logger = get_logger(__name__)
_event: asyncio.Event | None = None


def _get_event() -> asyncio.Event:
    global _event
    if _event is None:
        _event = asyncio.Event()
    return _event


def trigger() -> None:
    """Ask for an immediate re-evaluation. Safe from sync code; no-op if no loop."""
    if _event is not None:
        try:
            _event.get_loop().call_soon_threadsafe(_event.set)
        except RuntimeError:  # loop closed
            pass


def _run_once() -> None:
    db = SessionLocal()
    try:
        push_blocked(tick(db, datetime.now(UTC)))
    except Exception as exc:
        logger.error("Lock tick failed", error=str(exc))
    finally:
        db.close()


async def run_forever() -> None:
    ev = _get_event()
    while True:
        await asyncio.to_thread(_run_once)
        try:
            await asyncio.wait_for(ev.wait(), settings.LOCK_INTERVAL_SECONDS)
        except TimeoutError:
            pass
        ev.clear()
