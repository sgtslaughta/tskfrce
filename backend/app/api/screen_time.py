"""Parent API: screen-time price, daily limits and auto-approve."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.models.chores import Chore
from app.models.family import get_family
from app.models.screen_time import ScreenTimeLimit
from app.models.user import User, UserRole
from app.services import economy, screen_time

router = APIRouter(
    prefix="/api/v1/screen-time", tags=["screen-time"], dependencies=[Depends(require_parent)]
)


def _quarter_hours(v: int | None) -> int | None:
    if v is not None and v % 15:
        raise ValueError("Use steps of 15 minutes.")
    return v


class SettingsPatch(BaseModel):
    enabled: bool | None = None
    price: int | None = Field(default=None, ge=1, le=1000)
    max_minutes_per_day: int | None = Field(default=None, ge=15, le=480)
    auto_approve: bool | None = None
    only_in_allowed_hours: bool | None = None

    _step = field_validator("max_minutes_per_day")(_quarter_hours)


class LimitIn(BaseModel):
    max_minutes: int | None = Field(default=None, ge=15, le=480)
    min_points: int | None = Field(default=None, ge=1, le=100000)

    _step = field_validator("max_minutes")(_quarter_hours)


def _payload(db: Session) -> dict:
    fam = get_family(db)
    kids = db.query(User).filter(User.role == UserRole.KID, User.is_active).order_by(User.id).all()
    ids = [k.id for k in kids]
    bought = screen_time.bought_today(db, fam, ids, datetime.now(UTC))
    rows = {r.kid_id: r for r in db.query(ScreenTimeLimit).filter(ScreenTimeLimit.kid_id.in_(ids))}
    avg = db.query(func.avg(Chore.points)).filter(Chore.archived_at.is_(None)).scalar()
    return {
        "enabled": bool(fam.points_unlock_early),
        "price": fam.screen_time_price,
        "max_minutes_per_day": fam.screen_max_minutes,
        "auto_approve": bool(fam.screen_auto_approve),
        "only_in_allowed_hours": bool(fam.screen_only_allowed_hours),
        "reset_time": fam.reset_time,
        "avg_chore_points": round(avg) if avg else 0,
        "kids": [
            {
                "kid_id": k.id,
                "name": k.full_name,
                "balance": economy.balance(db, k.id),
                "bought_today": bought[k.id],
                "max_minutes": screen_time.limit_for(db, fam, k.id)[0],
                "limit": (
                    {"max_minutes": rows[k.id].max_minutes, "min_points": rows[k.id].min_points}
                    if k.id in rows
                    else None
                ),
            }
            for k in kids
        ],
    }


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    return _payload(db)


@router.patch("")
def patch_settings(body: SettingsPatch, db: Session = Depends(get_db)):
    fam = get_family(db)
    cols = {
        "enabled": "points_unlock_early",
        "price": "screen_time_price",
        "max_minutes_per_day": "screen_max_minutes",
        "auto_approve": "screen_auto_approve",
        "only_in_allowed_hours": "screen_only_allowed_hours",
    }
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None or k == "max_minutes_per_day":  # only the daily max can be cleared
            setattr(fam, cols[k], v)
    db.commit()
    from app.lock.loop import trigger

    trigger()
    return _payload(db)


def _kid(db: Session, kid_id: int) -> User:
    kid = db.get(User, kid_id)
    if kid is None or kid.role != UserRole.KID:
        raise HTTPException(404, "We couldn't find that kid.")
    return kid


@router.put("/limits/{kid_id}")
def put_limit(kid_id: int, body: LimitIn, db: Session = Depends(get_db)):
    _kid(db, kid_id)
    row = db.get(ScreenTimeLimit, kid_id)
    if body.max_minutes is None and body.min_points is None:
        if row:
            db.delete(row)
    else:
        if row is None:
            row = ScreenTimeLimit(kid_id=kid_id)
            db.add(row)
        row.max_minutes, row.min_points = body.max_minutes, body.min_points
    db.commit()
    return _payload(db)


@router.delete("/limits/{kid_id}", status_code=204)
def delete_limit(kid_id: int, db: Session = Depends(get_db)):
    row = db.get(ScreenTimeLimit, kid_id)
    if row:
        db.delete(row)
        db.commit()
    return Response(status_code=204)
