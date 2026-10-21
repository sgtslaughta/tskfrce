"""Resistance detection via the bidirectional redirect's return path.

On a switched LAN the box never sees a device's unicast frames to the router, so
we spoof the gateway too (see arp.py): the router then sends the device's return
traffic to the box. While a device is blocked, that return traffic is the signal
— a device honoring the redirect produces ~none of it (its requests die at the
box), a device bypassing produces a stream. We count, per watched MAC and per
window, gateway->box frames whose IP/IPv6 destination is one of the device's
addresses (``from_gateway``), plus device->box frames (``to_box``, the device
honoring the redirect).
"""

from __future__ import annotations

import ipaddress
import logging
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, replace
from typing import Any

from blocker.arp import LanFacts, TargetAddrs

log = logging.getLogger(__name__)


@dataclass
class Tally:
    """Frame counts for one watched MAC within the current window."""

    to_box: int = 0
    from_gateway: int = 0


def _norm(ip: str) -> str:
    """Canonical form so e.g. non-canonical IPv6 strings compare equal."""
    try:
        return str(ipaddress.ip_address(ip))
    except ValueError:
        return ip.lower()


def _ip_map(targets: dict[str, TargetAddrs]) -> dict[str, str]:
    """ip (v4+v6, canonicalized) -> watched MAC (lowercased)."""
    ip2mac: dict[str, str] = {}
    for mac, t in targets.items():
        ml = mac.lower()
        if t.ip:
            ip2mac[_norm(t.ip)] = ml
        for ip6 in t.ip6:
            ip2mac[_norm(ip6)] = ml
    return ip2mac


class ResistanceCounter:
    """Thread-safe counters; ``observe`` is called from the sniffer thread."""

    def __init__(
        self,
        lan: LanFacts,
        *,
        window: float = 30.0,
        threshold: int = 20,
        lan_cidrs: list[str] = (),
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        # A None gateway MAC is unknown, so it must never match a frame.
        self._gateways = frozenset(m.lower() for m in (lan.gateway_mac, lan.gateway_mac6) if m)
        self._box = lan.box_mac.lower()
        self._lan_nets = tuple(ipaddress.ip_network(c) for c in lan_cidrs)
        self._window = window
        self._threshold = threshold
        self._clock = clock
        self._lock = threading.Lock()
        self._watched: set[str] = set()
        self._ip2mac: dict[str, str] = {}
        # mac -> (window_start, tally)
        self._tallies: dict[str, tuple[float, Tally]] = {}

    def set_watched(self, targets: dict[str, TargetAddrs]) -> None:
        """Replace the watched devices; tallies of MACs no longer watched are dropped."""
        watched = {m.lower() for m in targets}
        ip2mac = _ip_map(targets)
        with self._lock:
            self._watched = watched
            self._ip2mac = ip2mac
            for mac in list(self._tallies):
                if mac not in watched:
                    del self._tallies[mac]

    def _in_lan(self, ip: str) -> bool:
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            return False
        return any(addr in net for net in self._lan_nets)

    def observe(
        self,
        src_mac: str,
        dst_mac: str,
        ip_dst: str | None = None,
        ip_src: str | None = None,
        now: float | None = None,
    ) -> None:
        """Count one box-bound frame. Everything not addressed to the box is ignored.

        A watched device's frame to the box counts as ``to_box`` (honoring the
        redirect); a gateway frame to the box whose IP destination is a watched
        device's address, and whose IP *source* is outside the LAN (i.e. real
        internet return traffic, not another LAN host reaching the device),
        counts as that device's ``from_gateway`` — the signal of a bypass.
        """
        src = src_mac.lower()
        dst = dst_mac.lower()
        ts = self._clock() if now is None else now
        with self._lock:
            if dst != self._box:
                return
            if src in self._watched:
                mac, field = src, "to_box"
            elif (
                src in self._gateways
                and ip_dst is not None
                and _norm(ip_dst) in self._ip2mac
                and ip_src is not None
                and not self._in_lan(ip_src)
            ):
                mac, field = self._ip2mac[_norm(ip_dst)], "from_gateway"
            else:
                return
            start, tally = self._tallies.get(mac, (ts, Tally()))
            if ts - start >= self._window:
                start, tally = ts, Tally()
            setattr(tally, field, getattr(tally, field) + 1)
            self._tallies[mac] = (start, tally)

    def tally(self, mac: str) -> Tally:
        """Current-window counts for mac (zeros if unwatched or window expired)."""
        with self._lock:
            return self._live(mac.lower(), self._clock())

    def resisting(self) -> set[str]:
        """Watched MACs whose gateway-return count in the current window meets the threshold."""
        now = self._clock()
        with self._lock:
            return {
                mac for mac in self._watched if self._live(mac, now).from_gateway >= self._threshold
            }

    def _live(self, mac: str, now: float) -> Tally:
        """Return a copy of mac's tally if its window is still open, else zeros. Lock held."""
        entry = self._tallies.get(mac)
        if entry is None or now - entry[0] >= self._window:
            return Tally()
        return replace(entry[1])


def _real_sniffer(*, iface: str | None, filter: str, prn: Callable) -> Any:
    from scapy.all import AsyncSniffer

    sniffer = AsyncSniffer(iface=iface or None, filter=filter, prn=prn, store=False)
    sniffer.start()
    return sniffer


class ResistanceWatch:
    """Runs a scapy AsyncSniffer on cfg.lan_iface feeding a ResistanceCounter."""

    def __init__(
        self,
        cfg: Any,
        counter: ResistanceCounter,
        *,
        sniffer_factory: Callable[..., Any] = _real_sniffer,
    ) -> None:
        self._cfg = cfg
        self.counter = counter
        self._factory = sniffer_factory
        self._sniffer: Any = None
        self._lock = threading.Lock()
        self._watched: dict[str, TargetAddrs] | None = None
        self._closed = False

    def set_watched(self, targets: dict[str, TargetAddrs]) -> None:
        """Watch exactly these devices: restart the sniffer, stop it if empty."""
        targets = dict(targets)
        with self._lock:
            if self._closed or targets == self._watched:
                return
            self._watched = targets
            self.counter.set_watched(targets)
            self._stop_sniffer()
            if targets:
                flt = self._filter(targets)
                try:
                    self._sniffer = self._factory(
                        iface=self._cfg.lan_iface or None, filter=flt, prn=self._on_packet
                    )
                except Exception:
                    log.exception("sniffer start failed")
                    self._sniffer = None
                    self._watched = None  # let an identical call retry

    def _filter(self, targets: dict[str, TargetAddrs]) -> str:
        """Box-bound frames from the gateway(s) or any watched device."""
        kids = sorted(m.lower() for m in targets)
        srcs = list(dict.fromkeys([*sorted(self.counter._gateways), *kids]))
        src_match = " or ".join(f"ether src {m}" for m in srcs)
        return f"ether dst {self.counter._box} and ({src_match})"

    def stop(self) -> None:
        with self._lock:
            self._closed = True
            self._stop_sniffer()

    def _stop_sniffer(self) -> None:
        if self._sniffer is not None:
            try:
                self._sniffer.stop()
            except Exception:
                log.debug("sniffer stop failed", exc_info=True)
            self._sniffer = None

    def _on_packet(self, pkt: Any) -> None:
        from scapy.layers.inet import IP
        from scapy.layers.inet6 import IPv6
        from scapy.layers.l2 import Ether

        if not pkt.haslayer(Ether):
            return
        if pkt.haslayer(IP):
            ip_dst, ip_src = pkt[IP].dst, pkt[IP].src
        elif pkt.haslayer(IPv6):
            ip_dst, ip_src = pkt[IPv6].dst, pkt[IPv6].src
        else:
            ip_dst = ip_src = None
        self.counter.observe(pkt[Ether].src, pkt[Ether].dst, ip_dst, ip_src)
