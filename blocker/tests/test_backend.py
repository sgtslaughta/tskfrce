import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

from blocker import backend
from blocker.backend import Seen, fetch_blocked, report_resisting, report_seen
from blocker.config import Config


class _Stub:
    def __init__(self, status=200, body=b"{}", delay=0.0):
        stub = self
        self.status, self.body, self.delay = status, body, delay
        self.requests = []

        class H(BaseHTTPRequestHandler):
            def _handle(self):
                n = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(n) if n else b""
                stub.requests.append((self.command, self.path, dict(self.headers), raw))
                time.sleep(stub.delay)
                try:
                    self.send_response(stub.status)
                    self.send_header("Content-Length", str(len(stub.body)))
                    self.end_headers()
                    self.wfile.write(stub.body)
                except OSError:
                    pass

            do_GET = do_POST = _handle

            def log_message(self, *a):
                pass

        self.server = HTTPServer(("127.0.0.1", 0), H)
        self.url = f"http://127.0.0.1:{self.server.server_port}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()
        self.server.server_close()


@pytest.fixture
def make_stub():
    stubs = []

    def make(**kw):
        s = _Stub(**kw)
        stubs.append(s)
        return s

    yield make
    for s in stubs:
        s.close()


def _cfg(url):
    return Config(
        backend_url=url,
        blocker_url_host="blocker",
        internal_token="tok",
        lan_iface="eth0",
        data_dir=Path("/tmp"),
    )


SEEN = Seen(mac="aa:bb:cc:dd:ee:ff", ip="10.0.0.5", ipv6=["fe80::1"], hostname="h", vendor=None)


def test_report_seen_sends_token_and_body(make_stub):
    s = make_stub(body=b'{"id": 7}')
    assert report_seen(_cfg(s.url), SEEN) == 7
    method, path, headers, raw = s.requests[0]
    assert method == "POST"
    assert path == "/api/v1/internal/devices/seen"
    assert headers["X-Internal-Token"] == "tok"
    assert json.loads(raw) == {
        "mac": "aa:bb:cc:dd:ee:ff",
        "ip": "10.0.0.5",
        "ipv6": ["fe80::1"],
        "hostname": "h",
        "vendor": None,
    }


def test_report_seen_returns_none_on_5xx(make_stub):
    s = make_stub(status=500)
    assert report_seen(_cfg(s.url), SEEN) is None


def test_report_seen_none_on_unreachable():
    assert report_seen(_cfg("http://127.0.0.1:1"), SEEN) is None


def test_fetch_blocked_parses_list(make_stub):
    s = make_stub(body=b'{"blocked": ["aa:bb:cc:dd:ee:ff"]}')
    assert fetch_blocked(_cfg(s.url)) == ["aa:bb:cc:dd:ee:ff"]
    method, path, headers, _ = s.requests[0]
    assert method == "GET"
    assert path == "/api/v1/internal/state"
    assert headers["X-Internal-Token"] == "tok"


def test_fetch_blocked_none_on_bad_json(make_stub):
    s = make_stub(body=b"nope")
    assert fetch_blocked(_cfg(s.url)) is None


def test_fetch_blocked_none_on_timeout(make_stub, monkeypatch):
    monkeypatch.setattr(backend, "TIMEOUT", 0.3)
    s = make_stub(delay=1.5)
    assert fetch_blocked(_cfg(s.url)) is None


def test_report_resisting_posts_sorted_list(make_stub):
    s = make_stub(body=b"{}")
    assert report_resisting(_cfg(s.url), {"bb:bb:bb:bb:bb:02", "aa:aa:aa:aa:aa:01"}) is True
    method, path, headers, raw = s.requests[0]
    assert method == "POST"
    assert path == "/api/v1/internal/devices/resisting"
    assert headers["X-Internal-Token"] == "tok"
    assert json.loads(raw) == {"resisting": ["aa:aa:aa:aa:aa:01", "bb:bb:bb:bb:bb:02"]}


def test_report_resisting_false_on_unreachable():
    assert report_resisting(_cfg("http://127.0.0.1:1"), set()) is False


def test_report_hits_posts_body(make_stub):
    s = make_stub(body=b"{}")
    assert backend.report_hits(_cfg(s.url), {"aa:aa:aa:aa:aa:01": 3}) is True
    method, path, headers, raw = s.requests[0]
    assert method == "POST"
    assert path == "/api/v1/internal/devices/hits"
    assert headers["X-Internal-Token"] == "tok"
    assert json.loads(raw) == {"hits": {"aa:aa:aa:aa:aa:01": 3}}


def test_report_hits_false_on_unreachable():
    assert backend.report_hits(_cfg("http://127.0.0.1:1"), {"aa:aa:aa:aa:aa:01": 1}) is False
