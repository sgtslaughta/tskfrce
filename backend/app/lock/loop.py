"""Background loop: re-evaluate who is blocked and push to the blocker."""

import asyncio
from datetime import UTC, datetime

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging import get_logger
from app.lock.blocker_client import push_blocked
from app.lock.state import tick

logger = get_logger(__name__)
_loop: asyncio.AbstractEventLoop | None = None
_event: asyncio.Event | None = None


def trigger() -> None:
    """Ask for an immediate re-evaluation. Safe from any thread; no-op if no loop."""
    loop, ev = _loop, _event
    if loop is None or ev is None or loop.is_closed():
        return
    try:
        loop.call_soon_threadsafe(ev.set)
    except RuntimeError:  # loop closed between check and call
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
    global _loop, _event
    _loop, _event = asyncio.get_running_loop(), asyncio.Event()
    ev = _event
    try:
        while True:
            ev.clear()
            await asyncio.to_thread(_run_once)
            try:
                await asyncio.wait_for(ev.wait(), settings.LOCK_INTERVAL_SECONDS)
            except TimeoutError:
                pass
    finally:
        _loop = _event = None
