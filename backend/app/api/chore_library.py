"""Parent API: the chore library (chores) and their assignments (who + when)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db, require_parent
from app.models.chore_type import ChoreType
from app.models.chores import Chore, ChoreAssignment, ChoreRun, ChoreStep
from app.models.points import Points
from app.models.user import User, UserRole
from app.schemas.chore import (
    AssignmentIn,
    AssignmentOut,
    AssignmentPatch,
    ChoreIn,
    ChoreLibOut,
    ChorePatch,
    Repeat,
)
from app.services import chores as svc
from app.services import kid_events
from app.services.chore_types import other_id
from app.services.photos import storage

router = APIRouter(tags=["chores"], dependencies=[Depends(require_parent)])

NO_CHORE = "We couldn't find that chore."
NO_ASSIGNMENT = "We couldn't find that assignment."


def assignment_out(a: ChoreAssignment) -> dict:
    return AssignmentOut(
        id=a.id,
        chore_id=a.chore_id,
        kid_ids=sorted(k.id for k in a.kids),
        mode=a.mode,
        repeat=Repeat(type=a.repeat, days=[int(c) for c in a.days or ""]),
        on_date=a.on_date,
        due_time=a.due_time,
        active=a.active,
    ).model_dump(mode="json")


def chore_out(c: Chore) -> dict:
    return ChoreLibOut(
        id=c.id,
        title=c.title,
        points=c.points,
        needs_photo=c.needs_photo,
        type_id=c.type_id,
        steps=[
            {
                "id": s.id,
                "title": s.title,
                "due_time": s.due_time,
                "after_previous": s.after_previous,
            }
            for s in c.steps
        ],
        # an assignment with no kids left is a retired one (deleted, history kept)
        assignments=[assignment_out(a) for a in c.assignments if a.kids],
    ).model_dump()


def _chore(db: Session, chore_id: int) -> Chore:
    c = db.get(Chore, chore_id)
    if c is None:
        raise HTTPException(404, NO_CHORE)
    return c


def _assignment(db: Session, assignment_id: int) -> ChoreAssignment:
    a = db.get(ChoreAssignment, assignment_id)
    if a is None or not a.kids:
        raise HTTPException(404, NO_ASSIGNMENT)
    return a


def _kids(db: Session, ids: list[int]) -> list[User]:
    ids = list(dict.fromkeys(ids))
    found = db.query(User).filter(User.id.in_(ids), User.role == UserRole.KID).all()
    if len(found) != len(ids):
        raise HTTPException(404, "That kid doesn't exist. Pick a kid from the list.")
    return found


def _type_id(db: Session, type_id: int | None) -> int:
    if type_id is None:
        return other_id(db)
    if db.get(ChoreType, type_id) is None:
        raise HTTPException(422, "Pick a chore type from the list.")
    return type_id


def _set_steps(c: Chore, steps: list[dict]) -> None:
    """Keep steps whose title survives (so ticks stay), drop the rest, add new ones."""
    old = list(c.steps)
    keep: list[ChoreStep] = []
    for i, d in enumerate(steps):
        hit = next((s for s in old if s.title == d["title"]), None)
        if hit:
            old.remove(hit)
        s = hit or ChoreStep(title=d["title"])
        s.due_time = d.get("due_time")
        s.after_previous = bool(d.get("after_previous")) and i > 0
        keep.append(s)
    for s in old:
        c.steps.remove(s)
    # park positions first: (chore_id, position) is unique
    for i, s in enumerate(keep):
        s.position = 1000 + i
    c.steps[:] = keep


def _renumber(db: Session, c: Chore) -> None:
    db.flush()
    for i, s in enumerate(c.steps):
        s.position = i
    db.flush()


@router.get("/api/v1/chores/")
def list_chores(kid_id: int | None = None, db: Session = Depends(get_db)):
    q = (
        db.query(Chore)
        .options(
            selectinload(Chore.steps),
            selectinload(Chore.assignments).selectinload(ChoreAssignment.kids),
        )
        .order_by(Chore.id)
    )
    out = []
    for c in q:
        if kid_id is None or any(
            a.active and any(k.id == kid_id for k in a.kids) for a in c.assignments
        ):
            out.append(chore_out(c))
    return out


@router.post("/api/v1/chores/")
def create_chore(
    body: ChoreIn, db: Session = Depends(get_db), parent: User = Depends(require_parent)
):
    c = Chore(
        title=body.title,
        points=body.points,
        needs_photo=body.needs_photo,
        created_by_id=parent.id,
        type_id=_type_id(db, body.type_id),
    )
    _set_steps(c, [x.model_dump() for x in body.steps])
    for i, st in enumerate(c.steps):
        st.position = i
    db.add(c)
    db.commit()
    return chore_out(c)


@router.patch("/api/v1/chores/{chore_id}")
def patch_chore(chore_id: int, body: ChorePatch, db: Session = Depends(get_db)):
    c = _chore(db, chore_id)
    ch = body.model_dump(exclude_unset=True)
    for k in ("title", "points", "needs_photo"):
        if ch.get(k) is not None:
            setattr(c, k, ch[k])
    if ch.get("type_id") is not None:
        c.type_id = _type_id(db, ch["type_id"])
    if ch.get("steps") is not None:
        _set_steps(c, ch["steps"])
        _renumber(db, c)
    c.updated_at = datetime.utcnow()
    db.commit()
    return chore_out(c)


@router.post("/api/v1/chores/{chore_id}/copy")
def copy_chore(
    chore_id: int, db: Session = Depends(get_db), parent: User = Depends(require_parent)
):
    c = _chore(db, chore_id)
    n = Chore(
        title=f"{c.title} (copy)"[:100],
        points=c.points,
        needs_photo=c.needs_photo,
        created_by_id=parent.id,
        type_id=c.type_id,
    )
    n.steps = [
        ChoreStep(
            title=s.title,
            position=s.position,
            due_time=s.due_time,
            after_previous=s.after_previous,
        )
        for s in c.steps
    ]
    db.add(n)
    db.commit()
    return chore_out(n)


@router.delete("/api/v1/chores/{chore_id}", status_code=204, response_class=Response)
def delete_chore(chore_id: int, db: Session = Depends(get_db)):
    """Gone for good: assignments, runs, step ticks, proof photos (files too) and chore chat.
    Points already earned or taken stay in the kids' balances, detached from the run."""
    c = _chore(db, chore_id)
    ids = [a.id for a in c.assignments]
    runs = db.query(ChoreRun).filter(ChoreRun.assignment_id.in_(ids)).all() if ids else []
    if runs:
        db.query(Points).filter(Points.run_id.in_([r.id for r in runs])).update(
            {"run_id": None}, synchronize_session=False
        )
    svc.delete_runs(db, runs, storage())
    db.flush()
    db.delete(c)
    db.commit()
    return Response(status_code=204)


def _apply(db: Session, a: ChoreAssignment, ch: dict) -> None:
    if ch.get("kid_ids"):
        a.kids = _kids(db, ch["kid_ids"])
    if ch.get("mode"):
        a.mode = ch["mode"]
    if len(a.kids) <= 1:
        a.mode = "each"
    if ch.get("repeat"):
        r = ch["repeat"]
        a.repeat = r["type"]
        a.days = "".join(str(d) for d in r["days"]) if r["type"] == "weekly" else None
    if "due_time" in ch:
        a.due_time = ch["due_time"] or None
    if "on_date" in ch and ch["on_date"] is not None:
        a.on_date = ch["on_date"]
    if a.repeat == "once":
        if a.on_date is None:
            a.on_date = svc.today(db)
    else:
        a.on_date = None


@router.post("/api/v1/chores/{chore_id}/assignments")
def add_assignment(chore_id: int, body: AssignmentIn, db: Session = Depends(get_db)):
    c = _chore(db, chore_id)
    a = ChoreAssignment(chore_id=c.id, repeat=body.repeat.type, active=True)
    _apply(db, a, body.model_dump(exclude_unset=True) | {"repeat": body.repeat.model_dump()})
    day = svc.today(db)
    if a.repeat == "once" and a.on_date < day:
        raise HTTPException(422, "Pick today or a later date.")
    db.add(a)
    db.flush()
    svc.make_runs(db, a, day)
    kid_events.chore_new(db, a)
    db.commit()
    return assignment_out(a)


@router.patch("/api/v1/assignments/{assignment_id}")
def patch_assignment(assignment_id: int, body: AssignmentPatch, db: Session = Depends(get_db)):
    a = _assignment(db, assignment_id)
    ch = body.model_dump(exclude_unset=True)
    if "repeat" in ch and body.repeat is not None:
        ch["repeat"] = body.repeat.model_dump()
    day = svc.today(db)
    _apply(db, a, ch)
    if a.repeat == "once":
        if a.on_date < day and "on_date" in ch:
            raise HTTPException(422, "Pick today or a later date.")
        a.active = a.on_date >= day  # a reused one-time assignment wakes up again
    db.flush()
    svc.make_runs(db, a, day)
    db.commit()
    return assignment_out(a)


@router.delete("/api/v1/assignments/{assignment_id}", status_code=204, response_class=Response)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    """With runs: retire it (no kids, inactive, open runs cancelled). Without: remove."""
    a = _assignment(db, assignment_id)
    runs = db.query(ChoreRun).filter(ChoreRun.assignment_id == a.id).all()
    if not runs:
        db.delete(a)
    else:
        a.active, a.kids = False, []
        for r in runs:
            if r.status in ("todo", "submitted"):
                r.status = "cancelled"
    db.commit()
    return Response(status_code=204)
