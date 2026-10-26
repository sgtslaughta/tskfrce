"""Counts lock-page HTTP hits per device MAC, at most one per device per `gap` seconds."""

from __future__ import annotations

import threading
import time
from collections.abc import Callable


class HitCounter:
    def __init__(
        self,
        resolve: Callable[[str], str | None],
        clock: Callable[[], float] = time.monotonic,
        gap: float = 10.0,
    ) -> None:
        self._resolve = resolve
        self._clock = clock
        self._gap = gap
        self._counts: dict[str, int] = {}
        self._last: dict[str, float] = {}
        self._lock = threading.Lock()

    def add(self, ip: str) -> None:
        mac = self._resolve(ip)
        if mac is None:
            return
        with self._lock:
            now = self._clock()
            last = self._last.get(mac)
            if last is not None and now - last < self._gap:
                return
            self._last[mac] = now
            self._counts[mac] = self._counts.get(mac, 0) + 1

    def drain(self) -> dict[str, int]:
        with self._lock:
            out, self._counts = self._counts, {}
            return out
