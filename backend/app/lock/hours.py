"""Hour rules: which windows apply to a device on a given day."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import NamedTuple

from sqlalchemy.orm import Session, selectinload

from app.lock.schedule import Window, in_window
from app.models.hours import HourRule

CATEGORY_RANK = {"holiday": 0, "summer": 1, "weekend": 2, "school_night": 3, "other": 4}


@dataclass(frozen=True)
class RuleView:
    id: int
    category: str
    kind: str
    days: frozenset[int]
    start_date: date | None
    end_date: date | None
    everyone: bool
    kid_ids: frozenset[int]
    group_ids: frozenset[int]
    windows: tuple[Window, ...]


class Resolved(NamedTuple):
    allowed_sets: tuple[tuple[Window, ...], ...]
    free: tuple[Window, ...]
    off: tuple[Window, ...]


def load(db: Session) -> list[RuleView]:
    rows = (
        db.query(HourRule)
        .options(selectinload(HourRule.times), selectinload(HourRule.targets))
        .order_by(HourRule.id)
        .all()
    )
    out = []
    for r in rows:
        days = frozenset(int(c) for c in r.days)
        out.append(
            RuleView(
                id=r.id,
                category=r.category,
                kind=r.kind,
                days=days,
                start_date=r.start_date,
                end_date=r.end_date,
                everyone=bool(r.everyone),
                kid_ids=frozenset(r.kid_ids),
                group_ids=frozenset(r.group_ids),
                windows=tuple(
                    Window(days, time.fromisoformat(t.start), time.fromisoformat(t.end))
                    for t in r.times
                ),
            )
        )
    return out


def in_range(r: RuleView, d: date) -> bool:
    return (r.start_date is None or d >= r.start_date) and (r.end_date is None or d <= r.end_date)


def active_on(r: RuleView, d: date) -> bool:
    return d.weekday() in r.days and in_range(r, d)


def _pin(r: RuleView, day: date, overnight_only: bool) -> tuple[Window, ...]:
    """Windows pinned to one weekday: that day's evening, or only the next morning's tail."""
    wd = frozenset({day.weekday()})
    return tuple(
        Window(wd, w.start, w.end) for w in r.windows if not overnight_only or w.start > w.end
    )


def _rank(r: RuleView, keys: set) -> tuple[int, int, int]:
    t = 0 if any(k[0] == "kid" for k in keys) else 1 if any(k[0] == "group" for k in keys) else 2
    tier = 0 if r.category in ("holiday", "summer") else 1  # date-range rules always win
    return (tier, t, CATEGORY_RANK[r.category])


def _keys(r: RuleView, p: tuple[str, int], group_ids: set[int]) -> set:
    keys = {("group", g) for g in r.group_ids & group_ids}
    if p[0] == "kid":
        if p[1] in r.kid_ids:
            keys.add(("kid", p[1]))
        if r.everyone:
            keys.add(("all", 0))
    return keys


def _best(cands: list) -> list:
    if not cands:
        return []
    best = min(_rank(r, k) for r, k in cands)
    return [(r, k) for r, k in cands if _rank(r, k) == best]


def resolve(rules, owner_ids: set[int], group_ids: set[int], d: date) -> Resolved:
    """Hours for a device on local date `d`, resolved per owner and intersected.

    Fails closed: a principal with rules in range but none for today is blocked all day.
    """
    # ponytail: rules are picked by local date; an overnight tail follows the previous day's pick
    y = d - timedelta(days=1)
    principals = (
        [("kid", k) for k in sorted(owner_ids)]
        if owner_ids
        else [("device", 0)]
        if group_ids
        else []
    )
    sets: list[tuple[Window, ...]] = []
    free: list[Window] = []
    off: list[Window] = []
    for p in principals:
        mine = [(r, k) for r in rules if (k := _keys(r, p, group_ids))]
        for r, _ in mine:
            if r.kind in ("free", "off"):
                out = free if r.kind == "free" else off
                if active_on(r, d):
                    out.extend(_pin(r, d, False))
                if active_on(r, y):
                    out.extend(_pin(r, y, True))
        allowed = [(r, k) for r, k in mine if r.kind == "allowed"]
        if not any(in_range(r, d) or in_range(r, y) for r, _ in allowed):
            continue  # no hours set for this principal: unrestricted
        today = _best([(r, k) for r, k in allowed if active_on(r, d)])
        tail = [
            w
            for r, _ in _best([(r, k) for r, k in allowed if active_on(r, y)])
            for w in _pin(r, y, True)
        ]
        by_key: dict = {}
        for r, keys in today:
            for k in keys:
                by_key.setdefault(k, []).extend(_pin(r, d, False))
        mine_sets = [tuple(v + tail) for v in by_key.values()] or [tuple(tail)]
        sets.extend(mine_sets)
    return Resolved(tuple(sets), tuple(free), tuple(off))


def _allowing(allowed_sets, off, t: datetime) -> bool:
    return all(any(in_window(w, t) for w in s) for s in allowed_sets) and not any(
        in_window(w, t) for w in off
    )


def locks_at(allowed_sets, off, now_local: datetime) -> datetime | None:
    """First whole minute within 24 h where hours stop allowing, else None."""
    # ponytail: minute scan (1440 steps); window edges are whole minutes
    if not allowed_sets and not off:
        return None
    if not _allowing(allowed_sets, off, now_local):
        return None
    t = now_local.replace(second=0, microsecond=0)
    for _ in range(24 * 60):
        t += timedelta(minutes=1)
        if not _allowing(allowed_sets, off, t):
            return t
    return None


def today_category(rules, d: date) -> str | None:
    cats = [r.category for r in rules if r.everyone and r.kind == "allowed" and active_on(r, d)]
    return min(cats, key=CATEGORY_RANK.__getitem__) if cats else None
