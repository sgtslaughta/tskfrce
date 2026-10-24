import os
import shutil

import pytest

from . import journey as j

os.environ["INTERNAL_TOKEN"] = "labtoken"


@pytest.fixture(scope="session", autouse=True)
def lab_up():
    if not shutil.which("docker"):
        pytest.skip("docker not available")
    try:
        j.lab("up", check=True)
        yield
    finally:
        if not os.environ.get("LAB_KEEP"):  # LAB_KEEP=1 leaves the lab up for debugging
            j.lab("down")


def clear_overrides():
    """lab unblock leaves a manual 'unlock' override, which would hide chore gating."""
    for h in ("kid1", "kid2"):
        j.parent(
            "DELETE", f"/api/v1/devices/{j.lab('device-id', h, check=True).stdout.strip()}/override"
        )


@pytest.fixture(autouse=True)
def clean_state():
    """A failed test must not leave a kid, chore or block behind for the next."""
    clear_overrides()
    yield
    j.cleanup()
    j.lab("reset", "kid1")
    clear_overrides()
    for h in ("kid1", "kid2"):
        assert j.wait_for(lambda h=h: j.online(h))
