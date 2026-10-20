import http.client
import json
import threading

from blocker.api import make_api


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
