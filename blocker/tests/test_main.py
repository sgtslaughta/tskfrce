from blocker import __main__ as entry


def test_main_binds_control_api_to_loopback(monkeypatch):
    seen = {}

    class Stop(Exception):
        pass

    class FakeServer:
        def serve_forever(self):
            raise Stop

    def fake_make_api(state, token, tester, host, port):
        seen["host"] = host
        return FakeServer()

    monkeypatch.setenv("INTERNAL_TOKEN", "t")
    monkeypatch.setattr(entry, "make_api", fake_make_api)
    try:
        entry.main()
    except Stop:
        pass
    assert seen["host"] == "127.0.0.1"
