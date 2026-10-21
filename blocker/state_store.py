"""Authoritative blocked-MAC set pushed by the app."""

from __future__ import annotations

import logging
import re
import threading
from collections.abc import Callable

log = logging.getLogger(__name__)

# Deliberate copy of the app's MAC_RE (blocker must not import backend code).
MAC_RE = re.compile(r"^([0-9a-f]{2}:){5}[0-9a-f]{2}$")


class StateStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._blocked: set[str] = set()
        self._callbacks: list[Callable[[set[str]], None]] = []

    def set_blocked(self, macs: list[str]) -> set[str]:
        new = {str(m).lower() for m in macs}
        for mac in sorted(new):
            if not MAC_RE.match(mac):
                raise ValueError(f"'{mac}' is not a valid MAC address.")
        with self._lock:
            self._blocked = new
            result = set(new)
            callbacks = list(self._callbacks)
        # Concurrent set_blocked callers may fire callbacks out of order;
        # subscribers should re-read current().
        for cb in callbacks:
            try:
                cb(set(result))
            except Exception:
                log.exception("state change callback failed")
        return result

    def current(self) -> set[str]:
        with self._lock:
            return set(self._blocked)

    def on_change(self, cb: Callable[[set[str]], None]) -> None:
        with self._lock:
            self._callbacks.append(cb)
