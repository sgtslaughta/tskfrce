from datetime import UTC, datetime

from app.core.crypto import seal
from app.models.family import get_family
from app.models.notify import NotifyHeld, NotifyPlace
from app.services import notify


def _place(db, events=notify.DEFAULT_EVENTS, url="json://localhost/x"):
    p = NotifyPlace(name="P", url_enc=seal(url), url_mask="json://…", events=",".join(events))
    db.add(p)
    db.flush()
    return p


def test_ping_sends_after_commit_only(db, pings):
    _place(db)
    notify.ping(db, "chore_ok", "Mia finished Homework", "Take a look.", "/?chore=7")
    assert pings == []
    db.commit()
    assert pings == [(["json://localhost/x"], "Mia finished Homework", "Take a look.")]


def test_link_uses_app_address(db, pings):
    fam = get_family(db)
    fam.app_address = "http://chores.local"
    _place(db)
    notify.ping(db, "chore_ok", "T", "B", "/?chore=7")
    db.commit()
    assert pings[0][2] == "B\n\nhttp://chores.local/?chore=7"


def test_rollback_sends_nothing(db, pings):
    _place(db)
    notify.ping(db, "chore_ok", "T")
    db.rollback()
    db.commit()
    assert pings == []


def test_event_not_selected_or_disabled(db, pings):
    _place(db, events=("badge",))
    p = _place(db)
    p.enabled = False
    notify.ping(db, "chore_ok", "T")
    db.commit()
    assert pings == []


def test_quiet_hours_cross_midnight_family_tz(db):
    fam = get_family(db)
    fam.timezone = "America/New_York"
    fam.quiet_start, fam.quiet_end = "21:30", "07:00"
    assert notify.in_quiet(fam, datetime(2026, 1, 10, 3, 0, tzinfo=UTC))
    assert notify.in_quiet(fam, datetime(2026, 1, 10, 11, 59, tzinfo=UTC))
    assert not notify.in_quiet(fam, datetime(2026, 1, 10, 12, 0, tzinfo=UTC))
    fam.quiet_end = None
    assert not notify.in_quiet(fam, datetime(2026, 1, 10, 3, 0, tzinfo=UTC))


def test_quiet_holds_drops_and_lets_security_through(db, pings, monkeypatch):
    monkeypatch.setattr(notify, "in_quiet", lambda fam, now: True)
    p = _place(db, events=tuple(notify.EVENTS))
    for ev in ("chore_ok", "badge", "resisting"):
        notify.ping(db, ev, ev)
    db.commit()
    assert [t for _, t, _ in pings] == ["resisting"]
    assert [h.title for h in db.query(NotifyHeld).filter_by(place_id=p.id)] == ["chore_ok"]


def test_quiet_security_off_drops_security(db, pings, monkeypatch):
    monkeypatch.setattr(notify, "in_quiet", lambda fam, now: True)
    get_family(db).quiet_security = False
    _place(db)
    notify.ping(db, "resisting", "x")
    db.commit()
    assert pings == []


def test_unreadable_place_is_skipped(db, pings):
    bad = _place(db)
    bad.url_enc = "garbage"
    _place(db, url="json://ok/y")
    notify.ping(db, "chore_ok", "T")
    db.commit()
    assert [u for u, _, _ in pings] == [["json://ok/y"]]


def test_deliver_swallows_errors(monkeypatch):
    import apprise

    def boom(*a, **k):
        raise RuntimeError("boom")

    monkeypatch.setattr(apprise.Apprise, "notify", boom)
    assert notify.deliver(["json://localhost/x"], "t", "b") == (False, "boom")


URL = "discord://12345/tok123secret"


def test_deliver_redacts_exception(monkeypatch, caplog):
    import apprise

    def boom(*a, **k):
        raise RuntimeError(f"failed for {URL} at 12345/tok123secret")

    monkeypatch.setattr(apprise.Apprise, "notify", boom)
    ok, err = notify.deliver([URL], "t", "b")
    assert not ok and "tok123" not in err
    assert all("tok123" not in r.getMessage() for r in caplog.records)


def test_deliver_redacts_log_capture(monkeypatch):
    import apprise

    def fail(*a, **k):
        apprise.logger.warning("Could not reach %s", URL)
        return False

    monkeypatch.setattr(apprise.Apprise, "notify", fail)
    ok, err = notify.deliver([URL], "t", "b")
    assert not ok and "tok123" not in err and err.endswith("Could not reach ••••")


def test_send_logs_no_secret(monkeypatch):
    import apprise

    seen = []

    class Spy:
        def warning(self, *a, **k):
            seen.append(repr((a, k)))

    monkeypatch.setattr(notify, "log", Spy())
    monkeypatch.setattr(
        apprise.Apprise, "notify", lambda *a, **k: (_ for _ in ()).throw(RuntimeError(URL))
    )
    notify._send([URL], "t", "b")
    assert seen and all("tok123" not in x for x in seen)


def test_redact_decoded_credentials():
    url = "mailto://bob:p%40ss%20word9@gmail.com"
    out = notify._redact("login failed bob p@ss word9 for gmail.com p%40ss%20word9", [url])
    assert "p@ss word9" not in out and "p%40ss" not in out and "bob" not in out


def test_deliver_fails_closed_on_malformed_url(monkeypatch):
    import apprise

    def boom(*a, **k):
        raise RuntimeError("json://[::1/x")

    monkeypatch.setattr(apprise.Apprise, "notify", boom)
    assert notify.deliver(["json://[::1/x"], "t", "b") == (False, "It didn't go through.")


def test_deliver_bad_url_not_on_root_logger(caplog):
    import logging

    from app.services import notify

    caplog.set_level(logging.DEBUG)
    ok, err = notify.deliver(["discord://SECRETPW"], "t", "b")
    assert not ok and "SECRETPW" not in (err or "")
    assert all("SECRETPW" not in r.getMessage() for r in caplog.records)
    assert "SECRETPW" not in caplog.text


def test_concurrent_deliveries_dont_cross_secrets(monkeypatch):
    import logging
    import time
    from concurrent.futures import ThreadPoolExecutor

    import apprise
    from app.services import notify

    def fake(self, *a, **k):
        url = self.servers[0].url() if hasattr(self, "servers") else ""
        logging.getLogger("apprise").warning("failed for %s", self._u)
        time.sleep(0.2)
        return False

    real_add = apprise.Apprise.add

    def add(self, url, *a, **k):
        self._u = url
        return real_add(self, url, *a, **k)

    monkeypatch.setattr(apprise.Apprise, "add", add)
    monkeypatch.setattr(apprise.Apprise, "notify", fake)
    urls = ["json://secretA_tok/x", "json://secretB_tok/x"]
    with ThreadPoolExecutor(2) as ex:
        res = list(ex.map(lambda u: notify.deliver([u], "t", "b"), urls))
    assert "secretB_tok" not in (res[0][1] or "") and "secretA_tok" not in (res[1][1] or "")
    assert not res[0][0] and not res[1][0]


def test_failed_add_silent_on_stderr(client, parent_headers, capfd):
    from app.services import notify

    client.post(
        "/api/v1/notify/places",
        json={"name": "x", "url": "discord://tok123"},
        headers=parent_headers,
    )
    notify.deliver(["discord://tok123"], "t", "b")
    out = capfd.readouterr()
    assert "tok123" not in out.out + out.err
