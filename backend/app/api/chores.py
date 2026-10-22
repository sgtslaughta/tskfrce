"""Parent API: today's chore runs, approve and send back."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, StringConstraints
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.models.chores import ChoreRun
from app.models.family import get_family
from app.models.user import User
from app.services import badges, chat
from app.services import chores as svc
from app.services.economy import award_chore

router = APIRouter(prefix="/api/v1/chores", tags=["chores"])

NOT_WAITING = "This chore isn't waiting for approval."


def _waiting(db: Session, run_id: int) -> ChoreRun:
    r = db.get(ChoreRun, run_id)
    if r is None:
        raise HTTPException(404, "That chore doesn't exist.")
    if r.status != "submitted":
        raise HTTPException(409, NOT_WAITING)
    return r


@router.get("/today")
def today(db: Session = Depends(get_db), _: User = Depends(require_parent)):
    out: dict[str, list] = {}
    for r in svc.day_runs(db, svc.today(db)).order_by(ChoreRun.id):
        for kid_id in svc.run_kid_ids(r):
            out.setdefault(str(kid_id), []).append(svc.chore_out(r))
    return out


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
