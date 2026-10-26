"""Parent API: today's chore runs, approve and send back."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db, require_parent
from app.models.chores import ChoreRun, RunStepTick
from app.models.family import get_family
from app.models.lock import Device
from app.models.points import Points
from app.models.user import User, UserRole
from app.services import badges, chat, economy, kid_events
from app.services import chores as svc
from app.services.economy import award_chore

router = APIRouter(prefix="/api/v1/chores", tags=["chores"])

NOT_WAITING = "This chore isn't waiting for approval."


def _shared_devices_without_pin(db: Session) -> list[dict]:
    """Shared devices where multiple kids own it but at least one lacks a PIN."""
    nudges = []
    for device in db.query(Device).all():
        active_kids = [k for k in device.owners if k.role == UserRole.KID and k.is_active]
        if len(active_kids) >= 2:
            kids_without_pin = [k for k in active_kids if not k.pin_hash]
            if kids_without_pin:  # At least one kid on a shared device has no PIN
                nudges.append(
                    {
                        "device_id": device.id,
                        "device_name": device.name,
                        "kid_ids": [k.id for k in active_kids],
                        "kid_names": [k.full_name for k in active_kids],
                    }
                )
    return nudges


def _waiting(db: Session, run_id: int) -> ChoreRun:
    r = db.get(ChoreRun, run_id)
    if r is None:
        raise HTTPException(404, "That chore doesn't exist.")
    if r.status != "submitted":
        raise HTTPException(409, NOT_WAITING)
    return r


@router.get("/today")
def today(db: Session = Depends(get_db), _: User = Depends(require_parent)):
    out: dict[str, list | list[dict]] = {}
    fam = get_family(db)
    for r in svc.with_detail(svc.day_runs(db, svc.today(db)), kids=True).order_by(ChoreRun.id):
        for kid_id in svc.run_kid_ids(r):
            out.setdefault(str(kid_id), []).append(svc.chore_out(r, fam))
    # Add nudge for shared devices without PINs
    out["shared_without_pin"] = _shared_devices_without_pin(db)
    return out


@router.get("/{run_id}")
def run_detail(run_id: int, db: Session = Depends(get_db), _: User = Depends(require_parent)):
    r = (
        db.query(ChoreRun)
        .options(
            selectinload(ChoreRun.assignment),
            selectinload(ChoreRun.ticks),
            selectinload(ChoreRun.photos),
        )
        .get(run_id)
    )
    if r is None:
        raise HTTPException(404, "That chore doesn't exist.")

    chore, fam = svc.chore_of(r), get_family(db)
    return {
        "id": r.id,
        "title": chore.title,
        "points": chore.points or 0,
        "state": svc.state(r),
        "can_move": svc.can_move(r, svc.tomorrow(db)),
        "due_time": r.assignment.due_time,
        "kid_ids": svc.run_kid_ids(r),
        "steps": svc.steps_out(r, fam),
        "due_at": svc.iso_z(svc.due_at(r, fam)),
        "type": svc.type_out(chore),
        "sent_back": svc.sent_back(r),
        "note": svc.note_out(r, svc.note_texts(db, [r])),
        "photos": [{"id": p.id, "thumb_url": f"/chore-photos/{p.id}/thumb"} for p in r.photos],
    }


@router.post("/{run_id}/approve")
def approve(run_id: int, db: Session = Depends(get_db), parent: User = Depends(require_parent)):
    r = _waiting(db, run_id)
    r.status = "done"
    r.approved_at = r.completed_at = datetime.utcnow()
    r.approved_by_id = parent.id
    svc.clear_note(r)
    fam = get_family(db)
    pts = award_chore(db, r, fam)
    chat.system(db, r, f"Approved · +{pts}")
    badges.check_for_run(db, r, fam)
    kid_events.chore_decided(db, r, True)
    db.commit()
    return svc.chore_out(r, fam)


@router.post("/{run_id}/done")
def mark_done(run_id: int, db: Session = Depends(get_db), parent: User = Depends(require_parent)):
    """Parent ticks a to-do chore off for the kid: same as submit + approve."""
    r = db.get(ChoreRun, run_id)
    if r is None:
        raise HTTPException(404, "That chore doesn't exist.")
    if r.status != "todo":
        raise HTTPException(409, "This chore is already done or waiting for your OK.")
    if r.kid_id is None and r.assignment.mode == "race":
        raise HTTPException(409, "Race chores go to the kid who finishes first.")
    now = datetime.utcnow()
    have = {t.step_id for t in r.ticks}
    for s in svc.chore_of(r).steps:
        if s.id not in have:
            r.ticks.append(RunStepTick(step_id=s.id, done_by_id=parent.id, done_at=now))
    r.status, r.submitted_at = "submitted", now
    return approve(run_id, db, parent)


@router.post("/{run_id}/undo")
def mark_not_done(run_id: int, db: Session = Depends(get_db), _: User = Depends(require_parent)):
    """Parent unticks a done chore: back to to-do, its points and step ticks removed."""
    r = db.get(ChoreRun, run_id)
    if r is None:
        raise HTTPException(404, "That chore doesn't exist.")
    if r.status == "skipped":
        r.status = "todo"
        chat.system(db, r, "Back on today's list")
        db.commit()
        return svc.chore_out(r, get_family(db))
    if r.status != "done":
        raise HTTPException(409, "This chore isn't done.")
    # ponytail: spent points can leave the balance below 0; badges already earned stay
    db.query(Points).filter(Points.run_id == r.id).delete()
    r.ticks.clear()
    r.status = "todo"
    r.approved_at = r.completed_at = r.approved_by_id = None
    r.submitted_at = r.submitted_by_id = None
    chat.system(db, r, "Marked not done")
    db.commit()
    return svc.chore_out(r, get_family(db))


@router.post("/{run_id}/move")
def move(run_id: int, db: Session = Depends(get_db), _: User = Depends(require_parent)):
    """Push a to-do chore to tomorrow's list (once per assignment per day)."""
    r = db.get(ChoreRun, run_id)
    if r is None:
        raise HTTPException(404, "That chore doesn't exist.")
    if r.status != "todo":
        raise HTTPException(409, "Only a chore that's still to do can move.")
    tmrw = svc.tomorrow(db)
    if not svc.can_move(r, tmrw):
        raise HTTPException(409, "It's already on tomorrow's list. Try Skip today.")
    r.day = tmrw
    r.ticks.clear()
    svc.clear_note(r)
    chat.system(db, r, "Moved to tomorrow")
    db.commit()
    return svc.chore_out(r, get_family(db))


@router.post("/{run_id}/skip")
def skip(run_id: int, db: Session = Depends(get_db), _: User = Depends(require_parent)):
    """Skip today's chore with no penalty: it drops out of counts, locks and streaks."""
    r = db.get(ChoreRun, run_id)
    if r is None:
        raise HTTPException(404, "That chore doesn't exist.")
    if r.status not in ("todo", "submitted"):
        raise HTTPException(409, "Only a chore that's to do or waiting can be skipped.")
    r.status = "skipped"
    svc.clear_note(r)
    chat.system(db, r, "Skipped today (no penalty)")
    db.commit()
    return svc.chore_out(r, get_family(db))


class SendBack(BaseModel):
    note: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class DeductIn(BaseModel):
    kid_id: int
    amount: Annotated[int, Field(ge=1, le=500)]
    note: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


@router.post("/{run_id}/deduct")
def deduct(
    run_id: int,
    body: DeductIn,
    db: Session = Depends(get_db),
    parent: User = Depends(require_parent),
):
    r = db.get(ChoreRun, run_id)
    if r is None:
        raise HTTPException(404, "That chore doesn't exist.")
    if body.kid_id not in svc.run_kid_ids(r):
        raise HTTPException(422, "That kid isn't on this chore.")
    take = economy.deduct(db, body.kid_id, body.amount, body.note, parent.id, r.id)
    if take:
        chat.system(db, r, f"\u2212{take} points: {body.note}")
    db.commit()
    return {"balance": economy.balance(db, body.kid_id), "deducted": take}


@router.post("/{run_id}/send-back")
def send_back(
    run_id: int,
    body: SendBack,
    db: Session = Depends(get_db),
    _: User = Depends(require_parent),
):
    r = _waiting(db, run_id)
    r.status = "todo"
    r.attempt = (r.attempt or 1) + 1
    r.last_note = body.note
    submitter = r.submitted_by_id
    r.submitted_at = r.submitted_by_id = None
    chat.system(db, r, f"Sent back: {body.note}")
    kid_events.chore_decided(db, r, False, body.note, submitter)
    db.commit()
    return svc.chore_out(r, get_family(db))
