"""Chore day: when the family's day rolls over (reset time, family time zone)."""

from datetime import date, datetime, time, timedelta

from app.lock.schedule import local_now
from app.models.family import FamilySettings


def reset_due(fam: FamilySettings, now_local: datetime) -> bool:
    """Chore day only moves forward (a time zone change west must not rewind it)."""
    return now_local.time() >= time.fromisoformat(fam.reset_time) and (
        fam.last_reset_date is None or now_local.date() > fam.last_reset_date
    )


def chore_day(fam: FamilySettings) -> date | None:
    """The chore day every rule/query uses (changes only at reset)."""
    return fam.last_reset_date


def current_chore_day(fam: FamilySettings, now_utc: datetime) -> date:
    """last_reset_date, or on a fresh install the day the last reset time fell on."""
    if fam.last_reset_date:
        return fam.last_reset_date
    now = local_now(fam.timezone, now_utc)
    before_reset = now.time() < time.fromisoformat(fam.reset_time)
    return now.date() - timedelta(days=before_reset)
