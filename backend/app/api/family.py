"""Parent API: family settings and the /today home screen."""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db, require_parent
from app.api.devices import device_out
from app.api.rewards import redemption_name
from app.lock.loop import trigger
from app.lock.reset import (
    chore_state,
    current_chore_day,
    is_chore_filter,
    midnight,
    task_kid_ids,
)
from app.models.chore_extra import ChorePhoto
from app.models.family import get_family
from app.models.gamification import Points
from app.models.lock import Device
from app.models.reward import Redemption
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole
from app.schemas.lock import FamilyPatch
from app.services import progression

router = APIRouter(prefix="/api/v1", tags=["family"], dependencies=[Depends(require_parent)])


def _fam_out(fam) -> dict:
    return {
        "name": fam.name,
        "timezone": fam.timezone,
        "reset_time": fam.reset_time,
        "new_devices_blocked": fam.new_devices_blocked,
        "points_unlock_early": fam.points_unlock_early,
        "early_bonus_cap": fam.early_bonus_cap,
        "screen_time_price": fam.screen_time_price,
    }


@router.get("/family")
def get_family_settings(db: Session = Depends(get_db)):
    fam = get_family(db)
    db.commit()
    return _fam_out(fam)


@router.patch("/family")
def patch_family(body: FamilyPatch, db: Session = Depends(get_db)):
    fam = get_family(db)
    if body.timezone is not None:
        try:
            ZoneInfo(body.timezone)
        except Exception:
            raise HTTPException(400, "Unknown time zone.") from None
    # a time zone change takes effect at the next reset; no immediate reset
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(fam, k, v)
    db.commit()
    trigger()
    return _fam_out(fam)


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() + "Z" if dt else None


def _needs_you(db: Session, tasks: list[Task], names: dict[int, str]) -> list[dict]:
    """Submitted chores and pending requests, oldest first."""
    sub = [t for t in tasks if t.status == TaskStatus.SUBMITTED_FOR_APPROVAL]
    photos = {}
    if sub:
        rows = (
            db.query(ChorePhoto)
            .filter(ChorePhoto.task_id.in_([t.id for t in sub]))
            .order_by(ChorePhoto.id)
            .all()
        )
        photos = {(p.task_id, p.attempt): p.id for p in rows}  # latest wins
    items = []
    for t in sub:
        kid_id = t.submitted_by_id or (task_kid_ids(t) or [None])[0]
        pid = photos.get((t.id, t.attempt))
        items.append(
            {
                "type": "redo" if t.attempt > 1 else "chore",
                "id": t.id,
                "kid_id": kid_id,
                "kid_name": names.get(kid_id),
                "title": t.title,
                "attempt": t.attempt,
                "thumb_url": f"/chore-photos/{pid}/thumb" if pid else None,
                "subtasks_done": sum(s.done_at is not None for s in t.chore_subtasks),
                "subtasks_total": len(t.chore_subtasks),
                "submitted_at": _iso(t.submitted_for_approval_at),
                "mode": (t.recurrence_pattern or {}).get("mode", "each"),
            }
        )
    reds = db.query(Redemption).filter(Redemption.status == "pending").all()
    balances = dict(
        db.query(Points.user_id, func.sum(Points.amount))
        .filter(Points.user_id.in_({r.kid_id for r in reds}))
        .group_by(Points.user_id)
        .all()
    )
    items += [
        {
            "type": r.kind,
            "id": r.id,
            "kid_id": r.kid_id,
            "kid_name": names.get(r.kid_id),
            "title": redemption_name(db, r),
            "cost": r.cost,
            "kid_balance": int(balances.get(r.kid_id) or 0),
            "submitted_at": _iso(r.created_at),
        }
        for r in reds
    ]
    return sorted(items, key=lambda x: x["submitted_at"] or "")


def _chore_out(t: Task, names: dict[int, str]) -> dict:
    p = t.recurrence_pattern or {}
    state = chore_state(t)
    mode = p.get("mode", "each")
    taken = mode == "race" and state != "todo" and t.submitted_by_id
    return {
        "id": t.id,
        "title": t.title,
        "points": t.points or 0,
        "state": state,
        "due_time": p.get("due_time"),
        "mode": mode if t.assigned_to_id is None else "each",
        "subtasks_done": sum(s.done_at is not None for s in t.chore_subtasks),
        "subtasks_total": len(t.chore_subtasks),
        "attempt": t.attempt,
        "last_note": t.last_note,
        "taken_by": names.get(t.submitted_by_id) if taken else None,
    }


@router.get("/today")
def today(db: Session = Depends(get_db)):
    fam, now = get_family(db), datetime.now(UTC)
    day = current_chore_day(fam, now)
    tasks = (
        db.query(Task)
        .options(selectinload(Task.chore_subtasks), selectinload(Task.participants))
        .filter(
            is_chore_filter(),
            Task.is_recurring.is_(False),
            Task.due_date == midnight(day),
            Task.status != TaskStatus.CANCELLED,
        )
        .order_by(Task.id)
        .all()
    )
    kid_rows = db.query(User).filter(User.role == UserRole.KID).order_by(User.id).all()
    names = {k.id: k.full_name for k in kid_rows}
    needs = _needs_you(db, tasks, names)
    kids = []
    for k in kid_rows:
        devs = [device_out(db, d, fam, now) for d in k.devices]
        mine = [t for t in tasks if k.id in task_kid_ids(t)]
        seen = [d.last_seen for d in k.devices if d.last_seen]
        kids.append(
            {
                "id": k.id,
                "name": k.full_name,
                "avatar": k.avatar,
                "online_all": bool(devs) and all(d["online"] for d in devs),
                "done": sum(chore_state(t) == "done" for t in mine),
                "total": len(mine),
                "needs_you_count": sum(n["kid_id"] == k.id for n in needs),
                "last_active": _iso(max(seen)) if seen else None,
                "progress": progression.progress(db, k, fam),
                "chores": [_chore_out(t, names) for t in mine],
                "devices": [
                    {"id": d["id"], "name": d["name"], "vendor": d["vendor"], "online": d["online"]}
                    for d in devs
                ],
            }
        )
    new = db.query(Device).filter(Device.status == "unassigned").order_by(Device.id).all()
    db.commit()
    return {
        "day": day.isoformat(),
        "pending_approvals": sum(t.status == TaskStatus.SUBMITTED_FOR_APPROVAL for t in tasks),
        "new_devices": [device_out(db, d, fam, now) for d in new],
        "needs_you": needs,
        "kids": kids,
    }
