"""Family-visible progression: leaderboard and sibling profiles (parent or kid token)."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.lock.reset import current_chore_day
from app.models.family import get_family
from app.models.user import User, UserRole
from app.services import badges, progression

router = APIRouter(
    prefix="/api/v1", tags=["community"], dependencies=[Depends(get_current_active_user)]
)


def _profile(db: Session, kid: User, today) -> dict:
    lv = progression.level_for(progression.xp(db, kid.id))
    return {
        "kid_id": kid.id,
        "name": kid.full_name or kid.username,
        "avatar": kid.avatar,
        "level": lv.level,
        "title": lv.title,
        "streak": progression.streak(db, kid.id, today).current,
        "badges": badges.badges_for(db, kid.id),
    }


@router.get("/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    return progression.leaderboard(db, get_family(db), datetime.now(UTC))


@router.get("/profiles")
def list_profiles(db: Session = Depends(get_db)):
    today = current_chore_day(get_family(db), datetime.now(UTC))
    kids = db.query(User).filter(User.role == UserRole.KID, User.is_active).order_by(User.id)
    return [_profile(db, k, today) for k in kids]


@router.get("/profiles/{kid_id}")
def get_profile(kid_id: int, db: Session = Depends(get_db)):
    kid = db.get(User, kid_id)
    if kid is None or kid.role != UserRole.KID:
        raise HTTPException(404, "We couldn't find that kid.")
    return _profile(db, kid, current_chore_day(get_family(db), datetime.now(UTC)))
