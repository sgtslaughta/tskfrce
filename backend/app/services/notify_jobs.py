"""Timed notification jobs, run once per lock tick (all times: UTC in, family tz for display)."""

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.chores import ChoreRun
from app.models.family import get_family
from app.models.lock import Device
from app.models.notify import NotifyHeld, NotifyPlace
from app.models.user import User, UserRole
from app.services import chores as svc
from app.services import inbox, notify

log = get_logger(__name__)
SUMMARY_AT = "19:00"
OFFLINE_AFTER = timedelta(minutes=10)
_last: set[str] | None = None  # blocked MACs at the previous tick (None = no baseline yet)


def _naive(now_utc: datetime) -> datetime:
    """Naive UTC, matching blocker_last_seen and svc.due_at."""
    return now_utc.astimezone(UTC).replace(tzinfo=None)


def _kid_name(u: User) -> str:
    return u.full_name or u.username


def tick(db: Session, now_utc: datetime, blocked: list[str] | None = None) -> None:
    flush_held(db, now_utc)
    overdue(db, now_utc)
    box_offline(db, now_utc)
    daily_summary(db, now_utc)
    lock_changes(db, blocked)
    db.commit()


def flush_held(db: Session, now_utc: datetime) -> None:
    if notify.in_quiet(get_family(db), now_utc):
        return
    fam = get_family(db)
    for place in db.query(NotifyPlace).order_by(NotifyPlace.id):
        rows = (
            db.query(NotifyHeld)
            .filter(NotifyHeld.place_id == place.id)
            .order_by(NotifyHeld.created_at, NotifyHeld.id)
            .all()
        )
        if not rows:
            continue
        for r in rows:
            db.delete(r)
        if not place.enabled:  # disabled since: drop without sending
            continue
        n = len(rows)
        title = f"While you were away: {n} update{'s' if n != 1 else ''}"
        text = "\n".join(f"• {r.title}" for r in rows)
        url = notify.link(fam, "/?tab=needs")
        notify.send_to(db, place, title, text + (f"\n\n{url}" if url else ""))


def overdue(db: Session, now_utc: datetime) -> None:
    fam = get_family(db)
    now = _naive(now_utc)
    prev, fam.notify_scan_at = fam.notify_scan_at, now
    if prev is None:
        return
    tz = ZoneInfo(fam.timezone)
    runs = db.query(ChoreRun).filter(ChoreRun.day == svc.today(db, now_utc)).all()
    for r in runs:
        if svc.state(r) != "todo":
            continue
        due = svc.due_at(r, fam)
        if due is None or not prev < due <= now:
            continue
        kids = db.query(User).filter(User.id.in_(svc.run_kid_ids(r))).order_by(User.id).all()
        names = " and ".join(_kid_name(k) for k in kids)
        loc = due.replace(tzinfo=UTC).astimezone(tz)
        at = f"{loc.hour % 12 or 12}:{loc.minute:02d} {'AM' if loc.hour < 12 else 'PM'}"
        title = svc.chore_of(r).title
        notify.ping(
            db,
            "overdue",
            f"{names} hasn't finished {title}",
            f"It was due at {at}.",
            f"/?chore={r.id}",
        )


def box_offline(db: Session, now_utc: datetime) -> None:
    fam = get_family(db)
    seen = fam.blocker_last_seen
    if seen is None:
        return
    stale = _naive(now_utc) - seen > OFFLINE_AFTER
    if stale and not fam.blocker_alerted:
        fam.blocker_alerted = True
        inbox.notify_parents(
            db,
            "box_offline",
            "Home box offline",
            "The blocker hasn't checked in for 10 minutes, so devices can't be locked or unlocked.",
        )
    elif not stale and fam.blocker_alerted:
        fam.blocker_alerted = False


def daily_summary(db: Session, now_utc: datetime) -> None:
    fam = get_family(db)
    local = now_utc.astimezone(ZoneInfo(fam.timezone))
    if local.strftime("%H:%M") < SUMMARY_AT or fam.summary_date == local.date():
        return
    fam.summary_date = local.date()
    stats: dict[int, list[int]] = {}  # kid id -> [done, total]
    needs = 0
    for r in db.query(ChoreRun).filter(ChoreRun.day == svc.today(db, now_utc)):
        st = svc.state(r)
        needs += st == "needs_you"
        if st == "skipped":
            continue
        for kid_id in svc.run_kid_ids(r):
            s = stats.setdefault(kid_id, [0, 0])
            s[0] += st == "done"
            s[1] += 1
    kids = (
        db.query(User)
        .filter(User.id.in_(stats), User.role == UserRole.KID, User.is_active)
        .order_by(User.id)
    )
    lines = [f"{_kid_name(k)}: {stats[k.id][0]} of {stats[k.id][1]} done" for k in kids]
    if needs:
        lines.append(f"{needs} waiting for your OK")
    notify.ping(db, "summary", f"Today at {fam.name}", "\n".join(lines), "/")


def lock_changes(db: Session, blocked: list[str] | None) -> None:
    global _last
    if blocked is None:
        return
    now = set(blocked)
    prev, _last = _last, now
    if prev is None:
        return
    for label, macs in (("Locked", now - prev), ("Unlocked", prev - now)):
        if not macs:
            continue
        devs = db.query(Device).filter(Device.mac.in_(macs)).order_by(Device.name).all()
        names = [d.name for d in devs if d.owners]
        if names:
            notify.ping(db, "lock_change", f"{label}: {', '.join(names)}", None, "/devices")
