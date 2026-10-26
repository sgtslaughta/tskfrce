"""Parent API: rewards catalog."""

from datetime import datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.models.reward import Redemption, Reward
from app.models.user import User
from app.schemas.reward import DecideIn, RewardCreate, RewardPatch
from app.services import economy

router = APIRouter(
    prefix="/api/v1/rewards", tags=["rewards"], dependencies=[Depends(require_parent)]
)


def _out(r: Reward) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "price": r.price,
        "icon": r.icon,
        "visible": r.visible,
        "needs_approval": r.needs_approval,
    }


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
    ids = {r.reward_id for r in rows if r.reward_id is not None}
    rewards = {w.id: w for w in db.query(Reward).filter(Reward.id.in_(ids))} if ids else {}
    out = []
    for r in rows:
        kid = db.get(User, r.kid_id)
        bal = economy.balance(db, r.kid_id)
        reward = rewards.get(r.reward_id) if r.kind == "reward" else None
        out.append(
            {
                "id": r.id,
                "kid_id": r.kid_id,
                "kid_name": kid.full_name,
                "kind": r.kind,
                "name": redemption_name(db, r),
                "icon": reward.icon if reward else None,
                "minutes": r.minutes,
                "cost": r.cost,
                "created_at": r.created_at.isoformat() + "Z",
                "kid_balance": bal,
                "kid_balance_after": bal - r.cost,
                "note": r.note,
            }
        )
    return out


@redemptions_router.get("/history")
def history(
    days: Annotated[int, Query(ge=1, le=365)] = 30,
    kid_id: int | None = None,
    kind: Literal["reward", "screen_time"] | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Redemption).filter(
        Redemption.status.in_(("approved", "denied")),
        Redemption.created_at >= datetime.utcnow() - timedelta(days=days),
    )
    if kid_id is not None:
        q = q.filter(Redemption.kid_id == kid_id)
    if kind:
        q = q.filter(Redemption.kind == kind)
    reds = q.order_by(Redemption.created_at.desc(), Redemption.id.desc()).all()
    uids = {r.kid_id for r in reds} | {r.decided_by_id for r in reds if r.decided_by_id}
    names = {u.id: u.full_name for u in db.query(User).filter(User.id.in_(uids))} if uids else {}
    rids = {r.reward_id for r in reds if r.reward_id}
    rewards = {w.id: w.name for w in db.query(Reward).filter(Reward.id.in_(rids))} if rids else {}
    ok = [r for r in reds if r.status == "approved"]
    totals = {
        "spent": sum(r.cost for r in ok),
        "screen_minutes": sum(r.minutes or 0 for r in ok if r.kind == "screen_time"),
        "approved": len(ok),
        "declined": len(reds) - len(ok),
    }
    rows = [
        {
            "id": r.id,
            "kid_id": r.kid_id,
            "kid_name": names.get(r.kid_id),
            "kind": r.kind,
            "name": f"{r.minutes} min of screen time"
            if r.kind == "screen_time"
            else rewards.get(r.reward_id, "Reward"),
            "minutes": r.minutes,
            "cost": r.cost,
            "status": r.status,
            "auto": bool(r.auto),
            "decided_by_name": names.get(r.decided_by_id),
            "note": r.note,
            "created_at": r.created_at.isoformat() + "Z",
            "decided_at": r.decided_at.isoformat() + "Z" if r.decided_at else None,
        }
        for r in reds
    ]
    return {"totals": totals, "rows": rows}


def _decide(db: Session, rid: int, parent: User, approve: bool, body: DecideIn | None) -> dict:
    r = db.get(Redemption, rid)
    if r is None:
        raise HTTPException(404, "That request doesn't exist.")
    r = economy.decide(db, r, parent, approve, body.note if body else None)
    return {"id": r.id, "status": r.status}


@redemptions_router.post("/approve-all")
def approve_all(db: Session = Depends(get_db), parent: User = Depends(require_parent)):
    approved = skipped = 0
    with economy.SPEND_LOCK:
        db.commit()  # fresh snapshot before reading pending and balances
        pending = db.query(Redemption).filter(Redemption.status == "pending")
        for r in pending.order_by(Redemption.id).all():
            if r.cost > economy.balance(db, r.kid_id):
                skipped += 1
                continue
            economy.decide(db, r, parent, True)
            approved += 1
    return {"approved": approved, "skipped": skipped}


@redemptions_router.post("/{rid}/approve")
def approve(
    rid: int,
    body: DecideIn | None = None,
    db: Session = Depends(get_db),
    parent: User = Depends(require_parent),
):
    return _decide(db, rid, parent, True, body)


@redemptions_router.post("/{rid}/deny")
def deny(
    rid: int,
    body: DecideIn | None = None,
    db: Session = Depends(get_db),
    parent: User = Depends(require_parent),
):
    return _decide(db, rid, parent, False, body)
