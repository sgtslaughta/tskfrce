"""Parent API: kids."""

import re
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.core.auth import AuthService
from app.lock.loop import trigger
from app.lock.overrides import clear_override
from app.models.badge import BadgeAward
from app.models.chore_extra import ChorePhoto
from app.models.chores import ChoreAssignment, ChoreRun, RunStepTick, assignment_kids, run_kids
from app.models.flair import KidFlair
from app.models.hours import HourRuleTarget
from app.models.lock import Override, device_owners
from app.models.points import Points, PointsType
from app.models.reward import Redemption
from app.models.tips import DismissedTip
from app.models.user import User, UserRole
from app.schemas.lock import KidCreate, KidPatch
from app.services import chat, economy
from app.services import chores as svc
from app.services.photos import storage

router = APIRouter(prefix="/api/v1/kids", tags=["kids"], dependencies=[Depends(require_parent)])


def _out(k: User) -> dict:
    return {
        "id": k.id,
        "full_name": k.full_name,
        "username": k.username,
        "avatar": k.avatar,
        "has_pin": bool(k.pin_hash),
        "age_group": k.age_group,
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
        age_group=body.age_group or "kid",
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
    if body.age_group is not None:
        kid.age_group = body.age_group
    if body.clear_pin:
        kid.pin_hash = None
    db.commit()
    return _out(kid)


@router.delete("/{kid_id}")
def delete_kid(kid_id: int, db: Session = Depends(get_db)):
    kid = _kid(db, kid_id)
    owned = list(kid.devices)
    # their own runs go (with photos and chat); shared runs carry on for the others
    db.query(Points).filter(Points.user_id == kid.id).delete()  # ledger rows point at runs
    own = db.query(ChoreRun).filter(ChoreRun.kid_id == kid.id).all()
    svc.delete_runs(db, own, storage())
    db.flush()
    db.query(ChoreRun).filter(ChoreRun.submitted_by_id == kid.id).update({"submitted_by_id": None})
    db.query(RunStepTick).filter(RunStepTick.done_by_id == kid.id).update({"done_by_id": None})
    db.execute(delete(run_kids).where(run_kids.c.kid_id == kid.id))
    db.execute(delete(assignment_kids).where(assignment_kids.c.kid_id == kid.id))
    db.flush()
    db.expire_all()
    for r in db.query(ChoreRun).filter(
        ChoreRun.kid_id.is_(None), ChoreRun.status.in_(["todo", "submitted"])
    ):
        if not r.kids:
            r.status = "cancelled"  # a shared run nobody is left on
    for a in db.query(ChoreAssignment).filter(ChoreAssignment.active.is_(True)):
        if not a.kids:
            a.active = False  # nobody left to generate for
        elif len(a.kids) == 1:
            a.mode = "each"
    db.flush()  # expire_all below would drop unflushed changes
    db.query(HourRuleTarget).filter_by(kid_id=kid.id).delete()
    db.query(Override).filter(Override.created_by_id == kid.id).update({"created_by_id": None})
    db.execute(delete(device_owners).where(device_owners.c.user_id == kid.id))
    chat.purge_kid(db, kid.id)
    for p in db.query(ChorePhoto).filter(ChorePhoto.uploaded_by_id == kid.id):
        for key in (p.path, p.thumb_path):
            storage().delete(key)
        db.delete(p)
    db.query(Redemption).filter(Redemption.kid_id == kid.id).delete()
    db.query(BadgeAward).filter(BadgeAward.kid_id == kid.id).delete()
    db.query(KidFlair).filter(KidFlair.kid_id == kid.id).delete()
    db.query(DismissedTip).filter(DismissedTip.user_id == kid.id).delete()
    db.flush()
    db.expire_all()
    for d in owned:
        if not d.owners:
            d.status = "unassigned"
    db.delete(kid)
    db.commit()
    trigger()
    return {"ok": True}


class BonusIn(BaseModel):
    amount: Annotated[int, Field(ge=1, le=500)]
    note: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


@router.post("/{kid_id}/points")
def give_points(kid_id: int, body: BonusIn, db: Session = Depends(get_db)):
    kid = _kid(db, kid_id)
    before = economy.level_of(db, kid.id)
    db.add(
        Points(
            user_id=kid.id,
            points_type=PointsType.BONUS,
            amount=body.amount,
            reason="bonus",
            description=body.note,
            seen_by_kid=False,
        )
    )
    economy.level_check(db, kid.id, before)
    db.commit()
    return {"balance": economy.balance(db, kid.id)}


@router.post("/{kid_id}/deduct")
def deduct_points(
    kid_id: int,
    body: BonusIn,
    db: Session = Depends(get_db),
    parent: User = Depends(require_parent),
):
    """Take points away with a reason the kid sees; the balance never goes below zero."""
    kid = _kid(db, kid_id)
    take = economy.deduct(db, kid.id, body.amount, body.note, parent.id)
    db.commit()
    return {"balance": economy.balance(db, kid.id), "deducted": take}


_REASON_LABEL = {
    "chore": "Chore approved",
    "early_bonus": "Early bonus",
    "team_share": "Team chore",
    "redemption": "Reward",
    "bonus": "Bonus",
    "adjustment": "Adjustment",
    "deduction": "Points taken",
}


@router.get("/{kid_id}/points")
def points_history(kid_id: int, limit: int = 20, db: Session = Depends(get_db)):
    """Newest ledger rows for the kid's profile (02 Kids → Points history)."""
    kid = _kid(db, kid_id)
    rows = (
        db.query(Points)
        .filter(Points.user_id == kid.id)
        .order_by(Points.created_at.desc(), Points.id.desc())
        .limit(max(1, min(limit, 100)))
    )
    return [
        {
            "id": p.id,
            "amount": p.amount,
            "reason": p.reason,
            "label": p.description or _REASON_LABEL.get(p.reason, "Points"),
            "at": svc.iso_z(p.created_at),
        }
        for p in rows
    ]


# POST /kids/{kid_id}/override lives in device_activity.py (409 when the kid has no devices)
@router.delete("/{kid_id}/override")
def kid_clear_override(kid_id: int, db: Session = Depends(get_db)):
    kid = _kid(db, kid_id)
    clear_override(db, [d.id for d in kid.devices])
    db.commit()
    trigger()
    return {"ok": True}
