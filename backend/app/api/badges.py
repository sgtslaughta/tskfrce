"""Parent API: custom badges."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, StringConstraints
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.models.badge import CustomBadge
from app.models.user import User, UserRole
from app.schemas.glyph import Glyph
from app.services import badge_feed, badges

router = APIRouter(
    prefix="/api/v1/custom-badges", tags=["badges"], dependencies=[Depends(require_parent)]
)

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Desc = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


class BadgeIn(BaseModel):
    name: Name
    icon: Glyph
    description: Desc = ""


class BadgePatch(BaseModel):
    name: Name | None = None
    icon: Glyph | None = None
    description: Desc | None = None


class AwardIn(BaseModel):
    kid_id: int
    note: Note | None = None


def _out(b: CustomBadge) -> dict:
    return {"id": b.id, "name": b.name, "icon": b.icon, "description": b.description}


def _get(db: Session, badge_id: int) -> CustomBadge:
    b = db.get(CustomBadge, badge_id)
    if b is None or not b.active:
        raise HTTPException(404, "That badge doesn't exist. Pick one from the list.")
    return b


overview_router = APIRouter(
    prefix="/api/v1/badges", tags=["badges"], dependencies=[Depends(require_parent)]
)


@overview_router.get("/overview")
def overview(db: Session = Depends(get_db)):
    return badge_feed.overview(db)


@overview_router.get("/recent")
def recent(days: int = Query(7, ge=1, le=365), db: Session = Depends(get_db)):
    return badge_feed.recent(db, days)


@router.get("")
def list_badges(db: Session = Depends(get_db)):
    return [_out(b) for b in db.query(CustomBadge).filter(CustomBadge.active).order_by("id")]


@router.post("")
def create_badge(body: BadgeIn, db: Session = Depends(get_db)):
    b = CustomBadge(**body.model_dump())
    db.add(b)
    db.commit()
    return _out(b)


@router.patch("/{badge_id}")
def patch_badge(badge_id: int, body: BadgePatch, db: Session = Depends(get_db)):
    b = _get(db, badge_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(b, k, v)
    db.commit()
    return _out(b)


@router.delete("/{badge_id}", status_code=204)
def delete_badge(badge_id: int, db: Session = Depends(get_db)):
    _get(db, badge_id).active = False
    db.commit()
    return Response(status_code=204)


@router.post("/{badge_id}/award")
def award_badge(
    badge_id: int,
    body: AwardIn,
    db: Session = Depends(get_db),
    parent: User = Depends(require_parent),
):
    b = _get(db, badge_id)
    kid = db.get(User, body.kid_id)
    if kid is None or kid.role != UserRole.KID or not kid.is_active:
        raise HTTPException(404, "We couldn't find that kid.")
    a = badges.give_custom(db, kid, b, parent, body.note or None)
    db.commit()
    return {"tier": a.tier, "tier_name": badges.TIERS[a.tier - 1]}
