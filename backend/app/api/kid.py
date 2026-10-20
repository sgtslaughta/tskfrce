"""Kid API: kids are identified by the device they use (no password)."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.core.auth import AuthService
from app.core.client_ip import client_ip, norm_ip
from app.core.ratelimit import check, hit
from app.lock.loop import trigger
from app.lock.reset import chore_state, current_chore_day, is_chore_filter, midnight
from app.lock.rules import is_online
from app.lock.schedule import local_now
from app.lock.state import device_facts
from app.models.family import get_family
from app.models.gamification import Points
from app.models.lock import Device
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole
from app.schemas.lock import utc_z

router = APIRouter(prefix="/api/v1/kid", tags=["kid"])

NOT_YOURS = "This device doesn't belong to you. Ask a parent."


class KidLogin(BaseModel):
    kid_id: int
    pin: str | None = None


def require_kid(user: User = Depends(get_current_active_user)) -> User:
    if user.role != UserRole.KID:
        raise HTTPException(status_code=403, detail="Only kids can do this.")
    return user


def request_device(db: Session, ip: str) -> Device | None:
    want = norm_ip(ip)
    if want is None:
        return None
    for d in db.query(Device).all():
        if want in {norm_ip(d.ip), *(norm_ip(v) for v in d.ipv6 or [])}:
            return d
    return None


@router.get("/whoami")
def whoami(request: Request, db: Session = Depends(get_db)):
    dev = request_device(db, client_ip(request))
    kids = [
        {"id": k.id, "full_name": k.full_name, "avatar": k.avatar, "has_pin": bool(k.pin_hash)}
        for k in (dev.owners if dev else [])
        if k.role == UserRole.KID
    ]
    return {"device": {"id": dev.id, "name": dev.name} if dev else None, "kids": kids}


@router.post("/login")
def login(body: KidLogin, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    key = f"kid:{ip}"
    check(key, 5, 60)  # only failed tries count
    dev = request_device(db, ip)
    kid = next((k for k in (dev.owners if dev else []) if k.id == body.kid_id), None)
    if kid is None or kid.role != UserRole.KID or not kid.is_active:
        hit(key, 60)
        raise HTTPException(status_code=403, detail=NOT_YOURS)
    auth = AuthService(db)
    if kid.pin_hash and not (body.pin and auth.verify_password(body.pin, kid.pin_hash)):
        hit(key, 60)
        raise HTTPException(status_code=401, detail="Wrong PIN. Try again.")
    return {"access_token": auth.create_access_token(data={"sub": str(kid.id)})}


def _locked(db: Session, kid: User, ip: str, now: datetime) -> bool:
    fam = get_family(db)
    dev = request_device(db, ip)
    devs = [dev] if dev and kid in dev.owners else list(kid.devices)
    local = local_now(fam.timezone, now)
    return any(not is_online(device_facts(db, d, fam, now), local) for d in devs)


@router.get("/today")
def today(request: Request, db: Session = Depends(get_db), kid: User = Depends(require_kid)):
    now = datetime.now(UTC)
    day = current_chore_day(get_family(db), now)
    tasks = (
        db.query(Task)
        .filter(
            is_chore_filter(),
            Task.is_recurring.is_(False),
            Task.assigned_to_id == kid.id,
            Task.due_date == midnight(day),
            Task.status != TaskStatus.CANCELLED,
        )
        .order_by(Task.id)
        .all()
    )
    balance = (
        db.query(func.coalesce(func.sum(Points.amount), 0))
        .filter(Points.user_id == kid.id)
        .scalar()
    )
    return {
        "locked": _locked(db, kid, client_ip(request), now),
        "chores": [
            {"id": t.id, "title": t.title, "points": t.points or 0, "state": chore_state(t)}
            for t in tasks
        ],
        "points_balance": int(balance),
    }


@router.post("/chores/{chore_id}/done")
def done(chore_id: int, db: Session = Depends(get_db), kid: User = Depends(require_kid)):
    t = (
        db.query(Task)
        .filter(Task.id == chore_id, is_chore_filter(), Task.assigned_to_id == kid.id)
        .first()
    )
    if t is None or t.status not in (TaskStatus.TODO, TaskStatus.IN_PROGRESS):
        raise HTTPException(status_code=403, detail="That isn't your chore to finish.")
    now = datetime.now(UTC).replace(tzinfo=None)
    day = current_chore_day(get_family(db), now.replace(tzinfo=UTC))
    if t.due_date != midnight(day):
        raise HTTPException(status_code=409, detail="That chore is from another day.")
    t.status = TaskStatus.SUBMITTED_FOR_APPROVAL
    t.submitted_for_approval_at = now
    db.commit()
    trigger()
    return {
        "id": t.id,
        "status": t.status.value,
        "submitted_for_approval_at": utc_z(t.submitted_for_approval_at),
    }
