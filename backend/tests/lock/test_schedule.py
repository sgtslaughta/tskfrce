from datetime import UTC, date, datetime, time
from types import SimpleNamespace

from app.lock.schedule import Window, in_window, local_now, occurs_on

MON = date(2026, 10, 19)
TUE = date(2026, 10, 20)


def at(d, h, m=0):
    return datetime.combine(d, time(h, m))


def test_same_day_window():
    w = Window(frozenset({0}), time(16), time(20))
    assert in_window(w, at(MON, 16))
    assert not in_window(w, at(MON, 20))
    assert not in_window(w, at(TUE, 17))


def test_wrap_midnight():
    w = Window(frozenset({0}), time(20), time(2))
    assert in_window(w, at(MON, 20))
    assert in_window(w, at(TUE, 1))
    assert not in_window(w, at(TUE, 2))
    assert not in_window(w, at(MON, 19, 59))


def test_wrap_sunday_to_monday():
    w = Window(frozenset({6}), time(22), time(1))
    assert in_window(w, at(MON, 0, 30))


def test_equal_start_end_is_whole_day():
    w = Window(frozenset({0}), time(0), time(0))
    assert in_window(w, at(MON, 13))
    assert not in_window(w, at(TUE, 13))


def test_from_row():
    row = SimpleNamespace(days="06", start="20:00", end="02:30")
    assert Window.from_row(row) == Window(frozenset({0, 6}), time(20), time(2, 30))


def test_occurs_on():
    weekly = {"type": "weekly", "days": [5, 6]}
    assert occurs_on(weekly, date(2026, 10, 24))
    assert not occurs_on(weekly, date(2026, 10, 26))
    assert occurs_on({"type": "daily"}, MON)
    assert not occurs_on({"type": "monthly"}, MON)


def test_local_now():
    n = local_now("America/New_York", datetime(2026, 10, 20, 12, tzinfo=UTC))
    assert n.hour == 8


def test_wrap_window_not_active_on_unrelated_days():
    w = Window(frozenset({0}), time(20), time(2))
    assert not in_window(w, at(date(2026, 10, 21), 1))  # Wed 01:00
    assert not in_window(w, at(MON, 1))  # Mon 01:00 (Sunday not in days)


def test_whole_day_window_does_not_spill_to_next_day():
    w = Window(frozenset({0}), time(0), time(0))
    assert in_window(w, at(MON, 12))
    assert not in_window(w, at(TUE, 0, 30))


def test_local_now_dst_fallback():
    # 2026-11-01 06:00 UTC is the instant NY falls back: 02:00 EDT -> 01:00 EST
    n = local_now("America/New_York", datetime(2026, 11, 1, 6, tzinfo=UTC))
    assert (n.hour, n.minute, n.utcoffset().total_seconds()) == (1, 0, -5 * 3600)
