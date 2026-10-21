"""Parent API: rewards catalog."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.models.reward import Redemption, Reward
from app.schemas.reward import RewardCreate, RewardPatch

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
        if v is not None:
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
