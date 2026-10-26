"""Time-based kid alerts (due soon, missed, lock warning), run by the lock loop."""

from datetime import UTC, datetime, timedelta
from math import ceil

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.lock.rules import is_online
from app.lock.schedule import local_now
from app.lock.state import device_facts
from app.models.family import get_family
from app.models.user import User, UserRole
from app.services import chores as svc
from app.services import economy, inbox

SOON = timedelta(minutes=30)


def _send(db: Session, kids: list[int], kind: str, title: str, body, **kw) -> int:
    """notify in a savepoint: a concurrent duplicate (same dedup_key) must not abort the scan."""
    try:
        with db.begin_nested():
            return inbox.notify(db, kids, kind, title, body, **kw)
    except IntegrityError:
        return 0


def _clock(due_time: str) -> str:
    h, m = map(int, due_time.split(":"))
    return f"{h % 12 or 12}:{m:02d} {'AM' if h < 12 else 'PM'}"


def _check(db, kids, run, now, due, key, title, body, late_body) -> int:
    if due is None:
        return 0
    if now >= due:
        return _send(
            db, kids, "missed_deadline", f"{title} is late", late_body, run_id=run.id,
            dedup_key=f"late:{key}",
        )  # fmt: skip
    if now >= due - SOON:
        m = ceil((due - now).total_seconds() / 60)
        return _send(
            db, kids, "due_soon", f"{title} is due in {m} min", body, run_id=run.id,
            dedup_key=f"soon:{key}",
        )  # fmt: skip
    return 0


def _deadlines(db: Session, now: datetime) -> int:
    fam = get_family(db)
    naive = now.astimezone(UTC).replace(tzinfo=None)
    n = 0
    for run in svc.with_detail(svc.day_runs(db, svc.today(db, now))):
        if svc.state(run) != "todo":
            continue
        kids = svc.run_kid_ids(run)
        chore = svc.chore_of(run)
        due_time = run.assignment.due_time
        n += _check(
            db, kids, run, naive, economy.deadline_utc(fam, run.day, due_time), f"r{run.id}",
            chore.title, None,
            f"It was due at {_clock(due_time)}. Finish it as soon as you can." if due_time else "",
        )  # fmt: skip
        ticked = {t.step_id for t in run.ticks}
        for step in chore.steps:
            if step.due_time and step.id not in ticked:
                n += _check(
                    db, kids, run, naive, economy.deadline_utc(fam, run.day, step.due_time),
                    f"s{run.id}:{step.id}", step.title, f"Part of {chore.title}",
                    f"Part of {chore.title}",
                )  # fmt: skip
    return n


def _lock_warnings(db: Session, now: datetime) -> int:
    fam = get_family(db)

    def locked(devices, t: datetime) -> bool:
        lt = local_now(fam.timezone, t)
        return any(not is_online(device_facts(db, d, fam, t), lt) for d in devices)

    n = 0
    for kid in db.query(User).filter(User.role == UserRole.KID, User.is_active):
        devices = kid.devices
        if not devices or locked(devices, now):
            continue
        m = next((m for m in range(1, 11) if locked(devices, now + timedelta(minutes=m))), None)
        if m is None:
            continue
        at = local_now(fam.timezone, now + timedelta(minutes=m))
        approved, total = svc.counts(db, kid.id, svc.today(db, now))
        left = total - approved
        body = (
            f"Finish {left} more chore{'s' if left != 1 else ''} to keep it on."
            if left > 0
            else "Time to wrap up."
        )
        n += _send(
            db, [kid.id], "lock_warning", f"Internet goes off in {m} min", body,
            dedup_key=f"lock:{at:%Y-%m-%dT%H:%M}",
        )  # fmt: skip
    return n


def scan(db: Session, now_utc: datetime) -> int:
    """Create the alerts that are due now; commits; returns how many were added."""
    now = now_utc if now_utc.tzinfo else now_utc.replace(tzinfo=UTC)
    n = _deadlines(db, now) + _lock_warnings(db, now)
    db.commit()
    return n
