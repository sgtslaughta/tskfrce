"""Points economy: all point math lives here so routes stay thin."""

import threading
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.chores import ChoreRun
from app.models.family import FamilySettings, get_family
from app.models.lock import Device, Override
from app.models.points import Points, PointsType
from app.models.reward import Redemption, Reward
from app.models.user import User
from app.services import inbox

SCREEN_MINUTES = range(15, 121, 15)

# ponytail: serializes balance check + spend; relies on a single uvicorn process
# (backend/entrypoint.sh). Multiple processes would need DB-level locking.
SPEND_LOCK = threading.RLock()


def balance(db: Session, kid_id: int) -> int:
    total = db.query(func.coalesce(func.sum(Points.amount), 0)).filter(Points.user_id == kid_id)
    return int(total.scalar())


def deduct(
    db: Session, kid_id: int, amount: int, note: str, by_id: int, run_id: int | None = None
) -> int:
    """Take points off with a reason the kid sees; never below zero. Commits."""
    with SPEND_LOCK:
        db.commit()  # fresh snapshot: see other threads' debits
        take = min(amount, max(balance(db, kid_id), 0))
        if take:
            db.add(
                Points(
                    user_id=kid_id,
                    points_type=PointsType.PENALTY,
                    amount=-take,
                    reason="deduction",
                    description=note,
                    by_id=by_id,
                    run_id=run_id,
                    seen_by_kid=False,
                )
            )
            from app.services import kid_events  # late: kid_events -> chores -> economy

            kid_events.points_taken(db, kid_id, take, note, by_id)
        db.commit()
        return take


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


def _recipients(run: ChoreRun) -> list[int]:
    """Kids paid for an approved chore: owner, race winner, or every team member."""
    if run.kid_id is not None:
        return [run.kid_id]
    if run.assignment.mode == "race":
        return [run.submitted_by_id] if run.submitted_by_id else []
    return [u.id for u in run.kids]


def level_of(db: Session, kid_id: int) -> int:
    from app.services import progression  # progression imports chores

    db.flush()
    return progression.level_for(progression.xp(db, kid_id)).level


def level_check(db: Session, kid_id: int, before: int) -> None:
    """Tell the kid when new points moved them up a level. Caller commits."""
    now = level_of(db, kid_id)
    if now > before:
        inbox.notify(db, [kid_id], "level_up", f"You reached level {now}!")
        name = db.get(User, kid_id).full_name
        inbox.notify_parents(db, "level_up", f"{name} levelled up to {now}")


def award_chore(db: Session, run: ChoreRun, fam: FamilySettings) -> int:
    """Add completion (+ bonus) rows for an approved chore. Caller commits.

    Points are the chore's at this moment; the ledger row keeps them. Team chores
    split points and bonus evenly (remainder dropped).
    """
    kids = _recipients(run)
    if not kids:
        return 0
    levels = {k: level_of(db, k) for k in kids}
    chore = run.assignment.chore
    n = len(kids)
    base = (chore.points or 0) // n
    deadline = deadline_utc(fam, run.day, run.assignment.due_time)
    bonus = bonus_for(run.submitted_at, deadline, fam.early_bonus_cap) // n
    for kid_id in kids:
        db.add(
            Points(
                user_id=kid_id,
                points_type=PointsType.TASK_COMPLETION,
                amount=base,
                reason="chore",
                description=chore.title,
                run_id=run.id,
            )
        )
        if bonus > 0:
            db.add(
                Points(
                    user_id=kid_id,
                    points_type=PointsType.BONUS,
                    amount=bonus,
                    reason="early_bonus",
                    description=f"Early bonus: {chore.title}",
                    run_id=run.id,
                )
            )
    for k, before in levels.items():
        level_check(db, k, before)
    return (base + bonus) * n


def _auto(fam: FamilySettings, kind: str, reward: Reward | None) -> bool:
    """True when a request is approved on the spot, with no parent."""
    if kind == "screen_time":
        return bool(fam.screen_auto_approve)
    return kind == "reward" and not reward.needs_approval


def pending_cost(db: Session, kid_id: int) -> int:
    """Points held by this kid's unanswered requests."""
    return (
        db.query(func.coalesce(func.sum(Redemption.cost), 0))
        .filter(Redemption.kid_id == kid_id, Redemption.status == "pending")
        .scalar()
    )


def request(
    db: Session,
    kid: User,
    kind: str,
    reward_id: int | None,
    minutes: int | None,
    device_id: int | None = None,
) -> Redemption:
    """Create a pending spend request and notify parents. Commits."""
    with SPEND_LOCK:
        db.commit()  # end any open snapshot so the balance below sees other commits
        return _request(db, kid, kind, reward_id, minutes, device_id)


def _request(
    db: Session,
    kid: User,
    kind: str,
    reward_id: int | None,
    minutes: int | None,
    device_id: int | None = None,
) -> Redemption:
    fam = get_family(db)
    if kind == "reward":
        reward = db.get(Reward, reward_id) if reward_id else None
        if reward is None or not reward.active or not reward.visible:
            raise HTTPException(400, "That reward isn't available. Pick another.")
        cost, minutes = reward.price, None
        label = reward.name
        auto = _auto(fam, kind, reward)
    elif kind == "screen_time":
        if minutes not in SCREEN_MINUTES:
            raise HTTPException(400, "Pick 15 to 120 minutes, in steps of 15.")
        if not fam.points_unlock_early:
            raise HTTPException(400, "Screen time isn't turned on. Ask a parent.")
        if not kid.devices:
            raise HTTPException(400, "Ask a parent to add your device first.")
        if device_id is not None and device_id not in {d.id for d in kid.devices}:
            raise HTTPException(400, "Pick one of your own devices.")
        cost, reward_id = minutes // 15 * fam.screen_time_price, None
        auto = _auto(fam, kind, None)
        label = f"{minutes} min of screen time"
    else:
        raise HTTPException(400, "Pick screen time or a reward.")
    bal = balance(db, kid.id)
    if cost > bal:
        raise HTTPException(409, f"You need {cost - bal} more points for that.")
    held = pending_cost(db, kid.id)
    if cost > bal - held:
        raise HTTPException(
            400, f"{held} of your points are held for requests a parent hasn't answered yet."
        )
    if kind == "screen_time":
        from app.services import screen_time  # screen_time imports this module

        screen_time.check(db, fam, kid, minutes, datetime.now(UTC))
    if kind != "screen_time":
        device_id = None
    red = Redemption(
        kid_id=kid.id,
        kind=kind,
        reward_id=reward_id,
        minutes=minutes,
        cost=cost,
        device_id=device_id,
    )
    dev = db.get(Device, device_id) if device_id else None
    if dev:
        label += f" from {dev.name}"
    db.add(red)
    db.flush()
    if auto:
        _decide(db, red, None, True)  # commits
        inbox.notify_parents(
            db,
            "redemption_decided",
            f"{kid.full_name} bought {label}"
            if kind == "screen_time"
            else f"{kid.full_name} got {label}",
            f"Approved automatically · {cost} points",
            redemption_id=red.id,
        )
        db.commit()
        return red
    inbox.notify_parents(
        db,
        "redemption_request",
        "New request",
        f"{kid.full_name} wants {label} ({cost} points)",
        redemption_id=red.id,
    )
    db.commit()
    return red


def decide(
    db: Session,
    redemption: Redemption,
    parent: User | None,
    approve: bool,
    note: str | None = None,
) -> Redemption:
    """Approve or deny a pending request. Commits; pokes the lock loop on screen time."""
    with SPEND_LOCK:
        db.commit()  # fresh snapshot: see other threads' debits and decisions
        db.refresh(redemption)
        return _decide(db, redemption, parent, approve, note)


def _what(db: Session, r: Redemption) -> str:
    """Ledger description: the reward name, or the screen-time amount."""
    if r.kind == "screen_time":
        return f"{r.minutes} min of screen time"
    reward = db.get(Reward, r.reward_id)
    return reward.name if reward else "Reward"


def _decide(
    db: Session,
    redemption: Redemption,
    parent: User | None,
    approve: bool,
    note: str | None = None,
) -> Redemption:
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
                reason="redemption",
                description=_what(db, redemption),
                redemption_id=redemption.id,
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
                        created_by_id=parent.id if parent else None,
                    )
                )
            screen = True
    redemption.status = "approved" if approve else "denied"
    redemption.decided_at = now
    redemption.decided_by_id = parent.id if parent else None
    redemption.auto = parent is None
    redemption.note = note
    inbox.notify(
        db,
        [redemption.kid_id],
        "redemption_decided",
        "Request approved" if approve else "Request not approved",
        note or ("Check your rewards." if approve else "Ask a parent if you want to know why."),
        redemption_id=redemption.id,
    )
    if approve:
        from app.services import badges  # badges imports this module

        badges.check_badges(db, db.get(User, redemption.kid_id), get_family(db))
    db.commit()
    if screen:
        from app.lock.loop import trigger

        trigger()
    return redemption
