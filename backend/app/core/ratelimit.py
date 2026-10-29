"""In-memory rate limiting.

ponytail: single-process dict, fine for one Pi. Swap for a shared store if we ever run
more than one worker.
"""

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, status

TOO_MANY = "Too many tries. Wait a minute and try again."

SWEEP_ABOVE = 1000  # keys; past this, `hit` drops every expired key

_hits: dict[str, deque[float]] = defaultdict(deque)
_spans: dict[str, int] = {}
_lock = Lock()


def _prune(key: str, per_seconds: int, now: float) -> deque[float]:
    hits = _hits.get(key) or deque()
    while hits and hits[0] <= now - per_seconds:
        hits.popleft()
    if not hits:
        _hits.pop(key, None)
        _spans.pop(key, None)
    return hits


def _sweep(now: float) -> None:
    """Keys are attacker-chosen (usernames), so forget ones nobody hits again."""
    for key in [k for k, h in _hits.items() if h[-1] <= now - _spans[k]]:
        del _hits[key], _spans[key]


def check(key: str, max_hits: int, per_seconds: int) -> None:
    """Raise 429 if `key` already has `max_hits` within `per_seconds` (counts nothing)."""
    with _lock:
        if len(_prune(key, per_seconds, time.monotonic())) >= max_hits:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=TOO_MANY)


def hit(key: str, per_seconds: int) -> None:
    """Record one hit for `key`."""
    with _lock:
        now = time.monotonic()
        _prune(key, per_seconds, now)
        _hits[key].append(now)
        _spans[key] = per_seconds
        if len(_hits) > SWEEP_ABOVE:
            _sweep(now)


def limit(key: str, max_hits: int, per_seconds: int) -> None:
    """Count one hit for `key`; raise 429 once it exceeds `max_hits` within `per_seconds`."""
    check(key, max_hits, per_seconds)
    hit(key, per_seconds)


def reset() -> None:
    """Forget all hits (tests)."""
    with _lock:
        _hits.clear()
        _spans.clear()
