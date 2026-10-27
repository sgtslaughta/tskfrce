"""Background loop: re-evaluate who is blocked and push to the blocker."""

import asyncio
from datetime import UTC, datetime

from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging import get_logger
from app.lock.blocker_client import push_blocked
from app.lock.state import tick
from app.services import kid_alerts, notify_jobs

logger = get_logger(__name__)
_loop: asyncio.AbstractEventLoop | None = None
_event: asyncio.Event | None = None
_busy_ticks = 0  # ticks skipped because SQLite was busy


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
    global _busy_ticks
    db = SessionLocal()
    try:
        now = datetime.now(UTC)
        blocked = tick(db, now)
        push_blocked(blocked)
        try:
            kid_alerts.scan(db, now)
        except Exception as exc:
            db.rollback()
            logger.error("Kid alerts failed", error=str(exc))
        try:
            notify_jobs.tick(db, now, blocked)
        except OperationalError as exc:
            db.rollback()
            if "database is locked" in str(exc):
                logger.warning("Notify jobs skipped: database busy")
            else:
                logger.error("Notify jobs failed", error=str(exc))
        except Exception as exc:
            db.rollback()
            logger.error("Notify jobs failed", error=str(exc))
    except OperationalError as exc:
        if "database is locked" not in str(exc):
            logger.error("Lock tick failed", error=str(exc))
        else:
            _busy_ticks += 1
            logger.warning("Lock tick skipped: database busy", busy_ticks=_busy_ticks)
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
