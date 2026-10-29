import httpx
import pytest
from app.core.config import settings
from app.models.family import get_family
from app.services import inbox, push

from tests.conftest import _make_user


@pytest.fixture
def cfg(monkeypatch):
    monkeypatch.setattr(settings, "NTFY_URL", "http://ntfy:80")
    monkeypatch.setattr(settings, "BOX_URL", "http://192.168.1.20:3000")
    monkeypatch.setattr(settings, "NTFY_PUBLIC_URL", None)
    sent = []
    monkeypatch.setattr(push, "send", sent.append)
    monkeypatch.setattr(push, "_spawn", lambda fn, *a: fn(*a))
    return sent


def _kid(db, kid, topic="topic1"):
    kid.push_topic = topic
    db.commit()
    return kid


def test_push_after_commit(db, kid, cfg):
    _kid(db, kid)
    inbox.notify(db, [kid.id], "chore_approved", "Nice", "body")
    assert cfg == []
    db.commit()
    assert len(cfg) == 1
    assert cfg[0]["topic"] == "topic1" and cfg[0]["priority"] == 3
    assert cfg[0]["click"] == "http://192.168.1.20:3000/kid"


def test_urgent_priority(db, kid, cfg):
    _kid(db, kid)
    inbox.notify(db, [kid.id], "due_soon", "Soon")
    db.commit()
    assert cfg[0]["priority"] == 4


def test_no_push_on_rollback(db, kid, cfg):
    _kid(db, kid)
    inbox.notify(db, [kid.id], "chore_approved", "Nice")
    db.rollback()
    db.commit()
    assert cfg == []


def test_no_push_on_savepoint_rollback(db, kid, cfg):
    _kid(db, kid)
    with db.begin_nested() as sp:
        inbox.notify(db, [kid.id], "chore_approved", "gone")
        sp.rollback()
    inbox.notify(db, [kid.id], "level_up", "kept")
    db.commit()
    assert [i["title"] for i in cfg] == ["kept"]


def test_savepoint_release_does_not_send_early(db, kid, cfg):
    _kid(db, kid)
    inbox.notify(db, [kid.id], "chore_approved", "outer")
    with db.begin_nested():
        pass
    assert cfg == []
    db.rollback()
    db.commit()
    assert cfg == []


def test_savepoint_rollback_keeps_earlier_push(db, kid, cfg):
    _kid(db, kid)
    inbox.notify(db, [kid.id], "chore_approved", "outer")
    with db.begin_nested() as sp:
        inbox.notify(db, [kid.id], "level_up", "inner")
        sp.rollback()
    db.commit()
    assert [i["title"] for i in cfg] == ["outer"]


def test_no_push_without_topic_or_config(db, kid, cfg, monkeypatch):
    inbox.notify(db, [kid.id], "chore_approved", "no topic")
    db.commit()
    _kid(db, kid)
    monkeypatch.setattr(settings, "NTFY_URL", None)
    inbox.notify(db, [kid.id], "chore_approved", "no config")
    db.commit()
    assert cfg == []


def test_parent_kind_never_pushes(db, kid, cfg):
    _kid(db, kid)
    inbox.notify(db, [kid.id], "new_device", "dev")
    db.commit()
    assert cfg == []


def test_dedup_skip_does_not_push(db, kid, cfg):
    _kid(db, kid)
    for _ in range(2):
        inbox.notify(db, [kid.id], "due_soon", "x", dedup_key="k")
        db.commit()
    assert len(cfg) == 1


def test_parent_user_never_pushes(db, cfg):
    mom = _make_user(db, "mom2", inbox.UserRole.PARENT)
    mom.push_topic = "t"
    db.commit()
    inbox.notify(db, [mom.id], "chore_approved", "x")
    db.commit()
    assert cfg == []


def test_send_swallows_errors(monkeypatch):
    monkeypatch.setattr(settings, "NTFY_URL", "http://ntfy:80")

    def boom(*a, **k):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx, "post", boom)
    push.send({"topic": "t"})
    monkeypatch.setattr(
        httpx,
        "post",
        lambda *a, **k: httpx.Response(500, request=httpx.Request("POST", "http://x")),
    )
    push.send({"topic": "t"})


def test_public_url_from_box_url(monkeypatch):
    monkeypatch.setattr(settings, "NTFY_PUBLIC_URL", None)
    monkeypatch.setattr(settings, "BOX_URL", "http://192.168.1.20:3000")
    assert push.public_url() == "http://192.168.1.20:2586"


def test_public_url_follows_ntfy_port(monkeypatch):
    monkeypatch.setattr(settings, "NTFY_PUBLIC_URL", None)
    monkeypatch.setattr(settings, "BOX_URL", "http://192.168.1.20:3000")
    monkeypatch.setattr(settings, "NTFY_PORT", "0.0.0.0:8093")
    assert push.public_url() == "http://192.168.1.20:8093"
    monkeypatch.setattr(settings, "NTFY_PORT", "8094")
    assert push.public_url() == "http://192.168.1.20:8094"


def test_conf_text_relay():
    assert 'upstream-base-url: "https://ntfy.sh"' in push.conf_text(True)
    assert "upstream" not in push.conf_text(False)


def test_write_conf_writes_on_change_only(db, tmp_path, monkeypatch):
    f = tmp_path / "server.yml"
    fam = get_family(db)
    monkeypatch.setattr(settings, "NTFY_CONF_FILE", None)
    push.write_conf(fam)
    assert not f.exists()
    monkeypatch.setattr(settings, "NTFY_CONF_FILE", str(f))
    fam.ntfy_upstream_relay = False
    push.write_conf(fam)
    assert f.read_text() == "# relay off\n"
    m = f.stat().st_mtime_ns
    push.write_conf(fam)
    assert f.stat().st_mtime_ns == m
    fam.ntfy_upstream_relay = True
    push.write_conf(fam)
    assert "upstream-base-url" in f.read_text()
