"""Kid API: kids are identified by the device they use (no password)."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_active_user, get_db
from app.core.auth import AuthService
from app.core.client_ip import client_ip, norm_ip
from app.core.ratelimit import check, hit
from app.lock import activity
from app.lock.loop import trigger
from app.lock.rules import is_online
from app.lock.schedule import local_now
from app.lock.state import Prefetch, device_facts
from app.models.badge import BadgeAward
from app.models.chores import ChoreRun, ChoreSeen
from app.models.family import get_family
from app.models.lock import Device, DeviceIPv6
from app.models.points import Points
from app.models.reward import Redemption
from app.models.user import User, UserRole
from app.schemas.lock import utc_z
from app.services import badges, chat, economy, inbox, kid_view, progression
from app.services import chores as svc
from app.services.chore_types import notes_for
from app.services.photos import save_photo

router = APIRouter(prefix="/api/v1/kid", tags=["kid"])

NOT_YOURS = "This device doesn't belong to you. Ask a parent."


class SubtaskIn(BaseModel):
    done: bool


class NoteIn(BaseModel):
    label: str
    text: str | None = Field(None, max_length=200)


class KidLogin(BaseModel):
    kid_id: int
    pin: str | None = None


def require_kid(user: User = Depends(get_current_active_user)) -> User:
    if user.role != UserRole.KID:
        raise HTTPException(status_code=403, detail="Only kids can do this.")
    return user


def view_kid(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> User:
    """GET routes only: the kid themself, or a parent previewing a kid via X-View-As."""
    if user.role == UserRole.KID:
        return user
    raw = request.headers.get("x-view-as", "")
    if user.role == UserRole.PARENT and raw.strip().isdigit():
        kid = db.get(User, int(raw))  # single-family app: any kid is theirs
        if kid is None or kid.role != UserRole.KID:
            raise HTTPException(status_code=404, detail="We couldn't find that kid.")
        request.state.previewing = True
        return kid
    raise HTTPException(status_code=403, detail="Only kids can do this.")


def request_device(db: Session, ip: str, devices: list[Device] | None = None) -> Device | None:
    want = norm_ip(ip)
    if want is None:
        return None
    for d in devices if devices is not None else db.query(Device).all():
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
        activity.log(
            db,
            dev.id,
            "sign_in",
            datetime.now(UTC).replace(tzinfo=None),
            merge_minutes=10,
            kid_id=kid.id,
        )
        db.commit()
        raise HTTPException(status_code=401, detail="Wrong PIN. Try again.")
    return {"access_token": auth.create_access_token(data={"sub": str(kid.id)})}


def _locked(db: Session, kid: User, ip: str, now: datetime, counts: dict) -> bool:
    fam = get_family(db)
    all_devs = (
        db.query(Device).options(selectinload(Device.owners), selectinload(Device.groups)).all()
    )
    dev = request_device(db, ip, all_devs)
    devs = [dev] if dev and kid in dev.owners else [d for d in all_devs if kid in d.owners]
    local = local_now(fam.timezone, now)
    pre = Prefetch(db, devs, counts)
    return any(not is_online(device_facts(db, d, fam, now, pre), local) for d in devs)


@router.get("/today")
def today(request: Request, db: Session = Depends(get_db), kid: User = Depends(view_kid)):
    now = datetime.now(UTC)
    runs = (
        svc.with_detail(svc.day_runs(db, svc.today(db, now)), kids=False)
        .filter(svc.kid_runs_filter(kid.id))
        .order_by(ChoreRun.id)
        .all()
    )
    fam = get_family(db)
    balances: dict = {}
    prog = progression.progress(db, kid, fam, balances)
    takers = kid_view.names(db, {r.submitted_by_id for r in runs} - {None, kid.id})
    done = sum(svc.state(r) == "done" for r in runs)
    deds = svc.deductions(db, runs)
    texts = svc.note_texts(db, runs)
    seen = kid_view.seen_ids(db, kid.id, {r.assignment_id for r in runs})
    return {
        "age_group": kid.age_group,
        "locks_at": kid_view.locks_at(db, kid, fam, now),
        "locked": _locked(
            db,
            kid,
            "" if getattr(request.state, "previewing", False) else client_ip(request),
            now,
            {kid.id: (done, len(runs))},
        ),
        "chores": [
            {
                "id": r.id,
                "title": svc.chore_of(r).title,
                "points": svc.chore_of(r).points or 0,
                "state": svc.state(r),
                "due_time": r.assignment.due_time,
                **kid_view.extras(
                    r, fam, takers, kid_view.mine(deds.get(r.id, []), kid.id), texts, seen, now
                ),
            }
            for r in runs
        ],
        "points_balance": balances[kid.id],
        "points_held": economy.pending_cost(db, kid.id),
        "progress": prog,
        "timezone": fam.timezone,
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


@router.post("/chores/{run_id}/note")
def leave_note(
    run_id: int, body: NoteIn, db: Session = Depends(get_db), kid: User = Depends(require_kid)
):
    r = _open_run(db, kid, run_id)
    c = svc.chore_of(r)
    if body.label not in {n["label"] for n in notes_for(c.type)}:
        raise HTTPException(422, "Pick one of the notes.")
    text = body.text.strip() if body.text else None
    chat.post(
        db, chat.thread_for(db, "chore", run_id=r.id), kid, text or None, note_label=body.label
    )
    r.note_label, r.note_at = body.label, datetime.now(UTC).replace(tzinfo=None)
    inbox.notify_parents(
        db,
        "chore_note",
        f"{kid.full_name} left a note on {c.title}",
        body.label + (f' · "{text}"' if text else ""),
        run_id=r.id,
    )
    db.commit()
    return {"ok": True}


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
    chat.system(db, r, "Photo added", p.id, actor=kid)
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
    inbox.notify_parents(
        db,
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


@router.post("/chores/{run_id}/seen", status_code=204)
def chore_seen(run_id: int, db: Session = Depends(get_db), kid: User = Depends(require_kid)):
    r = db.query(ChoreRun).filter(ChoreRun.id == run_id, svc.kid_runs_filter(kid.id)).first()
    if r is None:
        raise HTTPException(404, "We couldn't find that chore.")
    if db.get(ChoreSeen, (r.assignment_id, kid.id)) is None:
        db.add(ChoreSeen(assignment_id=r.assignment_id, kid_id=kid.id))
        try:
            db.commit()
        except IntegrityError:  # double tap raced us; already seen
            db.rollback()
    return Response(status_code=204)


@router.get("/celebrations")
def celebrations(db: Session = Depends(get_db), kid: User = Depends(view_kid)):
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
