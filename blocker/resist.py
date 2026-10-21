"""Resistance counters: detect blocked devices that keep reaching the real gateway.

A blocked device whose ARP/NDP cache was redirected to this box should send its
gateway-bound frames here. Frames it still addresses to the real gateway MAC are
resisting the redirect. Counts are per watched MAC and reset each window.
"""

from __future__ import annotations

import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, replace

from blocker.arp import LanFacts


@dataclass
class Tally:
    """Frame counts for one watched MAC within the current window."""

    to_gateway: int = 0
    to_box: int = 0


class ResistanceCounter:
    """Thread-safe counters; ``observe`` is called from the sniffer thread."""

    def __init__(
        self,
        lan: LanFacts,
        *,
        window: float = 30.0,
        threshold: int = 20,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        # A None gateway MAC is unknown, so it must never match a frame.
        self._gateways = frozenset(m.lower() for m in (lan.gateway_mac, lan.gateway_mac6) if m)
        self._box = lan.box_mac.lower()
        self._window = window
        self._threshold = threshold
        self._clock = clock
        self._lock = threading.Lock()
        self._watched: set[str] = set()
        # mac -> (window_start, tally)
        self._tallies: dict[str, tuple[float, Tally]] = {}

    def set_watched(self, macs: set[str]) -> None:
        """Replace the watched set; tallies of MACs no longer watched are dropped."""
        watched = {m.lower() for m in macs}
        with self._lock:
            self._watched = watched
            for mac in list(self._tallies):
                if mac not in watched:
                    del self._tallies[mac]

    def observe(self, src_mac: str, dst_mac: str, now: float | None = None) -> None:
        """Count one frame from src to dst. Frames from unwatched sources are ignored."""
        src = src_mac.lower()
        dst = dst_mac.lower()
        ts = self._clock() if now is None else now
        with self._lock:
            if src not in self._watched:
                return
            start, tally = self._tallies.get(src, (ts, Tally()))
            if ts - start >= self._window:
                start, tally = ts, Tally()
            if dst in self._gateways:
                tally.to_gateway += 1
            elif dst == self._box:
                tally.to_box += 1
            self._tallies[src] = (start, tally)

    def tally(self, mac: str) -> Tally:
        """Current-window counts for mac (zeros if unwatched or window expired)."""
        with self._lock:
            return self._live(mac.lower(), self._clock())

    def resisting(self) -> set[str]:
        """Watched MACs whose gateway-bound count in the current window meets the threshold."""
        now = self._clock()
        with self._lock:
            return {
                mac for mac in self._watched if self._live(mac, now).to_gateway >= self._threshold
            }

    def _live(self, mac: str, now: float) -> Tally:
        """Return a copy of mac's tally if its window is still open, else zeros. Lock held."""
        entry = self._tallies.get(mac)
        if entry is None or now - entry[0] >= self._window:
            return Tally()
        return replace(entry[1])
