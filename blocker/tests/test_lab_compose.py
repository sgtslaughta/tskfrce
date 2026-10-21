from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml", reason="PyYAML not installed; cannot parse lab compose")

LAB = Path(__file__).resolve().parents[2] / "lab" / "docker-compose.lab.yml"


class _Loader(yaml.SafeLoader):
    """Compose-only tags (!reset, !override) load as their plain value."""


def _plain(loader, tag, node):
    if isinstance(node, yaml.MappingNode):
        return loader.construct_mapping(node, deep=True)
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node, deep=True)
    return loader.construct_scalar(node)


_Loader.add_multi_constructor("!", _plain)

SYSCTLS = {"net.ipv4.ip_forward": 1, "net.ipv6.conf.all.forwarding": 1}
HOSTS = {
    "kid1": ("10.99.0.11", "fd00:99::11", "02:99:00:00:00:11"),
    "kid2": ("10.99.0.12", "fd00:99::12", "02:99:00:00:00:12"),
    "parent": ("10.99.0.13", "fd00:99::13", "02:99:00:00:00:13"),
}


@pytest.fixture(scope="module")
def cfg():
    return yaml.load(LAB.read_text(), Loader=_Loader)


def _sysctls(svc):
    s = svc["sysctls"]
    if isinstance(s, list):
        s = dict(i.split("=") for i in s)
    return {k: int(v) for k, v in s.items()}


def test_project_name_and_internal_networks(cfg):
    assert cfg["name"] == "task4ce-lab"
    for n in ("lab", "wan"):
        assert cfg["networks"][n]["internal"] is True
        assert cfg["networks"][n]["enable_ipv6"] is True


def test_router(cfg):
    r = cfg["services"]["router"]
    assert r["networks"]["lab"]["mac_address"] == "02:99:00:00:00:02"
    assert r["networks"]["lab"]["ipv4_address"] == "10.99.0.2"
    assert r["networks"]["lab"]["ipv6_address"] == "fd00:99::2"
    assert r["networks"]["wan"]["ipv4_address"] == "203.0.113.2"
    assert r["networks"]["wan"]["ipv6_address"] == "2001:db8:1::2"
    assert "NET_ADMIN" in r["cap_add"]
    assert _sysctls(r) == SYSCTLS


def test_fake_internet(cfg):
    f = cfg["services"]["fake-internet"]
    assert f["image"] == "nginx:alpine"
    assert f["networks"]["wan"]["ipv4_address"] == "203.0.113.1"
    assert f["networks"]["wan"]["ipv6_address"] == "2001:db8:1::1"
    assert "NET_ADMIN" in f["cap_add"]


def test_blocker(cfg):
    b = cfg["services"]["blocker"]
    assert "network_mode" not in b
    assert not b.get("privileged", False)
    env = b["environment"]
    for k in ("SCAN_INTERVAL", "RECONCILE_INTERVAL", "RESIST_INTERVAL"):
        assert env[k] == "5"
    assert env["LAN_IFACE"] == "eth0"
    assert env["PORTAL_REDIRECT_URL"] == "http://task4ce.local/kid"
    assert b["mac_address"] == "02:99:00:00:00:04"
    assert b["networks"]["lab"]["ipv4_address"] == "10.99.0.4"
    assert b["networks"]["lab"]["ipv6_address"] == "fd00:99::4"
    assert sorted(b["cap_add"]) == ["NET_ADMIN", "NET_RAW"]
    assert _sysctls(b) == SYSCTLS
    assert b["environment"]["BACKEND_URL"] == "http://10.99.0.3:8000"
    assert b["environment"]["INTERNAL_TOKEN"] == "labtoken"
    assert "10.99.0.2" in " ".join(b["entrypoint"])


def test_backend(cfg):
    b = cfg["services"]["backend"]
    assert "ports" in b and b["ports"] == []
    assert "volumes" in b and "/app/data" in b["volumes"]
    assert list(b["networks"]) == ["lab"]
    assert b["environment"]["TRUSTED_HOSTS"] == "*"
    assert b["environment"]["DISABLE_RATE_LIMITING"] == "true"
    assert b["networks"]["lab"]["ipv4_address"] == "10.99.0.3"
    assert b["environment"]["INTERNAL_TOKEN"] == "labtoken"
    assert b["environment"]["BLOCKER_URL"] == "http://10.99.0.4:7777"


@pytest.mark.parametrize("name", HOSTS)
def test_hosts(cfg, name):
    v4, v6, mac = HOSTS[name]
    h = cfg["services"][name]
    assert h["mac_address"] == mac
    assert h["networks"]["lab"]["ipv4_address"] == v4
    assert h["networks"]["lab"]["ipv6_address"] == v6
    assert "NET_ADMIN" in h["cap_add"]
    assert h["dns"] == ["203.0.113.1"]


def test_subnets(cfg):
    def subnets(n):
        return [c["subnet"] for c in cfg["networks"][n]["ipam"]["config"]]

    assert subnets("lab") == ["10.99.0.0/24", "fd00:99::/64"]
    assert subnets("wan") == ["203.0.113.0/24", "2001:db8:1::/64"]
