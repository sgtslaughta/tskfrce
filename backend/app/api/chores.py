"""Chore API: parents define chores and approve them."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.lock.reset import chore_day, make_instance, midnight
from app.lock.schedule import local_now, occurs_on
from app.models.family import get_family
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole
from app.schemas.chore import ChoreCreate, ChoreOut

router = APIRouter(prefix="/api/v1/chores", tags=["chores"])


def _out(t: Task) -> dict:
    return ChoreOut(
        id=t.id,
        title=t.title,
        kid_id=t.assigned_to_id,
        points=t.points or 0,
        status=t.status.value,
        due_date=t.due_date.date().isoformat() if t.due_date else None,
        needs_photo=bool((t.recurrence_pattern or {}).get("needs_photo")),
    ).model_dump()


@router.post("/")
def create_chore(
    body: ChoreCreate, db: Session = Depends(get_db), parent: User = Depends(require_parent)
):
    kid = db.get(User, body.kid_id)
    if kid is None or kid.role != UserRole.KID:
        raise HTTPException(404, "That kid doesn't exist. Pick a kid from the list.")
    fam = get_family(db)
    day = chore_day(fam) or local_now(fam.timezone, datetime.utcnow()).date()
    pattern = {**body.repeat.model_dump(), "needs_photo": body.needs_photo}
    once = body.repeat.type == "once"
    defn = Task(
        title=body.title,
        is_recurring=not once,
        recurrence_pattern=pattern,
        assigned_to_id=kid.id,
        created_by_id=parent.id,
        points=body.points,
        status=TaskStatus.TODO,
        due_date=midnight(day) if once else None,
    )
    db.add(defn)
    inst = None
    if not once and occurs_on(pattern, day):
        db.flush()
        inst = make_instance(defn, day)
        db.add(inst)
    db.commit()
    # a one-time chore is its own instance
    return {
        "definition": None if once else _out(defn),
        "instance": _out(inst or defn) if inst or once else None,
    }


@router.get("/today")
def today(db: Session = Depends(get_db), _: User = Depends(require_parent)):
    day = chore_day(get_family(db))
    out: dict[str, list] = {}
    if day is not None:
        rows = db.query(Task).filter(
            Task.is_recurring.is_(False),
            Task.due_date == midnight(day),
            Task.status != TaskStatus.CANCELLED,
        )
        for t in rows:
            out.setdefault(str(t.assigned_to_id), []).append(_out(t))
    return out


@router.post("/{chore_id}/approve")
def approve(chore_id: int, db: Session = Depends(get_db), parent: User = Depends(require_parent)):
    t = db.get(Task, chore_id)
    if t is None:
        raise HTTPException(404, "We couldn't find that chore.")
    if t.status != TaskStatus.SUBMITTED_FOR_APPROVAL:
        raise HTTPException(409, "This chore isn't waiting for approval.")
    t.status = TaskStatus.DONE
    t.approved_at = t.completed_at = datetime.utcnow()
    t.approved_by_id = parent.id
    db.commit()
    return _out(t)


@router.delete("/{definition_id}", status_code=204)
def delete_chore(
    definition_id: int, db: Session = Depends(get_db), _: User = Depends(require_parent)
):
    d = db.get(Task, definition_id)
    if d is None or not d.is_recurring:
        raise HTTPException(404, "We couldn't find that repeating chore.")
    d.is_recurring = False  # stops future instances; finished history stays
    d.status = TaskStatus.CANCELLED
    for t in db.query(Task).filter(
        Task.parent_task_id == d.id,
        Task.status.notin_([TaskStatus.DONE, TaskStatus.CANCELLED]),
    ):
        t.status = TaskStatus.CANCELLED
    db.commit()
