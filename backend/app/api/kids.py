"""Parent API: kids."""

import re
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.core.auth import AuthService
from app.lock.loop import trigger
from app.lock.overrides import clear_override, set_override
from app.lock.reset import is_chore_filter
from app.models.lock import Override, TimeWindow, device_owners
from app.models.task import Task, TaskStatus, chore_participants
from app.models.user import User, UserRole
from app.schemas.lock import KidCreate, KidPatch, OverrideIn
from app.services import chat

router = APIRouter(prefix="/api/v1/kids", tags=["kids"], dependencies=[Depends(require_parent)])


def _out(k: User) -> dict:
    return {
        "id": k.id,
        "full_name": k.full_name,
        "username": k.username,
        "avatar": k.avatar,
        "has_pin": bool(k.pin_hash),
    }


def _kid(db: Session, kid_id: int) -> User:
    k = db.get(User, kid_id)
    if k is None or k.role != UserRole.KID:
        raise HTTPException(404, "That kid doesn't exist. Pick a kid from the list.")
    return k


def _username(db: Session, name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "kid"
    base = f"kid-{slug}"[:40]
    cand, n = base, 1
    while db.query(User.id).filter(User.username == cand).first():
        n += 1
        cand = f"{base}-{n}"
    return cand


@router.get("")
def list_kids(db: Session = Depends(get_db)):
    return [_out(k) for k in db.query(User).filter(User.role == UserRole.KID).order_by(User.id)]


@router.post("")
def create_kid(body: KidCreate, db: Session = Depends(get_db)):
    auth = AuthService(db)
    username = _username(db, body.full_name)
    kid = User(
        username=username,
        email=f"{username}@family.local",
        hashed_password=auth.get_password_hash(secrets.token_urlsafe(32)),
        full_name=body.full_name,
        role=UserRole.KID,
        avatar=body.avatar,
        pin_hash=auth.get_password_hash(body.pin) if body.pin else None,
    )
    db.add(kid)
    db.commit()
    trigger()
    return _out(kid)


@router.patch("/{kid_id}")
def patch_kid(kid_id: int, body: KidPatch, db: Session = Depends(get_db)):
    kid = _kid(db, kid_id)
    if body.full_name is not None:
        kid.full_name = body.full_name
    if body.avatar is not None:
        kid.avatar = body.avatar
    if body.pin is not None:
        kid.pin_hash = AuthService(db).get_password_hash(body.pin)
    if body.clear_pin:
        kid.pin_hash = None
    db.commit()
    return _out(kid)


@router.delete("/{kid_id}")
def delete_kid(kid_id: int, db: Session = Depends(get_db)):
    kid = _kid(db, kid_id)
    owned = list(kid.devices)
    # drop them from shared chore definitions; the chore carries on for the rest
    for d in db.query(Task).filter(is_chore_filter(), Task.is_recurring.is_(True)):
        p = dict(d.recurrence_pattern or {})
        ids = p.get("assignees") or [d.assigned_to_id]
        if kid.id not in ids or ids == [kid.id]:
            continue  # untouched, or solely theirs (cancelled below)
        rest = [i for i in ids if i != kid.id]
        p["assignees"] = rest
        if len(rest) == 1:
            p["mode"] = "each"
        d.recurrence_pattern, d.assigned_to_id = p, rest[0]
    db.flush()
    # stop their own chores spawning for nobody; finished history stays
    for t in db.query(Task).filter(
        is_chore_filter(),
        Task.assigned_to_id == kid.id,
        Task.status.notin_([TaskStatus.DONE, TaskStatus.CANCELLED]) | Task.is_recurring,
    ):
        t.is_recurring = False
        t.status = TaskStatus.CANCELLED
    db.execute(delete(chore_participants).where(chore_participants.c.kid_id == kid.id))
    db.query(Task).filter(Task.submitted_by_id == kid.id).update({"submitted_by_id": None})
    db.flush()  # expire_all below would drop unflushed changes
    db.query(TimeWindow).filter(TimeWindow.kid_id == kid.id).delete()
    db.query(Override).filter(Override.created_by_id == kid.id).update({"created_by_id": None})
    db.execute(delete(device_owners).where(device_owners.c.user_id == kid.id))
    chat.purge_kid(db, kid.id)
    db.flush()
    db.expire_all()
    for d in owned:
        if not d.owners:
            d.status = "unassigned"
    db.delete(kid)
    db.commit()
    trigger()
    return {"ok": True}


@router.post("/{kid_id}/override")
def kid_override(
    kid_id: int,
    body: OverrideIn,
    db: Session = Depends(get_db),
    parent: User = Depends(require_parent),
):
    kid = _kid(db, kid_id)
    set_override(db, [d.id for d in kid.devices], body.action, body.minutes, parent.id)
    db.commit()
    trigger()
    return {"ok": True}


@router.delete("/{kid_id}/override")
def kid_clear_override(kid_id: int, db: Session = Depends(get_db)):
    kid = _kid(db, kid_id)
    clear_override(db, [d.id for d in kid.devices])
    db.commit()
    trigger()
    return {"ok": True}
