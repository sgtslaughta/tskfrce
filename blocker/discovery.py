"""LAN device discovery: ARP + NDP sweep, reported to the backend."""

from __future__ import annotations

import logging
import random
import socket
import threading
from collections.abc import Callable
from types import SimpleNamespace

from blocker.backend import Seen, report_seen
from blocker.config import Config
from blocker.identity import vendor_for

log = logging.getLogger(__name__)

MAX_IPV6 = 8
MAX_STR = 255


def resolve_hostname(ip: str) -> str | None:
    """Best-effort reverse DNS. Never raises."""
    try:
        return socket.gethostbyaddr(ip)[0] or None
    except Exception:
        return None


def _scapy_send(kind: str, cfg: Config):
    """Real scapy I/O. Returns (answered, unanswered) where answered holds
    (sent, rcv) pairs and rcv exposes `.ip` and `.mac`."""
    from scapy.all import ARP, Ether, IPv6, ICMPv6EchoRequest, get_if_addr, srp

    iface = cfg.lan_iface or None
    if kind == "arp":
        net = ".".join(get_if_addr(iface or "eth0").split(".")[:3]) + ".0/24"
        pkt = Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(pdst=net)
        ans, unans = srp(pkt, iface=iface, timeout=2, verbose=0)
        return [(s, SimpleNamespace(ip=r[ARP].psrc, mac=r[ARP].hwsrc)) for s, r in ans], unans
    pkt = Ether(dst="33:33:00:00:00:01") / IPv6(dst="ff02::1") / ICMPv6EchoRequest()
    ans, unans = srp(pkt, iface=iface, timeout=2, multi=True, verbose=0)
    return [(s, SimpleNamespace(ip=r[IPv6].src, mac=r[Ether].src)) for s, r in ans], unans


def _norm(mac: str) -> str:
    return mac.lower()


def scan_once(
    cfg: Config,
    send: Callable = _scapy_send,
    resolve: Callable[[str], str | None] = resolve_hostname,
) -> list[Seen]:
    v4: dict[str, str] = {}
    for _, rcv in send("arp", cfg)[0]:
        v4[_norm(rcv.mac)] = rcv.ip
    v6: dict[str, list[str]] = {}
    try:
        for _, rcv in send("ndp", cfg)[0]:
            addrs = v6.setdefault(_norm(rcv.mac), [])
            if rcv.ip not in addrs:
                addrs.append(rcv.ip)
    except Exception as e:
        log.warning("ndp sweep failed: %s", e)
    seen_list = []
    for mac, ip in v4.items():
        hostname = resolve(ip)
        vendor = vendor_for(mac)
        seen = Seen(
            mac=mac,
            ip=ip,
            ipv6=v6.get(mac, [])[:MAX_IPV6],
            hostname=hostname[:MAX_STR] if hostname else hostname,
            vendor=vendor[:MAX_STR] if vendor else vendor,
        )
        report_seen(cfg, seen)
        seen_list.append(seen)
    return seen_list


def run_discovery(
    cfg: Config, stop: threading.Event, on_seen: Callable[[Seen], None] | None = None
) -> None:
    while not stop.is_set():
        try:
            for seen in scan_once(cfg):
                if on_seen:
                    on_seen(seen)
        except Exception as e:
            log.warning("scan failed: %s", e)
        stop.wait(cfg.scan_interval + random.uniform(0, min(2.0, cfg.scan_interval * 0.1)))
