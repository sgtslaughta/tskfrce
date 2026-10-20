"""Pure schedule helpers: time windows and chore recurrence."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from zoneinfo import ZoneInfo


@dataclass(frozen=True)
class Window:
    days: frozenset[int]
    start: time
    end: time

    @classmethod
    def from_row(cls, row) -> "Window":
        """Build from any object with days ("0156"), start/end ("HH:MM")."""
        return cls(
            frozenset(int(c) for c in row.days),
            time.fromisoformat(row.start),
            time.fromisoformat(row.end),
        )


def in_window(w: Window, now_local: datetime) -> bool:
    wd, t = now_local.weekday(), now_local.time()
    if w.start < w.end:
        return wd in w.days and w.start <= t < w.end
    if w.start == w.end:
        return wd in w.days
    return (wd in w.days and t >= w.start) or ((wd - 1) % 7 in w.days and t < w.end)


def occurs_on(pattern: dict, d: date) -> bool:
    kind = pattern.get("type")
    if kind == "daily":
        return True
    if kind == "weekly":
        return d.weekday() in pattern.get("days", [])
    return False


def local_now(tz: str, now_utc: datetime) -> datetime:
    if now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=UTC)
    return now_utc.astimezone(ZoneInfo(tz))
