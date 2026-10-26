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


def active_on(r: RuleView, d: date) -> bool:
    if d.weekday() not in r.days:
        return False
    return (r.start_date is None or d >= r.start_date) and (r.end_date is None or d <= r.end_date)


def resolve(rules, owner_ids: set[int], group_ids: set[int], d: date) -> Resolved:
    matched = []
    for r in rules:
        if not active_on(r, d):
            continue
        keys = {("kid", k) for k in r.kid_ids & owner_ids} | {
            ("group", g) for g in r.group_ids & group_ids
        }
        if r.everyone and owner_ids:
            keys.add(("all", 0))
        if keys:
            matched.append((r, keys))
    free = tuple(w for r, _ in matched if r.kind == "free" for w in r.windows)
    off = tuple(w for r, _ in matched if r.kind == "off" for w in r.windows)
    allowed = [(r, k) for r, k in matched if r.kind == "allowed"]

    def rank(r, keys):
        t = (
            0
            if any(k[0] == "kid" for k in keys)
            else 1
            if any(k[0] == "group" for k in keys)
            else 2
        )
        tier = 0 if r.category in ("holiday", "summer") else 1  # date-range rules always win
        return (tier, t, CATEGORY_RANK[r.category])

    if not allowed:
        return Resolved((), free, off)
    best = min(rank(r, k) for r, k in allowed)
    sets: dict = {}
    for r, keys in allowed:
        if rank(r, keys) == best:
            for k in keys:
                sets.setdefault(k, []).extend(r.windows)
    return Resolved(tuple(tuple(v) for v in sets.values()), free, off)


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
