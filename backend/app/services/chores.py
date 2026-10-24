"""Chore runs: daily generation, the kid filter, run state and API output.

A run is one day's work for one kid (or one shared race/team run). It holds only
status and history; title, points, steps and photo rule are read from its chore.
"""

from datetime import UTC, date, datetime

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.lock.reset import current_chore_day
from app.lock.schedule import occurs_on
from app.models.chores import Chore, ChoreAssignment, ChoreRun, RunStepTick, run_kids
from app.models.family import get_family
from app.models.user import User, UserRole
from app.schemas.chore import ChoreOut

# API status names stay what the frontend already reads
API_STATUS = {"submitted": "submitted_for_approval"}


def today(db: Session, now: datetime | None = None) -> date:
    """The family's chore day: family time zone and reset time, never the UTC date."""
    return current_chore_day(get_family(db), now or datetime.now(UTC))


def kid_runs_filter(kid_id: int):
    """SQL clause: runs owned by the kid or shared with them."""
    return or_(
        ChoreRun.kid_id == kid_id,
        ChoreRun.id.in_(select(run_kids.c.run_id).where(run_kids.c.kid_id == kid_id)),
    )


def run_kid_ids(run: ChoreRun) -> list[int]:
    """Kids a run belongs to (its owner, or its participants when shared)."""
    if run.kid_id is not None:
        return [run.kid_id]
    return [u.id for u in run.kids]


def mode_of(run: ChoreRun) -> str:
    return run.assignment.mode if run.kid_id is None else "each"


def chore_of(run: ChoreRun) -> Chore:
    return run.assignment.chore


def state(run: ChoreRun) -> str:
    """done (parent-approved) | needs_you (submitted) | todo."""
    if (
        run.status == "done"
        and run.approved_by is not None
        and run.approved_by.role == UserRole.PARENT
    ):
        return "done"
    return "needs_you" if run.status == "submitted" else "todo"


def day_runs(db: Session, day: date):
    """Query: the day's runs, cancelled ones excluded."""
    return db.query(ChoreRun).filter(ChoreRun.day == day, ChoreRun.status != "cancelled")


def with_detail(q, kids: bool = True, photos: bool = True):
    """Eager-load everything chore_out/steps_out/state/photo_count read (no per-run queries)."""
    return q.options(
        *([selectinload(ChoreRun.kids)] if kids else []),
        joinedload(ChoreRun.assignment).joinedload(ChoreAssignment.chore).selectinload(Chore.steps),
        joinedload(ChoreRun.approved_by),
        selectinload(ChoreRun.ticks),
        *([selectinload(ChoreRun.photos)] if photos else []),
    )


def counts(db: Session, kid_id: int, day: date) -> tuple[int, int]:
    """(approved, total) for a kid today; approved needs a parent's approval."""
    runs = (
        day_runs(db, day)
        .options(joinedload(ChoreRun.approved_by))
        .filter(kid_runs_filter(kid_id))
        .all()
    )
    return sum(state(r) == "done" for r in runs), len(runs)


def chore_out(run: ChoreRun) -> dict:
    a, c = run.assignment, chore_of(run)
    return ChoreOut(
        id=run.id,
        title=c.title,
        kid_id=run.kid_id,
        kid_ids=run_kid_ids(run),
        mode=mode_of(run),
        points=c.points or 0,
        status=API_STATUS.get(run.status, run.status),
        due_date=run.day.isoformat(),
        needs_photo=bool(c.needs_photo),
        due_time=a.due_time,
        attempt=run.attempt or 1,
        last_note=run.last_note,
        submitted_by_id=run.submitted_by_id,
    ).model_dump()


def steps_out(run: ChoreRun) -> list[dict]:
    done = {t.step_id for t in run.ticks}
    return [{"id": s.id, "title": s.title, "done": s.id in done} for s in chore_of(run).steps]


def _add(db: Session, run: ChoreRun) -> bool:
    """Insert one run; a unique-index clash (double generation) is not an error."""
    try:
        with db.begin_nested():
            db.add(run)
    except IntegrityError:
        return False
    return True


def make_runs(db: Session, a: ChoreAssignment, day: date) -> list[ChoreRun]:
    """Today's runs for one assignment: one per kid (each) or one shared (race/team)."""
    if not a.active or a.chore.archived_at is not None or not occurs_on(a, day):
        return []
    kids = [k for k in a.kids if k.role == UserRole.KID]
    if not kids:
        return []
    have = {
        k
        for (k,) in db.query(ChoreRun.kid_id).filter(
            ChoreRun.assignment_id == a.id, ChoreRun.day == day
        )
    }
    made: list[ChoreRun] = []
    if a.mode == "each" or len(kids) == 1:
        new = [ChoreRun(assignment=a, day=day, kid_id=k.id) for k in kids if k.id not in have]
    else:
        new = [] if None in have else [ChoreRun(assignment=a, day=day, kids=kids)]
    for run in new:
        if _add(db, run):
            made.append(run)
    return made


def generate(db: Session, day: date) -> list[ChoreRun]:
    """Create the day's runs from every active assignment. Idempotent. Caller commits."""
    made: list[ChoreRun] = []
    for a in db.query(ChoreAssignment).filter(ChoreAssignment.active.is_(True)).all():
        made += make_runs(db, a, day)
    db.flush()
    return made


def run_reset(db: Session, day: date) -> int:
    """Cancel unfinished older runs, create today's, retire past one-time assignments."""
    for r in db.query(ChoreRun).filter(
        ChoreRun.day < day, ChoreRun.status.notin_(["done", "cancelled"])
    ):
        r.status = "cancelled"
    created = len(generate(db, day))
    for a in db.query(ChoreAssignment).filter(
        ChoreAssignment.repeat == "once", ChoreAssignment.on_date < day
    ):
        a.active = False
    fam = get_family(db)
    fam.last_reset_date = day
    db.flush()
    return created


def delete_runs(db: Session, runs: list[ChoreRun], storage) -> None:
    """Hard-delete runs with their photos, ticks and chat threads."""
    from app.models.chat import ThreadRead

    for r in runs:
        for p in r.photos:
            for key in (p.path, p.thumb_path):
                storage.delete(key)
        for t in r.threads:
            db.query(ThreadRead).filter(ThreadRead.thread_id == t.id).delete()
        db.delete(r)


def photo_count(run: ChoreRun) -> int:
    return sum(1 for p in run.photos if p.attempt == run.attempt)


def tick_step(db: Session, run: ChoreRun, step_id: int, kid: User, done: bool) -> None:
    row = db.get(RunStepTick, (run.id, step_id))
    if done and row is None:
        db.add(
            RunStepTick(
                run_id=run.id,
                step_id=step_id,
                done_by_id=kid.id,
                done_at=datetime.now(UTC).replace(tzinfo=None),
            )
        )
    elif not done and row is not None:
        db.delete(row)
