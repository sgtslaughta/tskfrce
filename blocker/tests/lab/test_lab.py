import os
import shutil
import subprocess
import time

import pytest

os.environ.setdefault("INTERNAL_TOKEN", "labtoken")
pytestmark = pytest.mark.integration
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
LAB = ["bash", os.path.join(ROOT, "scripts/lab.sh")]
COMPOSE = ["docker", "compose", "-f", os.path.join(ROOT, "lab/docker-compose.lab.yml")]


def lab(*args, check=False) -> subprocess.CompletedProcess:
    return subprocess.run([*LAB, *args], capture_output=True, text=True, check=check)


def wait_for(pred, timeout=60, every=2):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if pred():
            return True
        time.sleep(every)
    return False


@pytest.fixture(scope="module", autouse=True)
def lab_up():
    if not shutil.which("docker"):
        pytest.skip("docker not available")
    lab("up", check=True)
    yield
    lab("down")


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
        subprocess.run([*COMPOSE, "exec", "-T", "kid1", "pkill", "-f", "while :"])
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
