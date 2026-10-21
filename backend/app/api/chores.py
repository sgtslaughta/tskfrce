from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.lock.reset import (
    assignee_ids,
    current_chore_day,
    is_chore_filter,
    make_instances,
    midnight,
    task_kid_ids,
)
from app.lock.schedule import occurs_on
from app.models.family import get_family
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole
from app.schemas.chore import ChoreCreate, ChoreOut, ChorePatch
from app.services.economy import award_chore

router = APIRouter(prefix="/api/v1/chores", tags=["chores"])

OPEN = (TaskStatus.TODO, TaskStatus.IN_PROGRESS)


def _out(t: Task) -> dict:
    p = t.recurrence_pattern or {}
    return ChoreOut(
        id=t.id,
        title=t.title,
        kid_id=t.assigned_to_id,
        kid_ids=assignee_ids(t) if t.is_recurring else task_kid_ids(t),
        mode=p.get("mode", "each"),
        points=t.points or 0,
        status=t.status.value,
        due_date=t.due_date.date().isoformat() if t.due_date else None,
        needs_photo=bool(p.get("needs_photo")),
        due_time=p.get("due_time"),
        subtasks=list(p.get("subtasks", [])) if t.is_recurring else [],
        attempt=t.attempt or 1,
        last_note=t.last_note,
        submitted_by_id=t.submitted_by_id,
    ).model_dump()


def _kids(db: Session, ids: list[int]) -> list[int]:
    ids = list(dict.fromkeys(ids))
    found = {k.id for k in db.query(User).filter(User.id.in_(ids), User.role == UserRole.KID)}
    if found != set(ids):
        raise HTTPException(404, "That kid doesn't exist. Pick a kid from the list.")
    return ids


@router.post("/")
def create_chore(
    body: ChoreCreate, db: Session = Depends(get_db), parent: User = Depends(require_parent)
):
    ids = _kids(db, body.kid_ids)
    fam = get_family(db)
    day = current_chore_day(fam, datetime.utcnow())
    pattern = {
        **body.repeat.model_dump(),
        "needs_photo": body.needs_photo,
        "chore": True,
        "assignees": ids,
        "mode": body.mode if len(ids) > 1 else "each",
        "subtasks": body.subtasks,
    }
    if body.due_time:
        pattern["due_time"] = body.due_time
    once = body.repeat.type == "once"
    defn = Task(
        title=body.title,
        is_recurring=not once,
        recurrence_pattern=pattern,
        assigned_to_id=ids[0],
        created_by_id=parent.id,
        points=body.points,
        status=TaskStatus.TODO,
        due_date=midnight(day) if once else None,
    )
    db.add(defn)
    db.flush()
    insts: list[Task] = []
    if once:
        # a one-time chore has no definition; its instances are built from a throwaway one
        insts = make_instances(defn, day)
        db.expunge(defn)
        for i in insts:
            i.parent_task_id = None
    elif occurs_on(pattern, day):
        insts = make_instances(defn, day)
    db.add_all(insts)
    db.commit()
    return {
        "definition": None if once else _out(defn),
        "instance": _out(insts[0]) if insts else None,
        "instances": [_out(i) for i in insts],
    }


@router.patch("/{definition_id}")
def patch_chore(
    definition_id: int,
    body: ChorePatch,
    db: Session = Depends(get_db),
    _: User = Depends(require_parent),
):
    d = db.get(Task, definition_id)
    if d is None or not d.is_recurring or not (d.recurrence_pattern or {}).get("chore"):
        raise HTTPException(404, "We couldn't find that repeating chore.")
    ch = body.model_dump(exclude_unset=True)
    p = dict(d.recurrence_pattern)
    if "title" in ch and ch["title"] is not None:
        d.title = ch["title"]
    if "points" in ch and ch["points"] is not None:
        d.points = ch["points"]
    if ch.get("repeat"):
        p.update(ch["repeat"])
    if "needs_photo" in ch and ch["needs_photo"] is not None:
        p["needs_photo"] = ch["needs_photo"]
    if "due_time" in ch:
        p.pop("due_time", None)
        if ch["due_time"]:
            p["due_time"] = ch["due_time"]
    if ch.get("subtasks") is not None:
        p["subtasks"] = ch["subtasks"]
    if ch.get("kid_ids"):
        ids = _kids(db, ch["kid_ids"])
        p["assignees"], d.assigned_to_id = ids, ids[0]
    if ch.get("mode"):
        p["mode"] = ch["mode"]
    if len(p.get("assignees") or []) <= 1:
        p["mode"] = "each"
    d.recurrence_pattern = p
    # today's untouched instances follow the edit; in-flight work is left alone
    for t in db.query(Task).filter(Task.parent_task_id == d.id, Task.status.in_(OPEN)):
        ip = dict(t.recurrence_pattern or {})
        for k in ("needs_photo", "due_time", "subtasks"):
            if k in p:
                ip[k] = p[k]
            else:
                ip.pop(k, None)
        t.recurrence_pattern = ip
        t.title, t.points = d.title, d.points
    db.commit()
    return _out(d)


@router.get("/definitions")
def definitions(
    kid_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require_parent)
):
    q = db.query(Task).filter(is_chore_filter(), Task.is_recurring.is_(True))
    return [
        {
            **_out(t),
            "repeat": {
                "type": t.recurrence_pattern.get("type"),
                "days": t.recurrence_pattern.get("days", []),
            },
        }
        for t in q.order_by(Task.id)
        if kid_id is None or kid_id in assignee_ids(t)
    ]


@router.get("/today")
def today(db: Session = Depends(get_db), _: User = Depends(require_parent)):
    day = current_chore_day(get_family(db), datetime.utcnow())
    out: dict[str, list] = {}
    rows = db.query(Task).filter(
        is_chore_filter(),
        Task.is_recurring.is_(False),
        Task.due_date == midnight(day),
        Task.status != TaskStatus.CANCELLED,
    )
    for t in rows:
        for kid_id in task_kid_ids(t):
            out.setdefault(str(kid_id), []).append(_out(t))
    return out


@router.post("/{chore_id}/approve")
def approve(chore_id: int, db: Session = Depends(get_db), parent: User = Depends(require_parent)):
    t = db.get(Task, chore_id)
    if t is None or not (t.recurrence_pattern or {}).get("chore"):
        raise HTTPException(404, "That chore doesn't exist.")
    if t.status != TaskStatus.SUBMITTED_FOR_APPROVAL:
        raise HTTPException(409, "This chore isn't waiting for approval.")
    t.status = TaskStatus.DONE
    t.approved_at = t.completed_at = datetime.utcnow()
    t.approved_by_id = parent.id
    award_chore(db, t, get_family(db))
    db.commit()
    return _out(t)


@router.delete("/{definition_id}", status_code=204, response_class=Response)
def delete_chore(
    definition_id: int, db: Session = Depends(get_db), _: User = Depends(require_parent)
):
    d = db.get(Task, definition_id)
    if d is None or not d.is_recurring or not (d.recurrence_pattern or {}).get("chore"):
        raise HTTPException(404, "We couldn't find that repeating chore.")
    d.is_recurring = False  # stops future instances; approved history stays
    d.status = TaskStatus.CANCELLED
    for t in db.query(Task).filter(
        Task.parent_task_id == d.id,
        Task.status.notin_([TaskStatus.DONE, TaskStatus.CANCELLED]),
    ):
        t.status = TaskStatus.CANCELLED
    db.commit()
    return Response(status_code=204)
