import json

import pytest

from blocker.config import Config


def _env(tmp_path, **extra):
    return {
        "BACKEND_URL": "http://backend:8000",
        "BLOCKER_URL_HOST": "blocker",
        "LAN_IFACE": "eth0",
        "DATA_DIR": str(tmp_path),
        **extra,
    }


def test_from_env_reads_token_from_secrets_file(tmp_path):
    (tmp_path / "secrets.json").write_text(json.dumps({"INTERNAL_TOKEN": "filetok"}))
    cfg = Config.from_env(_env(tmp_path))
    assert cfg.internal_token == "filetok"
    assert cfg.blocker_port == 7777
    assert cfg.scan_interval == 20
    assert cfg.reconcile_interval == 30
    assert cfg.portal_redirect_url == "http://task4ce.local/kid"
    assert cfg.data_dir == tmp_path


def test_from_env_env_overrides_file(tmp_path):
    (tmp_path / "secrets.json").write_text(json.dumps({"INTERNAL_TOKEN": "filetok"}))
    cfg = Config.from_env(_env(tmp_path, INTERNAL_TOKEN="envtok", BLOCKER_PORT="9000"))
    assert cfg.internal_token == "envtok"
    assert cfg.blocker_port == 9000


def test_missing_token_raises(tmp_path):
    with pytest.raises(RuntimeError):
        Config.from_env(_env(tmp_path))


def test_resist_interval_default_15_and_env(tmp_path):
    base = _env(tmp_path, INTERNAL_TOKEN="t")
    assert Config.from_env(base).resist_interval == 15
    assert Config.from_env({**base, "RESIST_INTERVAL": "5"}).resist_interval == 5
