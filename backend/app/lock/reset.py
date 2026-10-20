"""Daily chore reset: create fresh instances, cancel stale ones."""

from datetime import date, datetime, time

from sqlalchemy.orm import Session

from app.lock.rules import OwnerChores
from app.lock.schedule import local_now, occurs_on
from app.models.family import FamilySettings
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole


def reset_due(fam: FamilySettings, now_local: datetime) -> bool:
    return (
        now_local.time() >= time.fromisoformat(fam.reset_time)
        and fam.last_reset_date != now_local.date()
    )


def chore_day(fam: FamilySettings) -> date | None:
    """The chore day every rule/query uses (changes only at reset)."""
    return fam.last_reset_date


def current_chore_day(fam: FamilySettings, now_utc: datetime) -> date:
    """last_reset_date, or local today on a fresh install."""
    return fam.last_reset_date or local_now(fam.timezone, now_utc).date()


def is_chore_filter():
    """SQL filter: rows marked as chores (definitions and instances)."""
    return Task.recurrence_pattern["chore"].as_boolean().is_(True)


def midnight(day: date) -> datetime:
    return datetime.combine(day, time.min)


def make_instance(defn: Task, day: date) -> Task:
    return Task(
        title=defn.title,
        is_recurring=False,
        parent_task_id=defn.id,
        due_date=midnight(day),
        status=TaskStatus.TODO,
        assigned_to_id=defn.assigned_to_id,
        created_by_id=defn.created_by_id,
        points=defn.points,
        recurrence_pattern=dict(defn.recurrence_pattern or {}),
    )


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
            .filter(Task.parent_task_id == defn.id, Task.due_date == midnight(day))
            .first()
        )
        if exists:
            continue
        db.add(make_instance(defn, day))
        created += 1
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
            Task.assigned_to_id == kid_id,
            Task.due_date == midnight(day),
            Task.status != TaskStatus.CANCELLED,
        )
        .all()
    )
    approved = sum(1 for st, uid in rows if st == TaskStatus.DONE and uid is not None)
    return OwnerChores(len(rows), approved)
