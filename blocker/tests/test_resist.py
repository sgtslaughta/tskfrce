from types import SimpleNamespace

import pytest

from blocker.arp import LanFacts
from blocker.resist import ResistanceCounter, ResistanceWatch

LAN = LanFacts(gateway_ip="10.0.0.1", gateway_mac="aa:aa:aa:aa:aa:01", box_mac="bb:bb:bb:bb:bb:02")
KID = "cc:cc:cc:cc:cc:03"


def _counter(**kw):
    t = [100.0]
    c = ResistanceCounter(LAN, threshold=3, window=30, clock=lambda: t[0], **kw)
    c.set_watched({KID})
    return c, t


def test_idle_device_is_not_resisting():
    c, _ = _counter()
    assert c.resisting() == set()


def test_frames_to_gateway_reach_threshold():
    c, _ = _counter()
    for _ in range(3):
        c.observe(KID, LAN.gateway_mac)
    assert c.resisting() == {KID}
    assert c.tally(KID).to_gateway == 3


def test_frames_to_box_do_not_count_as_resisting():
    c, _ = _counter()
    for _ in range(5):
        c.observe(KID, LAN.box_mac)
    assert c.resisting() == set()
    assert c.tally(KID).to_box == 5


def test_window_resets_counts():
    c, t = _counter()
    c.observe(KID, LAN.gateway_mac)
    c.observe(KID, LAN.gateway_mac)
    t[0] += 31
    c.observe(KID, LAN.gateway_mac)
    assert c.tally(KID).to_gateway == 1


def test_unwatched_src_ignored_and_unwatch_drops_tally():
    c, _ = _counter()
    c.observe("dd:dd:dd:dd:dd:04", LAN.gateway_mac)
    assert c.tally("dd:dd:dd:dd:dd:04").to_gateway == 0
    c.observe(KID, LAN.gateway_mac)
    c.set_watched(set())
    assert c.tally(KID).to_gateway == 0


def test_unknown_gateway_mac_never_flags():
    lan = LanFacts(gateway_ip="10.0.0.1", gateway_mac=None, box_mac=LAN.box_mac)
    c = ResistanceCounter(lan, threshold=1)
    c.set_watched({KID})
    c.observe(KID, "aa:aa:aa:aa:aa:01")
    assert c.resisting() == set()


def test_mac_case_insensitive():
    c, _ = _counter()
    for _ in range(3):
        c.observe(KID.upper(), LAN.gateway_mac.upper())
    assert c.resisting() == {KID}


def test_watch_restarts_sniffer_with_mac_filter():
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
    w.set_watched({KID, "dd:dd:dd:dd:dd:04"})
    assert calls[-1]["iface"] == "eth0"
    assert calls[-1]["filter"] == f"ether src {KID} or ether src dd:dd:dd:dd:dd:04"
    w.set_watched(set())
    assert w._sniffer is None


def test_watch_prn_feeds_counter():
    pytest.importorskip("scapy")
    from scapy.layers.l2 import Ether

    captured = {}
    counter = ResistanceCounter(LAN, threshold=1)
    w = ResistanceWatch(
        SimpleNamespace(lan_iface=""),
        counter,
        sniffer_factory=lambda **kw: captured.update(kw) or SimpleNamespace(stop=lambda: None),
    )
    w.set_watched({KID})
    captured["prn"](Ether(src=KID, dst=LAN.gateway_mac))
    assert counter.resisting() == {KID}


def _watch(factory):
    return ResistanceWatch(
        SimpleNamespace(lan_iface=""), ResistanceCounter(LAN), sniffer_factory=factory
    )


def test_watch_survives_factory_error():
    def boom(**kw):
        raise OSError("no iface")

    w = _watch(boom)
    w.set_watched({KID})
    assert w._sniffer is None


def test_watch_same_set_does_not_restart():
    calls = []
    w = _watch(lambda **kw: calls.append(kw) or SimpleNamespace(stop=lambda: None))
    w.set_watched({KID})
    w.set_watched({KID})
    assert len(calls) == 1


def test_watch_no_start_after_stop():
    calls = []
    w = _watch(lambda **kw: calls.append(kw) or SimpleNamespace(stop=lambda: None))
    w.stop()
    w.set_watched({KID})
    assert calls == []


def test_watch_retries_after_failed_start():
    calls = []

    def flaky(**kw):
        calls.append(kw)
        if len(calls) == 1:
            raise OSError("iface down")
        return SimpleNamespace(stop=lambda: None)

    w = _watch(flaky)
    w.set_watched({KID})
    w.set_watched({KID})
    assert len(calls) == 2
    assert w._sniffer is not None
