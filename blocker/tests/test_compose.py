from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml", reason="PyYAML not installed; cannot parse docker-compose.yml")

COMPOSE = Path(__file__).resolve().parents[2] / "docker-compose.yml"


def _blocker():
    return yaml.safe_load(COMPOSE.read_text())["services"]["blocker"]


def test_blocker_service_has_host_net_and_minimal_caps():
    svc = _blocker()
    assert svc["network_mode"] == "host"
    assert sorted(svc["cap_add"]) == ["NET_ADMIN", "NET_RAW"]
    assert not svc.get("privileged", False)


def test_blocker_has_no_data_volume_and_gets_token_from_env():
    svc = _blocker()
    assert not any("task4ce_data" in str(v) for v in svc.get("volumes", []))
    assert "INTERNAL_TOKEN" in svc["environment"]
