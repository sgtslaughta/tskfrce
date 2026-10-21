"""Points economy: all point math lives here so routes stay thin."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.family import FamilySettings, get_family
from app.models.gamification import Points, PointsType
from app.models.lock import Override
from app.models.notification import Notification
from app.models.reward import Redemption, Reward
from app.models.task import Task
from app.models.user import User, UserRole

SCREEN_MINUTES = range(15, 121, 15)


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


def _recipients(task: Task) -> list[int]:
    """Kids paid for an approved chore: owner, race winner, or every team member."""
    if task.assigned_to_id is not None:
        return [task.assigned_to_id]
    if (task.recurrence_pattern or {}).get("mode") == "race":
        return [task.submitted_by_id] if task.submitted_by_id else []
    return [u.id for u in task.participants]


def award_chore(db: Session, task: Task, fam: FamilySettings) -> int:
    """Add completion (+ bonus) rows for an approved chore. Caller commits.

    Team chores split points and bonus evenly (remainder dropped).
    """
    kids = _recipients(task)
    if not kids:
        return 0
    n = len(kids)
    base = (task.points or 0) // n
    due = (task.recurrence_pattern or {}).get("due_time")
    deadline = deadline_utc(fam, task.due_date.date(), due) if task.due_date else None
    bonus = bonus_for(task.submitted_for_approval_at, deadline, fam.early_bonus_cap) // n
    for kid_id in kids:
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
    return (base + bonus) * n


def request(
    db: Session, kid: User, kind: str, reward_id: int | None, minutes: int | None
) -> Redemption:
    """Create a pending spend request and notify parents. Commits."""
    fam = get_family(db)
    if kind == "reward":
        reward = db.get(Reward, reward_id) if reward_id else None
        if reward is None or not reward.active:
            raise HTTPException(400, "That reward isn't available. Pick another.")
        cost, minutes = reward.price, None
        label = reward.name
    elif kind == "screen_time":
        if minutes not in SCREEN_MINUTES:
            raise HTTPException(400, "Pick 15 to 120 minutes, in steps of 15.")
        if not fam.points_unlock_early:
            raise HTTPException(400, "Screen time isn't turned on. Ask a parent.")
        if not kid.devices:
            raise HTTPException(400, "Ask a parent to add your device first.")
        cost, reward_id = minutes // 15 * fam.screen_time_price, None
        label = f"{minutes} min of screen time"
    else:
        raise HTTPException(400, "Pick screen time or a reward.")
    short = cost - balance(db, kid.id)
    if short > 0:
        raise HTTPException(409, f"You need {short} more points for that.")
    red = Redemption(kid_id=kid.id, kind=kind, reward_id=reward_id, minutes=minutes, cost=cost)
    db.add(red)
    db.flush()
    for parent in db.query(User).filter(User.role == UserRole.PARENT, User.is_active):
        db.add(
            Notification(
                user_id=parent.id,
                type="redemption_request",
                title="New request",
                message=f"{kid.full_name} wants {label} ({cost} points)",
                action_url="/",
                data={"redemption_id": red.id},
            )
        )
    db.commit()
    return red


def decide(db: Session, redemption: Redemption, parent: User, approve: bool) -> Redemption:
    """Approve or deny a pending request. Commits; pokes the lock loop on screen time."""
    if redemption.status != "pending":
        raise HTTPException(409, "Someone already answered this request.")
    now = datetime.now(UTC).replace(tzinfo=None)
    screen = False
    if approve:
        if redemption.cost > balance(db, redemption.kid_id):
            raise HTTPException(409, "Not enough points anymore.")
        db.add(
            Points(
                user_id=redemption.kid_id,
                points_type=PointsType.REDEMPTION,
                amount=-redemption.cost,
                description="Screen time" if redemption.kind == "screen_time" else "Reward",
                reference_type="redemption",
                reference_id=redemption.id,
            )
        )
        if redemption.kind == "screen_time":
            kid = db.get(User, redemption.kid_id)
            expires = now + timedelta(minutes=redemption.minutes)
            for dev in kid.devices:
                db.add(
                    Override(
                        device_id=dev.id,
                        action="unlock",
                        source="bonus",
                        expires_at=expires,
                        created_at=now,
                        created_by_id=parent.id,
                    )
                )
            screen = True
    redemption.status = "approved" if approve else "denied"
    redemption.decided_at, redemption.decided_by_id = now, parent.id
    db.commit()
    if screen:
        from app.lock.loop import trigger

        trigger()
    return redemption
