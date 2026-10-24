"""Parent API: rewards catalog."""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.models.reward import Redemption, Reward
from app.models.user import User
from app.schemas.reward import RewardCreate, RewardPatch
from app.services import economy

router = APIRouter(
    prefix="/api/v1/rewards", tags=["rewards"], dependencies=[Depends(require_parent)]
)


def _out(r: Reward) -> dict:
    return {"id": r.id, "name": r.name, "price": r.price, "icon": r.icon}


def _get(db: Session, reward_id: int) -> Reward:
    r = db.get(Reward, reward_id)
    if r is None or not r.active:
        raise HTTPException(404, "That reward doesn't exist. Pick one from the list.")
    return r


@router.get("")
def list_rewards(db: Session = Depends(get_db)):
    return [_out(r) for r in db.query(Reward).filter(Reward.active).order_by(Reward.id)]


@router.post("")
def create_reward(body: RewardCreate, db: Session = Depends(get_db)):
    r = Reward(**body.model_dump())
    db.add(r)
    db.commit()
    return _out(r)


@router.patch("/{reward_id}")
def patch_reward(reward_id: int, body: RewardPatch, db: Session = Depends(get_db)):
    r = _get(db, reward_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None or k == "icon":  # icon is the only clearable field
            setattr(r, k, v)
    db.commit()
    return _out(r)


@router.delete("/{reward_id}", status_code=204)
def delete_reward(reward_id: int, db: Session = Depends(get_db)):
    r = _get(db, reward_id)
    r.active = False
    pending = db.query(Redemption).filter(
        Redemption.reward_id == r.id, Redemption.status == "pending"
    )
    for p in pending:
        p.status, p.decided_at = "denied", datetime.utcnow()
    db.commit()
    return Response(status_code=204)


redemptions_router = APIRouter(
    prefix="/api/v1/redemptions", tags=["rewards"], dependencies=[Depends(require_parent)]
)


def redemption_name(db: Session, r: Redemption) -> str:
    if r.kind == "screen_time":
        return f"{r.minutes} min of screen time"
    reward = db.get(Reward, r.reward_id)
    return reward.name if reward else "Reward"


@redemptions_router.get("")
def list_redemptions(
    status: Literal["pending", "approved", "denied"] = "pending", db: Session = Depends(get_db)
):
    rows = db.query(Redemption).filter(Redemption.status == status).order_by(Redemption.id).all()
    out = []
    for r in rows:
        kid = db.get(User, r.kid_id)
        out.append(
            {
                "id": r.id,
                "kid_id": r.kid_id,
                "kid_name": kid.full_name,
                "kind": r.kind,
                "name": redemption_name(db, r),
                "minutes": r.minutes,
                "cost": r.cost,
                "created_at": r.created_at.isoformat() + "Z",
                "kid_balance": economy.balance(db, r.kid_id),
            }
        )
    return out


def _decide(db: Session, rid: int, parent: User, approve: bool) -> dict:
    r = db.get(Redemption, rid)
    if r is None:
        raise HTTPException(404, "That request doesn't exist.")
    r = economy.decide(db, r, parent, approve)
    return {"id": r.id, "status": r.status}


@redemptions_router.post("/{rid}/approve")
def approve(rid: int, db: Session = Depends(get_db), parent: User = Depends(require_parent)):
    return _decide(db, rid, parent, True)


@redemptions_router.post("/{rid}/deny")
def deny(rid: int, db: Session = Depends(get_db), parent: User = Depends(require_parent)):
    return _decide(db, rid, parent, False)
