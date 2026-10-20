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
