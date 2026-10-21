"""Service orchestrator tests. Fakes for firewall, redirection, backend, probe."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from blocker.backend import Seen
from blocker.config import Config
from blocker.resist import Tally
from blocker.service import TEST_MESSAGES, Service

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


def test_test_block_reports_router_resisted_when_still_online():
    svc, fw, redir = _svc(probe=lambda ip: True)  # device stays reachable
    svc._on_seen(Seen(mac=MAC, ip="192.168.1.50", ipv6=[], hostname=None, vendor=None))
    result = svc.test_block(MAC)
    assert result["router_resisted"] is True
    assert result["offline"] is False
    assert svc.store.current() == set()  # prior state restored


def test_test_block_reports_offline_when_probe_fails():
    svc, fw, redir = _svc(probe=lambda ip: False)
    svc._on_seen(Seen(mac=MAC, ip="192.168.1.50", ipv6=[], hostname=None, vendor=None))
    result = svc.test_block(MAC)
    assert result["offline"] is True
    assert result["router_resisted"] is False


def _watch(g, b):
    return SimpleNamespace(
        set_watched=lambda m: None,
        stop=lambda: None,
        counter=SimpleNamespace(
            resisting=lambda: set(), tally=lambda mac: Tally(to_gateway=g, to_box=b)
        ),
    )


@pytest.mark.parametrize(
    "online,to_box,reason",
    [(False, 0, "ok"), (True, 0, "router"), (True, 4, "device")],
)
def test_test_block_reason(online, to_box, reason):
    svc, fw, redir = _svc(probe=lambda ip: online, watch=_watch(5, to_box))
    svc._on_seen(Seen(mac=MAC, ip="192.168.1.50", ipv6=[], hostname=None, vendor=None))
    r = svc.test_block(MAC)
    assert r["reason"] == reason
    assert r["message"] == TEST_MESSAGES[reason]
    assert r["router_resisted"] is (reason == "router")


def test_test_block_unseen():
    svc, fw, redir = _svc(probe=lambda ip: True, watch=_watch(0, 0))
    r = svc.test_block(MAC)
    assert r["reason"] == "unseen"


def test_test_block_preserves_other_blocks():
    svc, fw, redir = _svc(probe=lambda ip: False)
    other = "aa:bb:cc:dd:ee:ff"
    svc._on_seen(Seen(mac=other, ip="192.168.1.9", ipv6=[], hostname=None, vendor=None))
    svc._on_seen(Seen(mac=MAC, ip="192.168.1.50", ipv6=[], hostname=None, vendor=None))
    svc.store.set_blocked([other])
    n = len(fw.applied)
    svc.test_block(MAC)
    assert svc.store.current() == {other}  # other device still blocked afterwards
    # and it is never dropped from enforcement during the diagnostic
    assert all(other in r for r in fw.applied[n:])


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
    watch.set_watched.assert_called_with({MAC})
    svc._resist_once()
    assert reports == [{MAC}]
    watch.counter.resisting.return_value = set()
    svc._resist_once()
    assert reports[-1] == set()
