from blocker.arp import LanFacts
from blocker.resist import ResistanceCounter

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
