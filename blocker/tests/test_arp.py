"""ARP/NDP redirection tests. Pure builders asserted directly; loops use a fake sender."""

from __future__ import annotations

import threading
import time
from pathlib import Path

import pytest

pytest.importorskip("scapy")

from blocker.arp import (
    LanFacts,
    RedirectionManager,
    TargetAddrs,
    arp_reply,
    ndp_advert,
    redirect_packets,
    restore,
)
from blocker.config import Config

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
    gateway_mac6="cc:cc:cc:cc:cc:cc",  # v6 gateway MAC, distinct from v4
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


def _gw_nas(pkts):
    from scapy.all import ICMPv6ND_NA, IPv6

    return [p for p in pkts if p.haslayer(ICMPv6ND_NA) and p[IPv6].dst == LAN.gateway_ip6]


def test_kid_side_ndp_keeps_router_flag():
    from scapy.all import ICMPv6ND_NA, IPv6

    t = TargetAddrs(mac=DEV, ip6=("fe80::50",))
    kid = [p for p in redirect_packets(t, LAN) if p[IPv6].dst == "fe80::50"]
    assert len(kid) == 1 and kid[0][ICMPv6ND_NA].R == 1


def test_redirect_ndp_gateway_side_is_host_advert():
    from scapy.all import Ether, ICMPv6ND_NA, ICMPv6NDOptDstLLAddr

    t = TargetAddrs(mac=DEV, ip6=("fe80::50",))
    gw = _gw_nas(redirect_packets(t, LAN))
    assert len(gw) == 1
    p = gw[0]
    assert p[ICMPv6ND_NA].tgt == "fe80::50"
    assert p[ICMPv6ND_NA].R == 0
    assert p[ICMPv6NDOptDstLLAddr].lladdr == LAN.box_mac
    assert p[Ether].dst == LAN.gateway_mac6


def test_restore_ndp_gateway_heal_is_host_advert():
    from scapy.all import Ether, ICMPv6ND_NA, ICMPv6NDOptDstLLAddr

    t = TargetAddrs(mac=DEV, ip6=("fe80::50",))
    gw = _gw_nas(restore(t, LAN))
    assert len(gw) == 1
    p = gw[0]
    assert p[ICMPv6ND_NA].tgt == "fe80::50"
    assert p[ICMPv6ND_NA].R == 0
    assert p[ICMPv6NDOptDstLLAddr].lladdr == DEV
    assert p[Ether].dst == LAN.gateway_mac6


def test_redirect_spoofs_gateway_side():
    from scapy.all import ARP

    t = TargetAddrs(mac=DEV, ip="192.168.1.50")
    pkts = redirect_packets(t, LAN)
    gw = [
        p
        for p in pkts
        if p.haslayer(ARP) and p[ARP].pdst == LAN.gateway_ip and p[ARP].hwsrc == LAN.box_mac
    ]
    assert len(gw) == 1
    a = gw[0][ARP]
    assert a.pdst == LAN.gateway_ip
    assert a.hwdst == LAN.gateway_mac
    assert a.psrc == t.ip
    assert a.hwsrc == LAN.box_mac


def test_redirect_skips_gateway_side_when_gateway_mac_unknown():
    from dataclasses import replace

    from scapy.all import ARP

    lan = replace(LAN, gateway_mac=None, gateway_mac6=None)
    t = TargetAddrs(mac=DEV, ip="192.168.1.50", ip6=("fe80::50",))
    pkts = redirect_packets(t, lan)
    # kid-side reply still present, no packet addressed to the gateway
    assert any(p.haslayer(ARP) and p[ARP].pdst == t.ip for p in pkts)
    assert not any(p.haslayer(ARP) and p[ARP].pdst == lan.gateway_ip for p in pkts)


def test_restore_heals_gateway_side():
    from scapy.all import ARP

    t = TargetAddrs(mac=DEV, ip="192.168.1.50")
    pkts = restore(t, LAN)
    gw = [p for p in pkts if p.haslayer(ARP) and p[ARP].pdst == LAN.gateway_ip]
    assert len(gw) == 1
    assert gw[0][ARP].hwsrc == DEV  # truth: device IP is at the device MAC
    assert gw[0][ARP].psrc == t.ip


def test_restore_skips_gateway_side_when_gateway_mac_unknown():
    from dataclasses import replace

    lan = replace(LAN, gateway_mac=None, gateway_mac6=None)
    t = TargetAddrs(mac=DEV, ip="192.168.1.50", ip6=("fe80::50",))
    assert restore(t, lan) == []


def test_restore_sends_truth():
    from scapy.all import ARP, ICMPv6NDOptDstLLAddr

    t = TargetAddrs(mac=DEV, ip="192.168.1.50", ip6=("fe80::50",))
    pkts = restore(t, LAN)
    arp = next(p for p in pkts if p.haslayer(ARP))
    assert arp[ARP].hwsrc == LAN.gateway_mac  # truthful v4 gateway MAC, not the box
    na = next(p for p in pkts if p.haslayer(ICMPv6NDOptDstLLAddr))
    assert na[ICMPv6NDOptDstLLAddr].lladdr == LAN.gateway_mac6  # v6 MAC, not v4's


def test_restore_skips_heal_when_gateway_mac_unknown():
    # Unresolved gateway MACs must never be spoofed with a guess on restore,
    # or unblocking would itself poison the device's cache.
    from dataclasses import replace

    lan = replace(LAN, gateway_mac=None, gateway_mac6=None)
    t = TargetAddrs(mac=DEV, ip="192.168.1.50", ip6=("fe80::50",))
    assert restore(t, lan) == []


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


def test_stop_all_heals_repeatedly_and_never_spoofs_after(monkeypatch):
    # A lone restore can land inside the device's neighbor locktime and be
    # ignored, and a late loop spoof would re-poison: heal must repeat and be last.
    from blocker import arp
    from scapy.all import ARP

    monkeypatch.setattr(arp, "HEAL_INTERVAL", 0.01)
    fs = FakeSend()
    m = RedirectionManager(CFG, lan=LAN, send=fs, cadence=0.02)
    m.set_targets({DEV: TargetAddrs(mac=DEV, ip="192.168.1.50")})
    assert fs.event.wait(1.0)
    m.stop_all()  # blocks until healed
    is_truth = [
        any(p.haslayer(ARP) and p[ARP].hwsrc == LAN.gateway_mac for p in c) for c in fs.calls
    ]
    first = is_truth.index(True)
    assert all(is_truth[first:])
    assert len(is_truth) - first == arp.HEAL_ROUNDS


def test_unresolved_gateway_mac_is_redetected_before_heal(monkeypatch):
    # Boot-time ARP miss must not disable healing for the process lifetime.
    from dataclasses import replace

    from blocker import arp
    from scapy.all import ARP

    monkeypatch.setattr(arp, "HEAL_INTERVAL", 0.01)
    monkeypatch.setattr(arp, "REDETECT_INTERVAL", 0.0)
    results = [replace(LAN, gateway_mac=None), LAN]
    fs = FakeSend()
    m = RedirectionManager(
        CFG,
        send=fs,
        detect=lambda _cfg: results.pop(0) if len(results) > 1 else results[0],
        cadence=0.02,
    )
    assert m._lanfacts().gateway_mac is None
    m.set_targets({DEV: TargetAddrs(mac=DEV, ip="192.168.1.50")})
    assert fs.event.wait(1.0)
    m.stop_all()
    assert any(p.haslayer(ARP) and p[ARP].hwsrc == LAN.gateway_mac for p in fs.calls[-1])
