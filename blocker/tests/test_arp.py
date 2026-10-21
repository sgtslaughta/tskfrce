"""ARP/NDP redirection tests. Pure builders asserted directly; loops use a fake sender."""

from __future__ import annotations

import threading
import time
from pathlib import Path

import pytest

pytest.importorskip("scapy")

from blocker.arp import (  # noqa: E402
    LanFacts,
    RedirectionManager,
    TargetAddrs,
    arp_reply,
    ndp_advert,
    restore,
)
from blocker.config import Config  # noqa: E402

CFG = Config(
    backend_url="http://b",
    blocker_url_host="b",
    internal_token="t",
    lan_iface="",
    data_dir=Path("/tmp"),
)
LAN = LanFacts(
    gateway_ip="192.168.1.1",
    gateway_mac="aa:aa:aa:aa:aa:aa",
    box_mac="bb:bb:bb:bb:bb:bb",
    gateway_ip6="fe80::1",
)
DEV = "de:ad:be:ef:00:01"


class FakeSend:
    def __init__(self) -> None:
        self.calls: list[list] = []
        self.event = threading.Event()

    def __call__(self, pkts, iface) -> None:
        self.calls.append(pkts)
        self.event.set()


def test_arp_reply_fields():
    from scapy.all import ARP

    a = arp_reply("192.168.1.50", DEV, "192.168.1.1", "bb:bb:bb:bb:bb:bb")[ARP]
    assert a.op == 2
    assert a.psrc == "192.168.1.1"
    assert a.hwsrc == "bb:bb:bb:bb:bb:bb"
    assert a.pdst == "192.168.1.50"
    assert a.hwdst == DEV


def test_ndp_advert_fields():
    from scapy.all import ICMPv6ND_NA, ICMPv6NDOptDstLLAddr, IPv6

    p = ndp_advert("fe80::50", DEV, "fe80::1", "bb:bb:bb:bb:bb:bb")
    assert p[IPv6].src == "fe80::1"
    assert p[ICMPv6ND_NA].tgt == "fe80::1"
    assert p[ICMPv6NDOptDstLLAddr].lladdr == "bb:bb:bb:bb:bb:bb"


def test_restore_sends_truth():
    from scapy.all import ARP

    t = TargetAddrs(mac=DEV, ip="192.168.1.50", ip6=("fe80::50",))
    pkts = restore(t, LAN)
    arp = [p for p in pkts if p.haslayer(ARP)][0]
    assert arp[ARP].hwsrc == LAN.gateway_mac  # truthful gateway MAC, not the box


def test_set_targets_starts_and_stops_loops():
    from scapy.all import ARP

    fs = FakeSend()
    m = RedirectionManager(CFG, lan=LAN, send=fs, cadence=0.02)
    m.set_targets({DEV: TargetAddrs(mac=DEV, ip="192.168.1.50")})
    assert fs.event.wait(1.0)
    assert DEV in m._threads
    m.set_targets({})  # remove -> stop loop + heal
    time.sleep(0.1)
    assert DEV not in m._threads
    last = fs.calls[-1]
    assert any(p.haslayer(ARP) and p[ARP].hwsrc == LAN.gateway_mac for p in last)


def test_pending_target_without_ip_activates_on_update():
    fs = FakeSend()
    m = RedirectionManager(CFG, lan=LAN, send=fs, cadence=0.02)
    mac = "de:ad:be:ef:00:02"
    m.set_targets({mac: TargetAddrs(mac=mac)})  # no IP -> pending, no loop
    time.sleep(0.1)
    assert mac not in m._threads
    assert not fs.calls
    m.set_targets({mac: TargetAddrs(mac=mac, ip="192.168.1.51")})  # IP arrives
    assert fs.event.wait(1.0)
    assert mac in m._threads
    m.stop_all()
