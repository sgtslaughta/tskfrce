from pathlib import Path
from types import SimpleNamespace

from blocker import service as svc_mod
from blocker.config import Config
from blocker.service import Service

CFG = Config(
    backend_url="http://b",
    blocker_url_host="b",
    internal_token="t",
    lan_iface="",
    data_dir=Path("/tmp"),
)


class _FakeFw:
    def apply(self, r):
        pass

    def flush(self):
        pass

    def enable_forwarding(self):
        pass


class _FakeRedir:
    def set_targets(self, t):
        pass

    def stop_all(self):
        pass


def test_start_binds_control_api_to_loopback(monkeypatch):
    seen = {}

    class FakeServer:
        def serve_forever(self):
            pass

        def shutdown(self):
            pass

    def fake_make_api(state, token, tester, host, port):
        seen["host"] = host
        return FakeServer()

    # Stub the long-running loops so start() only exercises the API bind.
    monkeypatch.setattr(svc_mod, "make_api", fake_make_api)
    monkeypatch.setattr(svc_mod, "run_discovery", lambda *a, **k: None)
    monkeypatch.setattr(svc_mod, "run_dns", lambda *a, **k: None)
    monkeypatch.setattr(svc_mod, "run_http", lambda *a, **k: None)

    watch = SimpleNamespace(set_watched=lambda m: None, stop=lambda: None)
    svc = Service(
        CFG, firewall=_FakeFw(), redirection=_FakeRedir(), portal_ip="192.168.1.2", watch=watch
    )
    svc.start()
    svc.stop()
    assert seen["host"] == "127.0.0.1"
