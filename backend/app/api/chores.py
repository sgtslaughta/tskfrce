"""Parent API: today's chore runs, approve and send back."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, StringConstraints
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db, require_parent
from app.models.chores import ChoreRun, RunStepTick
from app.models.family import get_family
from app.models.lock import Device
from app.models.points import Points
from app.models.user import User, UserRole
from app.services import badges, chat
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
    for r in svc.day_runs(db, svc.today(db)).order_by(ChoreRun.id):
        for kid_id in svc.run_kid_ids(r):
            out.setdefault(str(kid_id), []).append(svc.chore_out(r))
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

    chore = svc.chore_of(r)
    return {
        "id": r.id,
        "title": chore.title,
        "points": chore.points or 0,
        "state": svc.state(r),
        "due_time": r.assignment.due_time,
        "kid_ids": svc.run_kid_ids(r),
        "steps": svc.steps_out(r),
        "photos": [{"id": p.id, "thumb_url": f"/chore-photos/{p.id}/thumb"} for p in r.photos],
    }


@router.post("/{run_id}/approve")
def approve(run_id: int, db: Session = Depends(get_db), parent: User = Depends(require_parent)):
    r = _waiting(db, run_id)
    r.status = "done"
    r.approved_at = r.completed_at = datetime.utcnow()
    r.approved_by_id = parent.id
    fam = get_family(db)
    pts = award_chore(db, r, fam)
    chat.system(db, r, f"Approved · +{pts}")
    badges.check_for_run(db, r, fam)
    db.commit()
    return svc.chore_out(r)


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
    return svc.chore_out(r)


class SendBack(BaseModel):
    note: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


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
    r.submitted_at = r.submitted_by_id = None
    chat.system(db, r, f"Sent back: {body.note}")
    db.commit()
    return svc.chore_out(r)
