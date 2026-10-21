import subprocess

import pytest

from .journey import COMPOSE, make_chore, make_kid, online, parent, wait_for, wait_online

pytestmark = pytest.mark.integration


def test_box_offline_warns_and_fails_open():
    a = make_kid("Box", "1234", "kid1")
    make_chore([a["id"]])
    wait_online("kid1", False)
    assert parent("GET", "/api/v1/blocker")["online"] is True
    subprocess.run([*COMPOSE, "stop", "blocker"], check=True)
    try:
        assert wait_for(lambda: parent("GET", "/api/v1/blocker")["online"] is False, 150, 5)
        assert wait_for(lambda: online("kid1"), 90)
    finally:
        subprocess.run([*COMPOSE, "start", "blocker"], check=True)
    assert wait_for(lambda: parent("GET", "/api/v1/blocker")["online"] is True, 90, 5)
    wait_online("kid1", False)  # the box is back and the chore gate closes again
