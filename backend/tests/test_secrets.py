import json
import multiprocessing
import stat

from app.core.secrets import NAMES, load_or_create_secrets


def test_creates_file_with_three_32plus_char_secrets(tmp_path, monkeypatch):
    for n in NAMES:
        monkeypatch.delenv(n, raising=False)
    result = load_or_create_secrets(tmp_path)
    assert set(result) == set(NAMES)
    assert all(len(v) >= 32 for v in result.values())
    assert len(set(result.values())) == 3
    path = tmp_path / "secrets.json"
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert json.loads(path.read_text()) == result


def test_second_call_returns_same_values(tmp_path, monkeypatch):
    for n in NAMES:
        monkeypatch.delenv(n, raising=False)
    assert load_or_create_secrets(tmp_path) == load_or_create_secrets(tmp_path)


def test_env_overrides_file(tmp_path, monkeypatch):
    for n in NAMES:
        monkeypatch.delenv(n, raising=False)
    stored = load_or_create_secrets(tmp_path)
    monkeypatch.setenv("SECRET_KEY", "from-env")
    result = load_or_create_secrets(tmp_path)
    assert result["SECRET_KEY"] == "from-env"
    assert result["JWT_SECRET_KEY"] == stored["JWT_SECRET_KEY"]


def _worker(path, q):
    q.put(load_or_create_secrets(path))


def test_concurrent_first_boot_same_secrets(tmp_path, monkeypatch):
    for n in NAMES:
        monkeypatch.delenv(n, raising=False)
    ctx = multiprocessing.get_context("spawn")
    q = ctx.Queue()
    procs = [ctx.Process(target=_worker, args=(tmp_path, q)) for _ in range(4)]
    for p in procs:
        p.start()
    results = [q.get(timeout=60) for _ in procs]
    for p in procs:
        p.join()
    assert all(r == results[0] for r in results)
    assert json.loads((tmp_path / "secrets.json").read_text()) == results[0]


def test_existing_loose_file_tightened_to_0600(tmp_path, monkeypatch):
    for n in NAMES:
        monkeypatch.delenv(n, raising=False)
    load_or_create_secrets(tmp_path)
    path = tmp_path / "secrets.json"
    path.chmod(0o644)
    load_or_create_secrets(tmp_path)
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
