"""Who is typing in a thread. In memory, so it relies on a single uvicorn process."""

import threading
import time

TTL = 6.0
_seen: dict[int, dict[int, tuple[str, float]]] = {}  # thread -> user -> (name, expires)
_lock = threading.Lock()  # sync routes run in a threadpool


def _prune(now: float) -> None:
    for tid in list(_seen):
        users = {u: v for u, v in _seen[tid].items() if v[1] > now}
        if users:
            _seen[tid] = users
        else:
            del _seen[tid]


def ping(thread_id: int, user_id: int, name: str, now: float | None = None) -> None:
    now = time.monotonic() if now is None else now
    with _lock:
        _prune(now)
        _seen.setdefault(thread_id, {})[user_id] = (name, now + TTL)


def who(thread_id: int, me_id: int, now: float | None = None) -> list[str]:
    now = time.monotonic() if now is None else now
    with _lock:
        _prune(now)
        return sorted(n for u, (n, _) in _seen.get(thread_id, {}).items() if u != me_id)
