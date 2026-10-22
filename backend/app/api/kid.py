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
from app.lock.rules import is_online
from app.lock.schedule import local_now
from app.lock.state import device_facts
from app.models.badge import BadgeAward
from app.models.chores import ChoreRun
from app.models.family import get_family
from app.models.gamification import Points
from app.models.lock import Device, DeviceIPv6
from app.models.reward import Redemption, Reward
from app.models.user import User, UserRole
from app.schemas.lock import utc_z
from app.services import badges, chat, economy, inbox, progression
from app.services import chores as svc
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
        if want == norm_ip(d.ip):
            return d
    for row in db.query(DeviceIPv6).all():
        if want == norm_ip(row.address):
            return db.get(Device, row.device_id)
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


def _kid_extras(db: Session, run: ChoreRun, kid: User) -> dict:
    """Fields the kid screen needs beyond the basics."""
    c, mode = svc.chore_of(run), svc.mode_of(run)
    taker = db.get(User, run.submitted_by_id) if run.submitted_by_id not in (None, kid.id) else None
    return {
        "mode": mode,
        "needs_photo": bool(c.needs_photo),
        "photo_count_current": svc.photo_count(run),
        "last_note": run.last_note,
        "subtasks": svc.steps_out(run),
        "taken_by": (taker.full_name or taker.username) if taker and mode == "race" else None,
    }


@router.get("/today")
def today(request: Request, db: Session = Depends(get_db), kid: User = Depends(require_kid)):
    now = datetime.now(UTC)
    runs = (
        svc.day_runs(db, svc.today(db, now))
        .filter(svc.kid_runs_filter(kid.id))
        .order_by(ChoreRun.id)
        .all()
    )
    return {
        "locked": _locked(db, kid, client_ip(request), now),
        "chores": [
            {
                "id": r.id,
                "title": svc.chore_of(r).title,
                "points": svc.chore_of(r).points or 0,
                "state": svc.state(r),
                "due_time": r.assignment.due_time,
                **_kid_extras(db, r, kid),
            }
            for r in runs
        ],
        "points_balance": economy.balance(db, kid.id),
        "progress": progression.progress(db, kid, get_family(db)),
    }


def _open_run(db: Session, kid: User, run_id: int) -> ChoreRun:
    """A run this kid takes part in that can still be worked on."""
    r = db.query(ChoreRun).filter(ChoreRun.id == run_id, svc.kid_runs_filter(kid.id)).first()
    if r is None:
        raise HTTPException(404, "We couldn't find that chore.")
    if r.status != "todo":
        raise HTTPException(409, "This chore is already with a parent.")
    return r


@router.post("/chores/{chore_id}/subtasks/{sub_id}")
def tick_subtask(
    chore_id: int,
    sub_id: int,
    body: SubtaskIn,
    db: Session = Depends(get_db),
    kid: User = Depends(require_kid),
):
    r = _open_run(db, kid, chore_id)
    if not any(s.id == sub_id for s in svc.chore_of(r).steps):
        raise HTTPException(404, "We couldn't find that step.")
    svc.tick_step(db, r, sub_id, kid, body.done)
    db.commit()
    return {"id": sub_id, "done": body.done}


@router.post("/chores/{chore_id}/photos")
def add_photo(
    chore_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    kid: User = Depends(require_kid),
):
    r = _open_run(db, kid, chore_id)
    p = save_photo(file, r, kid)
    db.add(p)
    db.flush()
    chat.system(db, r, "Photo added", p.id)
    db.commit()
    return {"id": p.id, "attempt": p.attempt}


@router.post("/chores/{chore_id}/done")
def done(chore_id: int, db: Session = Depends(get_db), kid: User = Depends(require_kid)):
    r = db.query(ChoreRun).filter(ChoreRun.id == chore_id, svc.kid_runs_filter(kid.id)).first()
    if r is None or r.status != "todo":
        raise HTTPException(status_code=403, detail="That isn't your chore to finish.")
    now = datetime.now(UTC).replace(tzinfo=None)
    if r.day != svc.today(db, now.replace(tzinfo=UTC)):
        raise HTTPException(status_code=409, detail="That chore is from another day.")
    c = svc.chore_of(r)
    if {s.id for s in c.steps} - {t.step_id for t in r.ticks}:
        raise HTTPException(status_code=409, detail="Tick every step first.")
    if c.needs_photo and not svc.photo_count(r):
        raise HTTPException(status_code=409, detail="Add a photo first.")
    r.status = "submitted"
    r.submitted_at = now
    r.submitted_by_id = kid.id
    inbox.notify(
        db,
        inbox.parents(db),
        "chore_submitted",
        f"{kid.full_name} finished {c.title}",
        "Take a look and approve it.",
        run_id=r.id,
    )
    db.commit()
    trigger()
    return {
        "id": r.id,
        "status": "submitted_for_approval",
        "submitted_for_approval_at": utc_z(r.submitted_at),
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


@router.get("/celebrations")
def celebrations(db: Session = Depends(get_db), kid: User = Depends(require_kid)):
    return badges.celebrations(db, kid)


@router.post("/celebrations/{key}/seen", status_code=204)
def celebration_seen(key: str, db: Session = Depends(get_db), kid: User = Depends(require_kid)):
    kind, _, ident = key.partition(":")
    if not ident.isdigit() or kind not in ("r", "b", "l", "p"):
        raise HTTPException(404, "That celebration isn't yours.")
    n = int(ident)
    if kind == "l":
        level = progression.level_for(progression.xp(db, kid.id)).level
        kid.celebrated_level = max(kid.celebrated_level, min(n, level))
    else:
        row = db.get({"r": Redemption, "b": BadgeAward, "p": Points}[kind], n)
        if row is None or ((row.user_id if kind == "p" else row.kid_id) != kid.id):
            raise HTTPException(404, "That celebration isn't yours.")
        row.seen_by_kid = True
    db.commit()
    return Response(status_code=204)
