"""Kid API: kids are identified by the device they use (no password)."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.api.rewards import redemption_name
from app.core.auth import AuthService
from app.core.client_ip import client_ip, norm_ip
from app.core.ratelimit import check, hit
from app.lock.loop import trigger
from app.lock.reset import (
    chore_state,
    current_chore_day,
    is_chore_filter,
    kid_chores_filter,
    midnight,
)
from app.lock.rules import is_online
from app.lock.schedule import local_now
from app.lock.state import device_facts
from app.models.family import get_family
from app.models.lock import Device
from app.models.reward import Redemption, Reward
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole
from app.schemas.lock import utc_z
from app.services import economy
from app.services.photos import save_photo

router = APIRouter(prefix="/api/v1/kid", tags=["kid"])

NOT_YOURS = "This device doesn't belong to you. Ask a parent."


class RedeemIn(BaseModel):
    kind: str
    reward_id: int | None = None
    minutes: int | None = None


class SubtaskIn(BaseModel):
    done: bool


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
            kid_chores_filter(kid.id),
            Task.due_date == midnight(day),
            Task.status != TaskStatus.CANCELLED,
        )
        .order_by(Task.id)
        .all()
    )
    return {
        "locked": _locked(db, kid, client_ip(request), now),
        "chores": [
            {
                "id": t.id,
                "title": t.title,
                "points": t.points or 0,
                "state": chore_state(t),
                "due_time": (t.recurrence_pattern or {}).get("due_time"),
            }
            for t in tasks
        ],
        "points_balance": economy.balance(db, kid.id),
    }


def _open_instance(db: Session, kid: User, chore_id: int) -> Task:
    """A chore instance this kid takes part in that can still be worked on."""
    t = (
        db.query(Task)
        .filter(
            Task.id == chore_id,
            is_chore_filter(),
            Task.is_recurring.is_(False),
            kid_chores_filter(kid.id),
        )
        .first()
    )
    if t is None:
        raise HTTPException(404, "We couldn't find that chore.")
    if t.status not in (TaskStatus.TODO, TaskStatus.IN_PROGRESS):
        raise HTTPException(409, "This chore is already with a parent.")
    return t


@router.post("/chores/{chore_id}/subtasks/{sub_id}")
def tick_subtask(
    chore_id: int,
    sub_id: int,
    body: SubtaskIn,
    db: Session = Depends(get_db),
    kid: User = Depends(require_kid),
):
    t = _open_instance(db, kid, chore_id)
    s = next((s for s in t.chore_subtasks if s.id == sub_id), None)
    if s is None:
        raise HTTPException(404, "We couldn't find that step.")
    s.done_by_id, s.done_at = (
        (kid.id, datetime.now(UTC).replace(tzinfo=None)) if body.done else (None, None)
    )
    db.commit()
    return {"id": s.id, "done": body.done}


@router.post("/chores/{chore_id}/photos")
def add_photo(
    chore_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    kid: User = Depends(require_kid),
):
    t = _open_instance(db, kid, chore_id)
    p = save_photo(file, t, kid)
    db.add(p)
    db.commit()
    return {"id": p.id, "attempt": p.attempt}


@router.post("/chores/{chore_id}/done")
def done(chore_id: int, db: Session = Depends(get_db), kid: User = Depends(require_kid)):
    t = (
        db.query(Task)
        .filter(Task.id == chore_id, is_chore_filter(), kid_chores_filter(kid.id))
        .first()
    )
    if t is None or t.status not in (TaskStatus.TODO, TaskStatus.IN_PROGRESS):
        raise HTTPException(status_code=403, detail="That isn't your chore to finish.")
    now = datetime.now(UTC).replace(tzinfo=None)
    day = current_chore_day(get_family(db), now.replace(tzinfo=UTC))
    if t.due_date != midnight(day):
        raise HTTPException(status_code=409, detail="That chore is from another day.")
    if any(s.done_at is None for s in t.chore_subtasks):
        raise HTTPException(status_code=409, detail="Tick every step first.")
    if (t.recurrence_pattern or {}).get("needs_photo") and not any(
        p.attempt == t.attempt for p in t.chore_photos
    ):
        raise HTTPException(status_code=409, detail="Add a photo first.")
    t.status = TaskStatus.SUBMITTED_FOR_APPROVAL
    t.submitted_for_approval_at = now
    t.submitted_by_id = kid.id
    db.commit()
    trigger()
    return {
        "id": t.id,
        "status": t.status.value,
        "submitted_for_approval_at": utc_z(t.submitted_for_approval_at),
    }


@router.get("/rewards")
def rewards(db: Session = Depends(get_db), kid: User = Depends(require_kid)):
    fam = get_family(db)
    pending = db.query(Redemption).filter(
        Redemption.kid_id == kid.id, Redemption.status == "pending"
    )
    return {
        "balance": economy.balance(db, kid.id),
        "screen_time_price": fam.screen_time_price,
        "screen_time_enabled": bool(fam.points_unlock_early),
        "rewards": [
            {"id": r.id, "name": r.name, "price": r.price, "icon": r.icon}
            for r in db.query(Reward).filter(Reward.active).order_by(Reward.id)
        ],
        "pending": [
            {
                "id": p.id,
                "kind": p.kind,
                "reward_id": p.reward_id,
                "minutes": p.minutes,
                "cost": p.cost,
            }
            for p in pending.order_by(Redemption.id)
        ],
    }


@router.post("/redeem")
def redeem(body: RedeemIn, db: Session = Depends(get_db), kid: User = Depends(require_kid)):
    r = economy.request(db, kid, body.kind, body.reward_id, body.minutes)
    return {
        "id": r.id,
        "kind": r.kind,
        "reward_id": r.reward_id,
        "minutes": r.minutes,
        "cost": r.cost,
        "status": r.status,
    }


@router.get("/awards")
def awards(db: Session = Depends(get_db), kid: User = Depends(require_kid)):
    rows = (
        db.query(Redemption)
        .filter(
            Redemption.kid_id == kid.id,
            Redemption.status == "approved",
            Redemption.seen_by_kid.is_(False),
        )
        .order_by(Redemption.id)
        .all()
    )
    return [
        {
            "id": r.id,
            "kind": r.kind,
            "name": redemption_name(db, r),
            "minutes": r.minutes,
            "cost": r.cost,
        }
        for r in rows
    ]


@router.post("/awards/{award_id}/seen", status_code=204)
def award_seen(award_id: int, db: Session = Depends(get_db), kid: User = Depends(require_kid)):
    r = db.get(Redemption, award_id)
    if r is None or r.kid_id != kid.id:
        raise HTTPException(404, "That award isn't yours.")
    r.seen_by_kid = True
    db.commit()
    return Response(status_code=204)
