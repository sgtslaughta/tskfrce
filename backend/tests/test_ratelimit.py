import pytest
from app.core import ratelimit
from fastapi import HTTPException


@pytest.fixture(autouse=True)
def _clean():
    ratelimit.reset()
    yield
    ratelimit.reset()


def test_limit_blocks_then_expires(monkeypatch):
    t = [100.0]
    monkeypatch.setattr(ratelimit.time, "monotonic", lambda: t[0])
    ratelimit.limit("k", 2, 60)
    ratelimit.limit("k", 2, 60)
    with pytest.raises(HTTPException):
        ratelimit.limit("k", 2, 60)
    t[0] += 61
    ratelimit.limit("k", 2, 60)


def test_stale_keys_are_dropped(monkeypatch):
    t = [0.0]
    monkeypatch.setattr(ratelimit.time, "monotonic", lambda: t[0])
    monkeypatch.setattr(ratelimit, "SWEEP_ABOVE", 5)
    for i in range(10):
        ratelimit.hit(f"u{i}", 60)
    t[0] += 61
    ratelimit.hit("fresh", 60)
    assert set(ratelimit._hits) == {"fresh"} and set(ratelimit._spans) == {"fresh"}
    ratelimit.check("never-hit", 3, 60)
    assert "never-hit" not in ratelimit._hits
