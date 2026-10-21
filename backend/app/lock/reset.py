"""Daily chore reset: create fresh instances, cancel stale ones."""

from datetime import date, datetime, time

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, object_session

from app.lock.rules import OwnerChores
from app.lock.schedule import local_now, occurs_on
from app.models.chore_extra import ChoreSubtask
from app.models.family import FamilySettings
from app.models.task import Task, TaskStatus, chore_participants
from app.models.user import User, UserRole


def reset_due(fam: FamilySettings, now_local: datetime) -> bool:
    """Chore day only moves forward (a time zone change west must not rewind it)."""
    return now_local.time() >= time.fromisoformat(fam.reset_time) and (
        fam.last_reset_date is None or now_local.date() > fam.last_reset_date
    )


def chore_day(fam: FamilySettings) -> date | None:
    """The chore day every rule/query uses (changes only at reset)."""
    return fam.last_reset_date


def current_chore_day(fam: FamilySettings, now_utc: datetime) -> date:
    """last_reset_date, or local today on a fresh install."""
    return fam.last_reset_date or local_now(fam.timezone, now_utc).date()


def chore_state(t: Task) -> str:
    """done (parent-approved) | needs_you (submitted) | todo."""
    if (
        t.status == TaskStatus.DONE
        and t.approved_by is not None
        and t.approved_by.role == UserRole.PARENT
    ):
        return "done"
    if t.status == TaskStatus.SUBMITTED_FOR_APPROVAL:
        return "needs_you"
    return "todo"


def is_chore_filter():
    """SQL filter: rows marked as chores (definitions and instances)."""
    return Task.recurrence_pattern["chore"].as_boolean().is_(True)


def midnight(day: date) -> datetime:
    return datetime.combine(day, time.min)


def kid_chores_filter(kid_id: int):
    """SQL clause: instances owned by the kid or shared with them."""
    return or_(
        Task.assigned_to_id == kid_id,
        Task.id.in_(
            select(chore_participants.c.task_id).where(chore_participants.c.kid_id == kid_id)
        ),
    )


def assignee_ids(defn: Task) -> list[int]:
    return list((defn.recurrence_pattern or {}).get("assignees") or [defn.assigned_to_id])


def task_kid_ids(t: Task) -> list[int]:
    """Kids an instance belongs to (its owner, or its participants when shared)."""
    if t.assigned_to_id is not None:
        return [t.assigned_to_id]
    return [u.id for u in t.participants]


def make_instances(defn: Task, day: date, db: Session | None = None) -> list[Task]:
    """One instance per assignee (each), or one shared instance (race/team).

    Assignees that no longer exist as kids are skipped. `db` is needed when
    `defn` is a transient template (one-time chores) not added to a session.
    """
    db = db or object_session(defn)
    wanted = assignee_ids(defn)
    live = {
        uid for (uid,) in db.query(User.id).filter(User.id.in_(wanted), User.role == UserRole.KID)
    }
    ids = [i for i in wanted if i in live]
    if not ids:
        return []
    pattern = defn.recurrence_pattern or {}

    def new(owner: int | None) -> Task:
        t = Task(
            title=defn.title,
            is_recurring=False,
            parent_task_id=defn.id,
            due_date=midnight(day),
            status=TaskStatus.TODO,
            assigned_to_id=owner,
            created_by_id=defn.created_by_id,
            points=defn.points,
            recurrence_pattern=dict(pattern),
        )
        t.chore_subtasks = [
            ChoreSubtask(position=i, title=s) for i, s in enumerate(pattern.get("subtasks") or [])
        ]
        return t

    if pattern.get("mode", "each") == "each" or len(ids) == 1:
        return [new(i) for i in ids]
    shared = new(None)
    shared.participants = [db.get(User, i) for i in ids]
    return [shared]


def run_reset(db: Session, day: date) -> int:
    """Cancel unfinished older instances, create today's. Caller commits."""
    for t in db.query(Task).filter(
        is_chore_filter(),
        Task.is_recurring.is_(False),
        Task.due_date < midnight(day),
        Task.status.notin_([TaskStatus.DONE, TaskStatus.CANCELLED]),
    ):
        t.status = TaskStatus.CANCELLED
    created = 0
    for defn in db.query(Task).filter(is_chore_filter(), Task.is_recurring.is_(True)).all():
        if not occurs_on(defn.recurrence_pattern or {}, day):
            continue
        exists = (
            db.query(Task.id)
            .filter(
                is_chore_filter(),
                Task.parent_task_id == defn.id,
                Task.created_by_id == defn.created_by_id,
                Task.due_date == midnight(day),
            )
            .first()
        )
        if exists:
            continue
        new = make_instances(defn, day)
        db.add_all(new)
        created += len(new)
    fam = db.get(FamilySettings, 1)
    if fam is not None:
        fam.last_reset_date = day
    db.flush()
    return created


def chore_counts(db: Session, kid_id: int, day: date) -> OwnerChores:
    """Approved counts only when a parent approved (status alone is not enough)."""
    rows = (
        db.query(Task.status, User.id)
        .outerjoin(
            User,
            (User.id == Task.approved_by_id) & (User.role == UserRole.PARENT),
        )
        .filter(
            is_chore_filter(),
            Task.is_recurring.is_(False),
            kid_chores_filter(kid_id),
            Task.due_date == midnight(day),
            Task.status != TaskStatus.CANCELLED,
        )
        .all()
    )
    approved = sum(1 for st, uid in rows if st == TaskStatus.DONE and uid is not None)
    return OwnerChores(len(rows), approved)
