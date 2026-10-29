import subprocess

import pytest

from . import journey as j

pytestmark = pytest.mark.integration
COMPOSE = j.COMPOSE
lab, wait_for = j.lab, j.wait_for


@pytest.fixture(autouse=True)
def clean_kid1():
    yield
    lab("reset", "kid1")
    lab("unblock", "kid1")
    assert wait_for(lambda: lab("check", "kid1").returncode == 0)


def test_block_cuts_internet_and_unblock_restores():
    assert lab("check", "kid1").returncode == 0
    lab("block", "kid1", check=True)
    assert wait_for(lambda: lab("check", "kid1").returncode == 1)
    lab("unblock", "kid1", check=True)
    assert wait_for(lambda: lab("check", "kid1").returncode == 0)


def test_sibling_stays_online_while_kid1_blocked():
    lab("block", "kid1", check=True)
    assert wait_for(lambda: lab("check", "kid1").returncode == 1)
    assert lab("check", "kid2").returncode == 0


def test_captive_portal_dns_and_redirect():
    lab("block", "kid1", check=True)
    assert wait_for(lambda: lab("portal", "kid1").returncode == 0)


@pytest.mark.xfail(strict=False, reason="bridge IPv6 may be disabled on this Docker host")
def test_ipv6_blocked_too():
    assert lab("check6", "kid1").returncode == 0
    lab("block", "kid1", check=True)
    assert wait_for(lambda: lab("check6", "kid1").returncode == 1)


# The detector counts real return traffic, so the kid must keep trying the internet.
BROWSE = (
    "timeout 240 sh -c 'while :; do curl -s -m 2 -o /dev/null http://203.0.113.1/; sleep 0.5; done'"
)


def test_static_arp_is_blocked_and_flagged():
    lab("block", "kid1", check=True)
    assert wait_for(lambda: lab("check", "kid1").returncode == 1)
    lab("resist", "kid1", check=True)
    subprocess.run([*COMPOSE, "exec", "-d", "kid1", "sh", "-c", BROWSE], check=True)
    try:
        assert not wait_for(lambda: lab("check", "kid1").returncode == 0, timeout=20)
        assert wait_for(lambda: lab("resisting", "kid1").stdout.strip() == "true", timeout=90)
        out = lab("test-block", "kid1", check=True).stdout
        assert '"reason": "device"' in out or '"reason":"device"' in out
    finally:
        subprocess.run([*COMPOSE, "exec", "-T", "kid1", "pkill", "-f", "while :"], check=False)
    lab("reset", "kid1", check=True)
    assert wait_for(lambda: lab("resisting", "kid1").stdout.strip() == "false", timeout=90)


def test_box_restart_fails_open():
    lab("block", "kid1", check=True)
    assert wait_for(lambda: lab("check", "kid1").returncode == 1)
    subprocess.run([*COMPOSE, "stop", "blocker"], check=True)
    try:
        assert wait_for(lambda: lab("check", "kid1").returncode == 0, timeout=90)
    finally:
        subprocess.run([*COMPOSE, "start", "blocker"], check=True)
