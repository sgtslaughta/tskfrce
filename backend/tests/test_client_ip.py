"""Real client IP: X-Real-IP is trusted only from configured proxy peers."""

from app.core import client_ip as cip
from app.core.config import settings
from starlette.requests import Request


def req(peer, real=None):
    headers = [(b"x-real-ip", real.encode())] if real else []
    return Request({"type": "http", "client": (peer, 1), "headers": headers})


def test_spoofed_header_from_untrusted_peer_ignored():
    assert cip.client_ip(req("192.168.1.50", "10.0.0.9")) == "192.168.1.50"


def test_header_from_trusted_peer_honored_and_normalized():
    assert cip.client_ip(req("127.0.0.1", "::ffff:10.0.0.9")) == "10.0.0.9"
    assert cip.client_ip(req("::ffff:127.0.0.1", "10.0.0.9")) == "10.0.0.9"


def test_trusted_proxy_list_from_settings(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", "172.30.0.10")
    assert cip.client_ip(req("172.30.0.10", "10.0.0.9")) == "10.0.0.9"
    assert cip.client_ip(req("127.0.0.1", "10.0.0.9")) == "127.0.0.1"


def test_peer_normalized_when_no_header():
    assert cip.client_ip(req("::ffff:192.168.1.50")) == "192.168.1.50"


def test_norm_ip():
    assert cip.norm_ip("fe80::1%eth0") == "fe80::1"
    assert cip.norm_ip("junk") is None
