import http.client
import json
import threading

import pytest

from blocker.api import make_api
from blocker.state_store import StateStore


def test_health_ok():
    server = make_api(state=None, token="t", tester=lambda *a, **k: None)
    server.timeout = 5
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    try:
        conn = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=5)
        conn.request("GET", "/health")
        resp = conn.getresponse()
        assert resp.status == 200
        assert json.loads(resp.read()) == {"ok": True}
        conn.request("GET", "/nope")
        assert conn.getresponse().status == 404
    finally:
        server.shutdown()
        server.server_close()


def _call(server, path, body, token="t"):
    conn = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=5)
    headers = {"Content-Type": "application/json"}
    if token is not None:
        headers["X-Internal-Token"] = token
    raw = body if isinstance(body, bytes) else json.dumps(body).encode()
    conn.request("POST", path, body=raw, headers=headers)
    resp = conn.getresponse()
    return resp.status, json.loads(resp.read() or b"null")


@pytest.fixture
def api():
    store = StateStore()
    server = make_api(
        state=store,
        token="t",
        tester=lambda mac: {"offline": True, "router_resisted": False, "message": mac},
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield server, store
    server.shutdown()
    server.server_close()


@pytest.mark.parametrize("token", [None, "", "wrong"])
def test_state_requires_token(api, token):
    server, store = api
    status, _ = _call(server, "/state", {"blocked": []}, token=token)
    assert status == 403


def test_state_rejects_non_list(api):
    server, store = api
    store.set_blocked(["aa:bb:cc:dd:ee:ff"])
    status, body = _call(server, "/state", {"blocked": "nope"})
    assert status == 400 and "error" in body
    status, _ = _call(server, "/state", [1])
    assert status == 400
    assert store.current() == {"aa:bb:cc:dd:ee:ff"}


def test_state_rejects_bad_mac(api):
    server, store = api
    store.set_blocked(["aa:bb:cc:dd:ee:ff"])
    status, body = _call(server, "/state", {"blocked": ["aa:xx"]})
    assert status == 400 and body["error"] == "'aa:xx' is not a valid MAC address."
    assert store.current() == {"aa:bb:cc:dd:ee:ff"}


def test_state_applies_and_reports_count(api):
    server, store = api
    status, body = _call(server, "/state", {"blocked": ["AA:BB:CC:DD:EE:FF", "11:22:33:44:55:66"]})
    assert (status, body) == (200, {"ok": True, "count": 2})
    assert len(store.current()) == 2


def test_test_block_returns_tester_result(api):
    server, _ = api
    status, body = _call(server, "/test-block", {"mac": "aa:bb:cc:dd:ee:ff"})
    assert status == 200 and body["offline"] is True
    assert _call(server, "/test-block", {"mac": "x"}, token="bad")[0] == 403


def test_non_ascii_token_is_403(api):
    server, _ = api
    assert _call(server, "/state", {"blocked": []}, token="té")[0] == 403


def _raw(server, length):
    conn = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=5)
    headers = {"X-Internal-Token": "t", "Content-Length": length}
    conn.request("POST", "/state", body=b"{}", headers=headers)
    resp = conn.getresponse()
    return resp.status


def test_bad_content_length_is_400(api):
    server, _ = api
    assert _raw(server, "abc") == 400
    assert _raw(server, "70000") == 400
