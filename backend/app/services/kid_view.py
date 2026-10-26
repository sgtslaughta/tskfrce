"""Kid payload helpers: what the kid screen shows beyond a chore's basics."""

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.lock.schedule import Window, local_now, window_end
from app.models.chores import ChoreRun, ChoreSeen
from app.models.lock import TimeWindow
from app.models.user import User
from app.services import chores as svc

NEW_FOR = timedelta(hours=24)


def names(db: Session, ids: set[int]) -> dict[int, User]:
    return {u.id: u for u in db.query(User).filter(User.id.in_(ids))} if ids else {}


def seen_ids(db: Session, kid_id: int, assignment_ids) -> set[int]:
    ids = set(assignment_ids)
    if not ids:
        return set()
    rows = db.query(ChoreSeen.assignment_id).filter(
        ChoreSeen.kid_id == kid_id, ChoreSeen.assignment_id.in_(ids)
    )
    return {a for (a,) in rows}


def extras(
    run: ChoreRun,
    fam,
    takers: dict[int, User],
    deds: list[dict],
    texts: dict,
    seen: set[int],
    now: datetime,
) -> dict:
    """Fields the kid screen needs beyond the basics."""
    c, mode = svc.chore_of(run), svc.mode_of(run)
    taker = takers.get(run.submitted_by_id)
    fresh = run.assignment.created_at is not None and (
        run.assignment.created_at >= now.replace(tzinfo=None) - NEW_FOR
    )
    return {
        "mode": mode,
        "needs_photo": bool(c.needs_photo),
        "photo_count_current": svc.photo_count(run),
        "last_note": run.last_note,
        "subtasks": svc.steps_out(run, fam),
        "due_at": svc.iso_z(svc.due_at(run, fam)),
        "type": svc.type_out(c),
        "notes": svc.notes_out(run),
        "note": svc.note_out(run, texts),
        "sent_back": svc.sent_back(run),
        "deductions": deds,
        "taken_by": (taker.full_name or taker.username) if taker and mode == "race" else None,
        "new": fresh and run.assignment_id not in seen,
        "done_at": svc.iso_z(run.submitted_at or run.approved_at),
    }


def mine(deds: list[dict], kid_id: int) -> list[dict]:
    return [
        {k: d[k] for k in ("amount", "note", "by_name", "at")}
        for d in deds
        if d["kid_id"] == kid_id
    ]


def locks_at(db: Session, kid: User, fam, now_utc: datetime) -> str | None:
    """End of the kid's current allowed hours today (their own windows), as UTC ...Z."""
    rows = db.query(TimeWindow).filter(TimeWindow.kid_id == kid.id, TimeWindow.kind == "allowed")
    end = window_end([Window.from_row(r) for r in rows], local_now(fam.timezone, now_utc))
    return svc.iso_z(end.astimezone(UTC).replace(tzinfo=None)) if end else None
