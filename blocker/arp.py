"""ARP + NDP redirection.

Make a blocked device send its gateway-bound traffic to this box instead of the
real router, by lying about who owns the gateway's address. Pure packet builders
(easy to assert in tests); the only impure seam is an injected ``send``.
Removing a target heals the device's cache with the truthful mapping.
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Callable
from dataclasses import dataclass

log = logging.getLogger(__name__)

DEFAULT_CADENCE = 2.0


@dataclass(frozen=True)
class TargetAddrs:
    """A device's known addresses. ``ip`` None means pending (no loop yet)."""

    mac: str
    ip: str | None = None
    ip6: tuple[str, ...] = ()


@dataclass(frozen=True)
class LanFacts:
    """Facts about the LAN, gathered by injectable helpers (tests don't touch the kernel).

    gateway_mac / gateway_mac6 are the gateway's *real* MACs, used only to heal a
    device's cache on restore. None means we could not resolve it truthfully, so
    that family's heal is skipped (never spoofed with a guess) — natural cache
    expiry recovers it instead.
    """

    gateway_ip: str
    gateway_mac: str | None
    box_mac: str
    gateway_ip6: str | None = None
    gateway_mac6: str | None = None


def _active(t: TargetAddrs | None) -> bool:
    return bool(t and (t.ip or t.ip6))


def arp_reply(target_ip: str, target_mac: str, gateway_ip: str, box_mac: str):
    """Unsolicited ARP reply telling target that gateway_ip is at box_mac."""
    from scapy.all import ARP, Ether

    return Ether(dst=target_mac) / ARP(
        op=2, psrc=gateway_ip, hwsrc=box_mac, pdst=target_ip, hwdst=target_mac
    )


def ndp_advert(target_ip6: str, target_mac: str, gateway_ip6: str, box_mac: str):
    """Neighbor Advertisement telling target that gateway_ip6 is at box_mac."""
    from scapy.all import ICMPv6ND_NA, ICMPv6NDOptDstLLAddr, Ether, IPv6

    na = ICMPv6ND_NA(tgt=gateway_ip6, R=1, S=0, O=1) / ICMPv6NDOptDstLLAddr(lladdr=box_mac)
    return Ether(dst=target_mac) / IPv6(src=gateway_ip6, dst=target_ip6) / na


def redirect_packets(target: TargetAddrs, lan: LanFacts) -> list:
    """Spoofed packets that point the target at this box (lladdr = box_mac)."""
    pkts = []
    if target.ip:
        pkts.append(arp_reply(target.ip, target.mac, lan.gateway_ip, lan.box_mac))
    if lan.gateway_ip6:
        for ip6 in target.ip6:
            pkts.append(ndp_advert(ip6, target.mac, lan.gateway_ip6, lan.box_mac))
    return pkts


def restore(target: TargetAddrs, lan: LanFacts) -> list:
    """Truthful mappings so the device relearns the real gateway MAC.

    A family is healed only when the gateway's real MAC for it is known; otherwise
    the heal is skipped (never sent with a guessed/broadcast MAC, which would itself
    poison the cache and break the device after unblock). The device's own cache
    timeout recovers the truth in that case.
    """
    from scapy.all import ARP, Ether

    pkts = []
    if target.ip and lan.gateway_mac:
        pkts.append(
            Ether(dst=target.mac)
            / ARP(
                op=2,
                psrc=lan.gateway_ip,
                hwsrc=lan.gateway_mac,
                pdst=target.ip,
                hwdst=target.mac,
            )
        )
    if lan.gateway_ip6 and lan.gateway_mac6:
        for ip6 in target.ip6:
            # truth: advertise the v6 gateway's real MAC, resolved separately from v4
            pkts.append(ndp_advert(ip6, target.mac, lan.gateway_ip6, lan.gateway_mac6))
    return pkts


def _real_sendp(pkts: list, iface: str | None) -> None:
    if not pkts:
        return
    from scapy.all import sendp

    sendp(pkts, iface=iface, verbose=0)


def _detect_gateway_ip6(cfg) -> str | None:
    """The v6 default-route next hop (the router address a device points at), on
    the LAN interface only.

    Returning it lets NDP redirection run so a blocked device cannot simply use
    IPv6 to route around the v4-only ARP block. None when the box has no v6 uplink
    on the LAN side — then v6 can't be intercepted from a spoofing sidecar at all
    (see docs/blocker.md: disable IPv6 at the router for airtight blocking). We pin
    to cfg.lan_iface so we never pick up a gateway on the container's WAN side."""
    try:
        from scapy.all import conf

        iface, _src, nh = conf.route6.route("2000::")
        if cfg.lan_iface and iface != cfg.lan_iface:
            return None
        if isinstance(nh, list):
            nh = nh[0] if nh else None
        return nh if nh and nh != "::" else None
    except Exception:
        return None


def detect_lan(cfg) -> LanFacts:
    """Best-effort LAN facts from scapy. Production only; tests inject LanFacts."""
    from scapy.all import conf, get_if_hwaddr, getmacbyip
    from scapy.layers.inet6 import getmacbyip6

    iface = cfg.lan_iface or conf.iface
    gw = conf.route.route("0.0.0.0")[2]
    box_mac = get_if_hwaddr(iface)
    # Real gateway MACs for healing. None (unresolved) => that family's heal is
    # skipped; never substitute a broadcast/guess, which would poison the cache.
    gw_mac = getmacbyip(gw) or None
    gw_ip6 = _detect_gateway_ip6(cfg)
    gw_mac6 = None
    if gw_ip6:
        try:
            gw_mac6 = getmacbyip6(gw_ip6) or None
        except Exception:
            gw_mac6 = None
    return LanFacts(
        gateway_ip=gw,
        gateway_mac=gw_mac,
        box_mac=box_mac,
        gateway_ip6=gw_ip6,
        gateway_mac6=gw_mac6,
    )


class RedirectionManager:
    """One re-send loop per active (blocked + known-IP) device; heals on removal."""

    def __init__(
        self,
        cfg,
        *,
        lan: LanFacts | None = None,
        send: Callable[[list, str | None], None] = _real_sendp,
        detect: Callable = detect_lan,
        cadence: float = DEFAULT_CADENCE,
    ) -> None:
        self.cfg = cfg
        self._lan = lan
        self._send = send
        self._detect = detect
        self.cadence = cadence
        self._lock = threading.Lock()
        self._targets: dict[str, TargetAddrs] = {}
        self._stops: dict[str, threading.Event] = {}
        self._threads: dict[str, threading.Thread] = {}

    def _lanfacts(self) -> LanFacts:
        if self._lan is None:
            self._lan = self._detect(self.cfg)
        return self._lan

    def set_targets(self, targets: dict[str, TargetAddrs]) -> None:
        with self._lock:
            new = dict(targets)
            for mac in list(self._threads):
                if not _active(new.get(mac)):
                    self._stop_one(mac)  # reads old self._targets for the heal
            self._targets = new
            for mac, t in new.items():
                if _active(t) and mac not in self._threads:
                    self._start_one(mac)

    def stop_all(self) -> None:
        self.set_targets({})

    def _start_one(self, mac: str) -> None:
        stop = threading.Event()
        self._stops[mac] = stop
        t = threading.Thread(target=self._loop, args=(mac, stop), daemon=True)
        self._threads[mac] = t
        t.start()

    def _stop_one(self, mac: str) -> None:
        ev = self._stops.pop(mac, None)
        if ev:
            ev.set()
        self._threads.pop(mac, None)
        target = self._targets.get(mac)
        if target:
            try:
                self._send(restore(target, self._lanfacts()), self.cfg.lan_iface or None)
            except Exception:
                log.exception("restore failed for %s", mac)

    def _loop(self, mac: str, stop: threading.Event) -> None:
        lan = self._lanfacts()
        while not stop.is_set():
            target = self._targets.get(mac)
            if target:
                try:
                    self._send(redirect_packets(target, lan), self.cfg.lan_iface or None)
                except Exception:
                    log.exception("redirect send failed for %s", mac)
            stop.wait(self.cadence)
