"""Parent API: family settings and the /today home screen."""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.api.devices import device_out
from app.lock.loop import trigger
from app.lock.reset import chore_state, current_chore_day, is_chore_filter, midnight
from app.models.family import get_family
from app.models.lock import Device
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole
from app.schemas.lock import FamilyPatch

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


@router.get("/today")
def today(db: Session = Depends(get_db)):
    fam, now = get_family(db), datetime.now(UTC)
    day = current_chore_day(fam, now)
    tasks = (
        db.query(Task)
        .filter(
            is_chore_filter(),
            Task.is_recurring.is_(False),
            Task.due_date == midnight(day),
            Task.status != TaskStatus.CANCELLED,
        )
        .order_by(Task.id)
        .all()
    )
    kids = []
    for k in db.query(User).filter(User.role == UserRole.KID).order_by(User.id):
        devs = [device_out(db, d, fam, now) for d in k.devices]
        chores = [
            {"id": t.id, "title": t.title, "points": t.points or 0, "state": chore_state(t)}
            for t in tasks
            if t.assigned_to_id == k.id
        ]
        kids.append(
            {
                "id": k.id,
                "name": k.full_name,
                "avatar": k.avatar,
                "online_all": bool(devs) and all(d["online"] for d in devs),
                "chores": chores,
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
        "kids": kids,
    }
