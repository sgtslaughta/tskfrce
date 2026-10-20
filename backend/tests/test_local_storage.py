import pytest
from app.services.local_storage import LocalStorage


@pytest.fixture
def storage(tmp_path):
    return LocalStorage(tmp_path / "uploads")


def test_save_then_open_returns_same_bytes(storage):
    assert storage.save("1/a.txt", b"hello", "text/plain") == "1/a.txt"
    assert storage.open("1/a.txt").read_bytes() == b"hello"


def test_key_with_dotdot_rejected(storage):
    with pytest.raises(ValueError):
        storage.save("../x", b"nope", "text/plain")
    with pytest.raises(ValueError):
        storage.open("../x")


def test_delete_removes_file(storage):
    storage.save("a.txt", b"x", "text/plain")
    storage.delete("a.txt")
    with pytest.raises(FileNotFoundError):
        storage.open("a.txt")
    storage.delete("a.txt")  # deleting twice is fine


def test_stats_counts_files(storage):
    assert storage.stats() == {"files": 0, "bytes": 0}
    storage.save("1/a.txt", b"abc", "text/plain")
    storage.save("2/b.txt", b"de", "text/plain")
    assert storage.stats() == {"files": 2, "bytes": 5}
