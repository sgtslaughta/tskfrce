"""Orchestrator: wires discovery, state, firewall, redirection, portal and reconcile.

Policy-free. It only maps blocked MACs to currently-known IPs and applies the
result. The app owns all policy; this executes it and fails open on shutdown.
"""

from __future__ import annotations

import logging
import signal
import threading
import time
from collections.abc import Callable

from blocker import firewall as fw
from blocker.api import make_api
from blocker.arp import RedirectionManager, TargetAddrs
from blocker.backend import Seen, fetch_blocked
from blocker.config import Config
from blocker.discovery import run_discovery
from blocker.portal import run_dns, run_http
from blocker.state_store import StateStore

log = logging.getLogger(__name__)

# RFC1918 + link/unique-local: traffic between blocked device and the LAN stays allowed.
DEFAULT_LAN_CIDRS = [
    "192.168.0.0/16",
    "10.0.0.0/8",
    "172.16.0.0/12",
    "fe80::/10",
    "fc00::/7",
]
PORTAL_PORT = 80
PROBE_WAIT = 3.0


def _default_probe(ip: str | None) -> bool:
    """True if the host still answers a single ping. Never raises."""
    if not ip:
        return False
    import subprocess

    try:
        r = subprocess.run(["ping", "-c", "1", "-W", "1", ip], capture_output=True, timeout=5)
        return r.returncode == 0
    except Exception:
        return False


def _detect_box_ip(cfg: Config) -> str:
    try:
        from scapy.all import get_if_addr

        return get_if_addr(cfg.lan_iface or "eth0")
    except Exception:
        return ""


class Service:
    def __init__(
        self,
        cfg: Config,
        *,
        firewall=fw,
        redirection: RedirectionManager | None = None,
        fetch: Callable[[Config], list[str] | None] = fetch_blocked,
        probe: Callable[[str | None], bool] = _default_probe,
        sleep: Callable[[float], None] = time.sleep,
        lan_cidrs: list[str] | None = None,
        portal_ip: str | None = None,
    ) -> None:
        self.cfg = cfg
        self._fw = firewall
        self._redir = redirection or RedirectionManager(cfg)
        self._fetch = fetch
        self._probe = probe
        self._sleep = sleep
        self._lan_cidrs = lan_cidrs or DEFAULT_LAN_CIDRS
        self._portal_ip = portal_ip
        self.store = StateStore()
        self._devices: dict[str, TargetAddrs] = {}
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._api = None
        self.store.on_change(self._apply)

    # --- policy application -------------------------------------------------

    def _apply(self, _blocked: set[str] | None = None) -> None:
        # Serialize the whole compute -> apply -> set_targets under one lock and
        # re-read the authoritative set inside it, so concurrent callers
        # (on_change, reconcile, _on_seen) can't apply a stale ruleset last.
        with self._lock:
            blocked = self.store.current()
            devs = {m: self._devices.get(m, TargetAddrs(mac=m)) for m in blocked}
            v4 = {t.ip for t in devs.values() if t.ip}
            v6 = {ip for t in devs.values() for ip in t.ip6}
            macs = set(blocked)  # authoritative block key
            ruleset = fw.render_ruleset(
                v4, v6, macs, self._lan_cidrs, self._portal_ip or "", PORTAL_PORT
            )
            try:
                self._fw.apply(ruleset)
            except Exception:
                log.exception("firewall apply failed")
            self._redir.set_targets(devs)

    def _on_seen(self, seen: Seen) -> None:
        with self._lock:
            self._devices[seen.mac] = TargetAddrs(mac=seen.mac, ip=seen.ip, ip6=tuple(seen.ipv6))
        if seen.mac in self.store.current():
            self._apply(self.store.current())

    # --- reconcile (poll heals missed pushes) -------------------------------

    def _reconcile_once(self) -> None:
        fetched = self._fetch(self.cfg)
        if fetched is not None:  # None = app unreachable -> keep last set
            self.store.set_blocked(fetched)

    def _reconcile_loop(self) -> None:
        while not self._stop.wait(self.cfg.reconcile_interval):
            try:
                self._reconcile_once()
            except Exception:
                log.exception("reconcile failed")

    # --- diagnostics --------------------------------------------------------

    def test_block(self, mac: str) -> dict:
        """Briefly block one MAC, probe it, restore prior state. Plain-language result."""
        mac = mac.lower()
        prior = self.store.current()
        with self._lock:
            ip = (self._devices.get(mac) or TargetAddrs(mac=mac)).ip
        # Add to the live set, never replace it — a diagnostic on one device must
        # not lift enforcement on every other blocked device during the probe.
        self.store.set_blocked(sorted(prior | {mac}))
        self._sleep(PROBE_WAIT)
        online = self._probe(ip) if ip else False
        self.store.set_blocked(sorted(prior))
        if ip is None:
            message = "We haven't seen this device on the network yet, so we couldn't test it."
        elif online:
            message = (
                "The device stayed online. Your router may be ignoring the block — "
                "some routers resist this."
            )
        else:
            message = "Success — the device lost internet access while blocked."
        return {"offline": not online, "router_resisted": bool(online), "message": message}

    # --- lifecycle ----------------------------------------------------------

    def start(self) -> None:
        if self._portal_ip is None:
            self._portal_ip = _detect_box_ip(self.cfg)
        try:
            self._fw.enable_forwarding()
        except Exception:
            log.exception("enable_forwarding failed")
        self._spawn(self._reconcile_loop)
        self._spawn(lambda: run_discovery(self.cfg, self._stop, self._on_seen))
        self._spawn(lambda: run_dns(self.cfg, self._portal_ip or "", self._stop))
        self._spawn(lambda: run_http(self.cfg, self._stop))
        self._api = make_api(
            self.store,
            self.cfg.internal_token,
            self.test_block,
            "127.0.0.1",
            self.cfg.blocker_port,
        )
        self._spawn(self._api.serve_forever)

    def _spawn(self, target: Callable[[], None]) -> None:
        threading.Thread(target=target, daemon=True).start()

    def run(self) -> None:
        self.start()
        self._stop.wait()

    def stop(self) -> None:
        self._stop.set()
        try:
            self._redir.stop_all()
        except Exception:
            log.exception("redirection restore failed")
        finally:
            try:
                self._fw.flush()  # fail open
            except Exception:
                log.exception("firewall flush failed")
        if self._api is not None:
            try:
                self._api.shutdown()
            except Exception:
                pass


def main() -> None:
    import os

    logging.basicConfig(level=logging.INFO)
    cfg = Config.from_env(os.environ)
    svc = Service(cfg)
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: svc.stop())
    svc.run()
