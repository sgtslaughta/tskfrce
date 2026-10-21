"""Points economy: all point math lives here so routes stay thin."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.family import FamilySettings
from app.models.gamification import Points, PointsType
from app.models.task import Task


def balance(db: Session, kid_id: int) -> int:
    total = db.query(func.coalesce(func.sum(Points.amount), 0)).filter(Points.user_id == kid_id)
    return int(total.scalar())


def deadline_utc(fam: FamilySettings, chore_day: date, due_time: str | None) -> datetime | None:
    """Chore deadline as naive UTC, or None when the chore has no due time."""
    if not due_time:
        return None
    h, m = map(int, due_time.split(":"))
    local = datetime(
        chore_day.year, chore_day.month, chore_day.day, h, m, tzinfo=ZoneInfo(fam.timezone)
    )
    return local.astimezone(UTC).replace(tzinfo=None)


def bonus_for(done_utc: datetime | None, deadline: datetime | None, cap: int) -> int:
    """>=60 min early: cap. By the deadline: cap // 2. Otherwise 0."""
    if done_utc is None or deadline is None or cap <= 0:
        return 0
    if done_utc <= deadline - timedelta(minutes=60):
        return cap
    return cap // 2 if done_utc <= deadline else 0


def award_chore(db: Session, task: Task, fam: FamilySettings) -> int:
    """Add completion (+ bonus) rows for an approved chore. Caller commits."""
    kid_id = task.assigned_to_id
    base = task.points or 0
    db.add(
        Points(
            user_id=kid_id,
            points_type=PointsType.TASK_COMPLETION,
            amount=base,
            description=task.title,
            reference_type="task",
            reference_id=task.id,
        )
    )
    due = (task.recurrence_pattern or {}).get("due_time")
    deadline = deadline_utc(fam, task.due_date.date(), due) if task.due_date else None
    bonus = bonus_for(task.submitted_for_approval_at, deadline, fam.early_bonus_cap)
    if bonus > 0:
        db.add(
            Points(
                user_id=kid_id,
                points_type=PointsType.BONUS,
                amount=bonus,
                description=f"Early bonus: {task.title}",
                reference_type="task_bonus",
                reference_id=task.id,
            )
        )
    return base + bonus
