"""In-memory rate limiting.

ponytail: single-process dict, fine for one Pi. Swap for a shared store if we ever run
more than one worker.
"""

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, status

TOO_MANY = "Too many tries. Wait a minute and try again."

_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def _prune(key: str, per_seconds: int, now: float) -> deque[float]:
    hits = _hits[key]
    while hits and hits[0] <= now - per_seconds:
        hits.popleft()
    return hits


def check(key: str, max_hits: int, per_seconds: int) -> None:
    """Raise 429 if `key` already has `max_hits` within `per_seconds` (counts nothing)."""
    with _lock:
        if len(_prune(key, per_seconds, time.monotonic())) >= max_hits:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=TOO_MANY)


def hit(key: str, per_seconds: int) -> None:
    """Record one hit for `key`."""
    with _lock:
        now = time.monotonic()
        _prune(key, per_seconds, now).append(now)


def limit(key: str, max_hits: int, per_seconds: int) -> None:
    """Count one hit for `key`; raise 429 once it exceeds `max_hits` within `per_seconds`."""
    check(key, max_hits, per_seconds)
    hit(key, per_seconds)


def reset() -> None:
    """Forget all hits (tests)."""
    with _lock:
        _hits.clear()
