"""Service orchestrator tests. Fakes for firewall, redirection, backend, watch."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from blocker.arp import TargetAddrs
from blocker.backend import Seen
from blocker.config import Config
from blocker.resist import Tally
from blocker.service import ADDR_TTL, TEST_MESSAGES, Service

CFG = Config(
    backend_url="http://b",
    blocker_url_host="b",
    internal_token="t",
    lan_iface="",
    data_dir=Path("/tmp"),
)
MAC = "de:ad:be:ef:00:01"


class FakeFirewall:
    def __init__(self) -> None:
        self.applied: list[str] = []
        self.flushed = False
        self.forwarding = False

    def render_ruleset(self, *a, **k):  # unused (service calls the real pure fn)
        raise AssertionError

    def apply(self, ruleset: str) -> None:
        self.applied.append(ruleset)

    def flush(self) -> None:
        self.flushed = True

    def enable_forwarding(self) -> None:
        self.forwarding = True


class FakeRedir:
    def __init__(self) -> None:
        self.targets: dict = {}
        self.stopped = False

    def set_targets(self, targets) -> None:
        self.targets = dict(targets)

    def stop_all(self) -> None:
        self.stopped = True


def _svc(**kw) -> tuple[Service, FakeFirewall, FakeRedir]:
    fw = FakeFirewall()
    redir = FakeRedir()
    svc = Service(
        CFG, firewall=fw, redirection=redir, sleep=lambda *_: None, portal_ip="192.168.1.2", **kw
    )
    return svc, fw, redir


def test_on_change_recomputes_and_applies():
    svc, fw, redir = _svc()
    svc._on_seen(Seen(mac=MAC, ip="192.168.1.50", ipv6=[], hostname=None, vendor=None))
    svc.store.set_blocked([MAC])
    assert "192.168.1.50" in fw.applied[-1]
    assert redir.targets[MAC].ip == "192.168.1.50"


MAC2 = "de:ad:be:ef:00:02"


def _seen(mac, ip, v6=()):
    return Seen(mac=mac, ip=ip, ipv6=list(v6), hostname=None, vendor=None)


def test_stale_address_kept_without_claimant():
    t = [0.0]
    svc, fw, redir = _svc(clock=lambda: t[0])
    svc._on_seen(_seen(MAC, "192.168.1.50"))
    svc.store.set_blocked([MAC])
    t[0] = ADDR_TTL + 1
    svc._apply()
    assert "192.168.1.50" in fw.applied[-1]
    assert redir.targets[MAC].ip == "192.168.1.50"


def test_stale_address_dropped_when_other_mac_claims_it():
    t = [0.0]
    svc, fw, redir = _svc(clock=lambda: t[0])
    svc._on_seen(_seen(MAC, "192.168.1.50", ["fe80::1", "fe80::2"]))
    svc.store.set_blocked([MAC])
    t[0] = ADDR_TTL + 1
    svc._on_seen(_seen(MAC2, "192.168.1.50", ["fe80::2"]))
    svc._apply()
    assert "192.168.1.50" not in fw.applied[-1]
    assert MAC in fw.applied[-1]
    assert redir.targets[MAC].ip is None
    assert redir.targets[MAC].ip6 == ("fe80::1",)
    svc._on_seen(_seen(MAC, "192.168.1.50"))  # re-seen: address comes back
    assert redir.targets[MAC].ip == "192.168.1.50"


def test_untimestamped_device_is_stale_but_keeps_unclaimed_address():
    svc, fw, redir = _svc(clock=lambda: 1.0)
    svc._devices[MAC] = TargetAddrs(mac=MAC, ip="192.168.1.50")
    svc.store.set_blocked([MAC])
    assert redir.targets[MAC].ip == "192.168.1.50"
    svc._on_seen(_seen(MAC2, "192.168.1.50"))
    svc._apply()
    assert redir.targets[MAC].ip is None


def test_fresh_address_collision_still_enforced():
    t = [0.0]
    svc, fw, redir = _svc(clock=lambda: t[0])
    svc._on_seen(_seen(MAC, "192.168.1.50"))
    svc.store.set_blocked([MAC])
    t[0] = 5.0
    svc._on_seen(_seen(MAC2, "192.168.1.50"))
    svc._apply()  # MAC2 is unblocked, so its sighting alone doesn't re-apply
    assert redir.targets[MAC].ip == "192.168.1.50"
    assert "192.168.1.50" in fw.applied[-1]


def test_blocked_mac_without_ip_is_pending_then_enforced_when_seen():
    svc, fw, redir = _svc()
    svc.store.set_blocked([MAC])  # no device info yet -> pending
    assert "192.168.1.50" not in fw.applied[-1]
    assert redir.targets[MAC].ip is None
    svc._on_seen(Seen(mac=MAC, ip="192.168.1.50", ipv6=[], hostname=None, vendor=None))
    assert "192.168.1.50" in fw.applied[-1]
    assert redir.targets[MAC].ip == "192.168.1.50"


def test_reconcile_applies_fetched_set():
    svc, fw, redir = _svc(fetch=lambda cfg: [MAC])
    svc._reconcile_once()
    assert svc.store.current() == {MAC}
    assert redir.targets.get(MAC) is not None


def test_reconcile_keeps_last_set_when_app_unreachable():
    svc, fw, redir = _svc(fetch=lambda cfg: None)
    svc.store.set_blocked([MAC])
    svc._reconcile_once()  # fetch returns None -> no change
    assert svc.store.current() == {MAC}


def _watch(from_gateway=0, to_box=0, resets=None):
    return SimpleNamespace(
        set_watched=lambda m: None,
        stop=lambda: None,
        counter=SimpleNamespace(
            resisting=lambda: set(),
            reset=(resets.append if resets is not None else lambda m: None),
            tally=lambda mac: Tally(from_gateway=from_gateway, to_box=to_box),
        ),
    )


@pytest.mark.parametrize(
    "from_gateway,to_box,reason,offline,router_resisted",
    [
        (4, 0, "device", True, False),  # internet return traffic -> device dodging
        (0, 4, "ok", True, False),  # traffic to the box -> block working
        (0, 0, "quiet", False, True),  # saw nothing -> inconclusive / maybe router
    ],
)
def test_test_block_reason(from_gateway, to_box, reason, offline, router_resisted):
    svc, fw, redir = _svc(watch=_watch(from_gateway, to_box))
    svc._on_seen(Seen(mac=MAC, ip="192.168.1.50", ipv6=[], hostname=None, vendor=None))
    r = svc.test_block(MAC)
    assert r["reason"] == reason
    assert r["message"] == TEST_MESSAGES[reason]
    assert r["offline"] is offline
    assert r["router_resisted"] is router_resisted
    assert svc.store.current() == set()  # prior state restored


def test_test_block_unseen():
    svc, fw, redir = _svc(watch=_watch(0, 0))  # device never seen -> no ip
    r = svc.test_block(MAC)
    assert r["reason"] == "unseen"
    assert r["offline"] is False
    assert r["router_resisted"] is False


def test_test_block_preserves_other_blocks():
    svc, fw, redir = _svc(watch=_watch(0, 0))
    other = "aa:bb:cc:dd:ee:ff"
    svc._on_seen(Seen(mac=other, ip="192.168.1.9", ipv6=[], hostname=None, vendor=None))
    svc._on_seen(Seen(mac=MAC, ip="192.168.1.50", ipv6=[], hostname=None, vendor=None))
    svc.store.set_blocked([other])
    n = len(fw.applied)
    svc.test_block(MAC)
    assert svc.store.current() == {other}  # other device still blocked afterwards
    # and it is never dropped from enforcement during the diagnostic
    assert all(other in r for r in fw.applied[n:])


def _probe_svc(prior, during=None, boom=False):
    svc, fw, redir = _svc(watch=_watch(0, 4))
    for m, ip in ((MAC, "192.168.1.50"), ("aa:bb:cc:dd:ee:ff", "192.168.1.9")):
        svc._on_seen(Seen(mac=m, ip=ip, ipv6=[], hostname=None, vendor=None))
    svc.store.set_blocked(prior)

    def sleep(_):
        if during is not None:
            svc.store.set_blocked(during)
        if boom:
            raise RuntimeError("x")

    svc._sleep = sleep
    return svc, fw


def test_test_block_keeps_push_made_during_probe():
    other = "aa:bb:cc:dd:ee:ff"
    svc, fw = _probe_svc([], during=[other])
    svc.test_block(MAC)
    assert svc.store.current() == {other}
    assert other in fw.applied[-1] and MAC not in fw.applied[-1]


def test_test_block_keeps_already_blocked_mac():
    svc, fw = _probe_svc([MAC])
    svc.test_block(MAC)
    assert svc.store.current() == {MAC}
    assert MAC in fw.applied[-1]


def test_test_block_exception_clears_probing():
    svc, fw = _probe_svc([], boom=True)
    with pytest.raises(RuntimeError):
        svc.test_block(MAC)
    assert svc._probing == set()
    assert MAC not in fw.applied[-1]


def test_duplicate_ip_still_enforced_for_blocked_mac():
    svc, fw, redir = _svc()
    other = "aa:bb:cc:dd:ee:ff"
    svc._on_seen(Seen(mac=other, ip="192.168.1.50", ipv6=[], hostname=None, vendor=None))
    svc._on_seen(Seen(mac=MAC, ip="192.168.1.50", ipv6=[], hostname=None, vendor=None))
    svc.store.set_blocked([MAC])
    assert "192.168.1.50" in fw.applied[-1]
    assert redir.targets[MAC].ip == "192.168.1.50"


def test_test_block_resets_tally_before_wait():
    resets: list = []
    svc, fw, redir = _svc(watch=_watch(0, 4, resets))
    svc._on_seen(Seen(mac=MAC, ip="192.168.1.50", ipv6=[], hostname=None, vendor=None))
    svc.test_block(MAC)
    assert resets == [MAC]


@pytest.mark.parametrize("gw6", [None, "cc:cc:cc:cc:cc:cc", "boom"])
def test_test_block_ok_with_ip6_needs_gateway_mac6(gw6):
    from blocker.arp import LanFacts

    svc, fw, redir = _svc(watch=_watch(0, 4))
    if gw6 == "boom":

        def lanfacts():
            raise RuntimeError

        redir._lanfacts = lanfacts
    else:
        redir._lanfacts = lambda: LanFacts(
            gateway_ip="192.168.1.1",
            gateway_mac="aa:aa:aa:aa:aa:aa",
            box_mac="bb:bb:bb:bb:bb:bb",
            gateway_mac6=gw6,
        )
    svc._on_seen(Seen(mac=MAC, ip="192.168.1.50", ipv6=["fe80::5"], hostname=None, vendor=None))
    assert svc.test_block(MAC)["reason"] == ("ok" if gw6 not in (None, "boom") else "quiet")


def test_apply_strips_gateway_ip():
    from blocker.arp import LanFacts

    svc, fw, redir = _svc()
    redir._lanfacts = lambda: LanFacts(
        gateway_ip="192.168.1.1", gateway_mac=None, box_mac="bb:bb:bb:bb:bb:bb"
    )
    svc._on_seen(Seen(mac=MAC, ip="192.168.1.1", ipv6=[], hostname=None, vendor=None))
    svc.store.set_blocked([MAC])
    assert "192.168.1.1" not in fw.applied[-1]  # never spoof the gateway's own IP
    assert redir.targets[MAC].ip is None


def test_stop_restores_and_flushes_even_on_error():
    svc, fw, redir = _svc()

    def boom() -> None:
        raise RuntimeError("restore failed")

    redir.stop_all = boom
    svc.stop()
    assert fw.flushed is True  # flush runs despite the redirection error


def test_apply_updates_watch_and_loop_reports_full_set():
    watch = SimpleNamespace(
        set_watched=Mock(),
        stop=Mock(),
        counter=Mock(resisting=Mock(return_value={MAC})),
    )
    reports = []
    svc, _, _ = _svc(watch=watch, report=lambda c, m: reports.append(m) or True)
    svc.store.set_blocked([MAC])
    watch.set_watched.assert_called_with({MAC: TargetAddrs(mac=MAC)})
    svc._resist_once()
    assert reports == [{MAC}]
    watch.counter.resisting.return_value = set()
    svc._resist_once()
    assert reports[-1] == set()


def test_mac_for_ip_after_apply():
    svc, _, _ = _svc()
    svc._on_seen(Seen(mac=MAC, ip="192.168.1.42", ipv6=["fd00::42"], hostname=None, vendor=None))
    svc.store.set_blocked([MAC])
    assert svc._mac_for_ip("192.168.1.42") == MAC
    assert svc._mac_for_ip("fd00::42") == MAC
    assert svc._mac_for_ip("192.168.1.99") is None


def test_resist_once_reports_drained_hits_and_skips_empty():
    watch = SimpleNamespace(
        set_watched=Mock(), stop=Mock(), counter=Mock(resisting=Mock(return_value=set()))
    )
    sent = []
    svc, _, _ = _svc(watch=watch, report=lambda c, m: True, report_hits=lambda c, h: sent.append(h))
    svc._resist_once()
    assert sent == []
    svc._on_seen(Seen(mac=MAC, ip="192.168.1.42", ipv6=[], hostname=None, vendor=None))
    svc.store.set_blocked([MAC])
    svc.hits.add("192.168.1.42")
    svc._resist_once()
    assert sent == [{MAC: 1}]


GW = "aa:aa:aa:aa:aa:aa"
BOX = "bb:bb:bb:bb:bb:bb"


@pytest.mark.parametrize("infra", [GW, BOX])
def test_never_enforces_on_router_or_box_mac(infra):
    from blocker.arp import LanFacts

    svc, fw, redir = _svc()
    redir._lanfacts = lambda: LanFacts(gateway_ip="192.168.1.1", gateway_mac=GW, box_mac=BOX)
    svc.store.set_blocked([infra.upper(), MAC])
    assert MAC in fw.applied[-1]
    assert infra not in fw.applied[-1].lower()
    assert set(redir.targets) == {MAC}


def test_lanfacts_failure_still_enforces_kid():
    svc, fw, redir = _svc()

    def boom():
        raise RuntimeError("no lan")

    redir._lanfacts = boom
    svc.store.set_blocked([MAC])
    assert MAC in fw.applied[-1]
    assert set(redir.targets) == {MAC}


def test_test_block_rejects_malformed_mac():
    svc, fw, redir = _svc()
    with pytest.raises(ValueError):
        svc.test_block("aa:bb:cc:dd:ee:ff } ; flush ruleset ; {")
    assert svc._probing == set()
