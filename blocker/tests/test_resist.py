from types import SimpleNamespace

import pytest

from blocker.arp import LanFacts, TargetAddrs
from blocker.resist import ResistanceCounter, ResistanceWatch

LAN = LanFacts(gateway_ip="10.0.0.1", gateway_mac="aa:aa:aa:aa:aa:01", box_mac="bb:bb:bb:bb:bb:02")
KID = "cc:cc:cc:cc:cc:03"
KID_IP = "10.0.0.5"
KID_IP6 = "fe80::5"
WATCHED = {KID: TargetAddrs(mac=KID, ip=KID_IP, ip6=(KID_IP6,))}
GW = LAN.gateway_mac
BOX = LAN.box_mac
INET = "203.0.113.9"  # internet source (outside any LAN cidr used here)
INET6 = "2001:db8::9"
LAN_CIDRS = ["10.0.0.0/8", "fe80::/10"]


def _counter(watched=WATCHED, **kw):
    t = [100.0]
    c = ResistanceCounter(LAN, threshold=3, window=30, clock=lambda: t[0], **kw)
    c.set_watched(watched)
    return c, t


def test_idle_device_is_not_resisting():
    c, _ = _counter()
    assert c.resisting() == set()


def test_gateway_return_traffic_reaches_threshold():
    c, _ = _counter()
    for _ in range(3):
        c.observe(GW, BOX, KID_IP, INET)
    assert c.resisting() == {KID}
    assert c.tally(KID).from_gateway == 3


def test_gateway_return_traffic_matches_v6_dst():
    c, _ = _counter()
    for _ in range(3):
        c.observe(GW, BOX, KID_IP6, INET6)
    assert c.resisting() == {KID}


def test_v6_noncanonical_dst_still_maps():
    c, _ = _counter()
    noncanonical = "fe80:0000:0000:0000:0000:0000:0000:0005"
    for _ in range(3):
        c.observe(GW, BOX, noncanonical, INET6)
    assert c.resisting() == {KID}


def test_lan_sourced_return_traffic_never_flags():
    # Another LAN host reaching the device (e.g. a printer) must not look like a bypass.
    c, _ = _counter(lan_cidrs=LAN_CIDRS)
    for _ in range(5):
        c.observe(GW, BOX, KID_IP, "10.0.0.7")
    assert c.resisting() == set()
    assert c.tally(KID).from_gateway == 0


def test_internet_sourced_return_traffic_flags_with_lan_cidrs():
    c, _ = _counter(lan_cidrs=LAN_CIDRS)
    for _ in range(3):
        c.observe(GW, BOX, KID_IP, INET)
    assert c.resisting() == {KID}


def test_missing_ip_src_does_not_flag():
    c, _ = _counter()
    for _ in range(5):
        c.observe(GW, BOX, KID_IP)  # no ip_src -> cannot be the internet-return signal
    assert c.resisting() == set()


def test_device_frames_to_box_do_not_flag():
    c, _ = _counter()
    for _ in range(5):
        c.observe(KID, BOX)
    assert c.resisting() == set()
    assert c.tally(KID).to_box == 5
    assert c.tally(KID).from_gateway == 0


def test_gateway_to_unwatched_ip_ignored():
    c, _ = _counter()
    c.observe(GW, BOX, "10.0.0.99", INET)
    assert c.resisting() == set()
    assert c.tally(KID).from_gateway == 0


def test_frames_not_to_box_ignored():
    c, _ = _counter()
    # gateway talking to the kid directly (not the box) is not our signal
    c.observe(GW, "ee:ee:ee:ee:ee:ee", KID_IP, INET)
    assert c.tally(KID).from_gateway == 0


def test_window_resets_counts():
    c, t = _counter()
    c.observe(GW, BOX, KID_IP, INET)
    c.observe(GW, BOX, KID_IP, INET)
    t[0] += 31
    c.observe(GW, BOX, KID_IP, INET)
    assert c.tally(KID).from_gateway == 1


def test_unwatch_drops_tally():
    c, _ = _counter()
    c.observe(GW, BOX, KID_IP, INET)
    c.set_watched({})
    assert c.tally(KID).from_gateway == 0


def test_unknown_gateway_mac_never_flags():
    lan = LanFacts(gateway_ip="10.0.0.1", gateway_mac=None, box_mac=LAN.box_mac)
    c = ResistanceCounter(lan, threshold=1)
    c.set_watched(WATCHED)
    c.observe("aa:aa:aa:aa:aa:01", lan.box_mac, KID_IP, INET)
    assert c.resisting() == set()


def test_mac_and_ip_case_insensitive():
    c, _ = _counter()
    for _ in range(3):
        c.observe(GW.upper(), BOX.upper(), KID_IP.upper(), INET)
    assert c.resisting() == {KID}


def test_watch_restarts_sniffer_with_box_and_src_filter():
    calls = []

    class FakeSniffer:
        def __init__(self, **kw):
            calls.append(kw)

        def stop(self):
            pass

    counter = ResistanceCounter(LAN)
    w = ResistanceWatch(
        SimpleNamespace(lan_iface="eth0"), counter, sniffer_factory=lambda **kw: FakeSniffer(**kw)
    )
    w.set_watched(WATCHED)
    assert calls[-1]["iface"] == "eth0"
    assert calls[-1]["filter"] == (
        f"ether dst {BOX} and (ether src {GW.lower()} or ether src {KID})"
    )
    w.set_watched({})
    assert w._sniffer is None


def test_watch_prn_feeds_counter():
    pytest.importorskip("scapy")
    from scapy.layers.inet import IP
    from scapy.layers.l2 import Ether

    captured = {}
    counter = ResistanceCounter(LAN, threshold=1)
    w = ResistanceWatch(
        SimpleNamespace(lan_iface=""),
        counter,
        sniffer_factory=lambda **kw: captured.update(kw) or SimpleNamespace(stop=lambda: None),
    )
    w.set_watched(WATCHED)
    captured["prn"](Ether(src=GW, dst=BOX) / IP(src=INET, dst=KID_IP))
    assert counter.resisting() == {KID}


def _watch(factory):
    return ResistanceWatch(
        SimpleNamespace(lan_iface=""), ResistanceCounter(LAN), sniffer_factory=factory
    )


def test_watch_survives_factory_error():
    def boom(**kw):
        raise OSError("no iface")

    w = _watch(boom)
    w.set_watched(WATCHED)
    assert w._sniffer is None


def test_watch_same_set_does_not_restart():
    calls = []
    w = _watch(lambda **kw: calls.append(kw) or SimpleNamespace(stop=lambda: None))
    w.set_watched(WATCHED)
    w.set_watched(dict(WATCHED))
    assert len(calls) == 1


def test_watch_no_start_after_stop():
    calls = []
    w = _watch(lambda **kw: calls.append(kw) or SimpleNamespace(stop=lambda: None))
    w.stop()
    w.set_watched(WATCHED)
    assert calls == []


def test_watch_retries_after_failed_start():
    calls = []

    def flaky(**kw):
        calls.append(kw)
        if len(calls) == 1:
            raise OSError("iface down")
        return SimpleNamespace(stop=lambda: None)

    w = _watch(flaky)
    w.set_watched(WATCHED)
    w.set_watched(WATCHED)
    assert len(calls) == 2
    assert w._sniffer is not None
