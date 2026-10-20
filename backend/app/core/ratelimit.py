"""In-memory rate limiting.

ponytail: single-process dict, fine for one Pi. Swap for a shared store if we ever run
more than one worker.
"""

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status

TOO_MANY = "Too many tries. Wait a minute and try again."

_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def limit(key: str, max_hits: int, per_seconds: int) -> None:
    """Count one hit for `key`; raise 429 once it exceeds `max_hits` within `per_seconds`."""
    now = time.monotonic()
    with _lock:
        hits = _hits[key]
        while hits and hits[0] <= now - per_seconds:
            hits.popleft()
        if len(hits) >= max_hits:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=TOO_MANY)
        hits.append(now)


def client_ip(request: Request) -> str:
    """Socket peer address (headers like X-Forwarded-For are spoofable, so ignored)."""
    return request.client.host if request.client else "unknown"


def reset() -> None:
    """Forget all hits (tests)."""
    with _lock:
        _hits.clear()
