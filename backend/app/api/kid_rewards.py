"""Kid API: rewards shop, redeeming and award pop-ups."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.kid import require_kid, view_kid
from app.api.rewards import redemption_name
from app.core.client_ip import client_ip
from app.models.family import get_family
from app.models.reward import Redemption, Reward
from app.models.user import User
from app.services import economy, screen_time

router = APIRouter(prefix="/api/v1/kid", tags=["kid"])


class RedeemIn(BaseModel):
    kind: str
    reward_id: int | None = None
    minutes: int | None = None
    device_id: int | None = None


@router.get("/rewards")
def rewards(db: Session = Depends(get_db), kid: User = Depends(view_kid)):
    fam = get_family(db)
    pending = db.query(Redemption).filter(
        Redemption.kid_id == kid.id, Redemption.status == "pending"
    )
    now = datetime.now(UTC)
    cap, min_points = screen_time.limit_for(db, fam, kid.id)
    got = screen_time.bought_today(db, fam, [kid.id], now)[kid.id]
    screen = {
        "enabled": bool(fam.points_unlock_early),
        "price": fam.screen_time_price,
        "auto": bool(fam.screen_auto_approve),
        "only_in_hours": bool(fam.screen_only_allowed_hours),
        "max_today": cap,
        "bought_today": got,
        "left_today": None if cap is None else max(cap - got, 0),
        "min_points": min_points,
        "in_hours": screen_time.in_allowed_hours(db, kid, now),
        # bought minutes never open an off window (bedtime), even when allowed outside hours
        "off_now": screen_time.all_in_off_window(db, kid, now),
    }
    return {
        "balance": economy.balance(db, kid.id),
        "screen": screen,
        "screen_time_price": fam.screen_time_price,
        "screen_time_enabled": bool(fam.points_unlock_early),
        "rewards": [
            {
                "id": r.id,
                "name": r.name,
                "price": r.price,
                "icon": r.icon,
                "needs_approval": r.needs_approval,
            }
            for r in db.query(Reward).filter(Reward.active, Reward.visible).order_by(Reward.id)
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


def _guess_device(kid: User, ip: str) -> int | None:
    """The kid's device with this IP, else their only device, else None."""
    mine = kid.devices
    hit = [d for d in mine if d.ip == ip or ip in d.ipv6]
    return hit[0].id if hit else mine[0].id if len(mine) == 1 else None


@router.post("/redeem")
def redeem(
    body: RedeemIn,
    request: Request,
    db: Session = Depends(get_db),
    kid: User = Depends(require_kid),
):
    device_id = body.device_id
    if device_id is None and body.kind == "screen_time":
        device_id = _guess_device(kid, client_ip(request))
    r = economy.request(db, kid, body.kind, body.reward_id, body.minutes, device_id)
    return {
        "id": r.id,
        "kind": r.kind,
        "reward_id": r.reward_id,
        "minutes": r.minutes,
        "cost": r.cost,
        "status": r.status,
    }


@router.get("/awards")
def awards(db: Session = Depends(get_db), kid: User = Depends(view_kid)):
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
