"""Parent API: custom badges."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, StringConstraints
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.models.badge import CustomBadge
from app.models.user import User, UserRole
from app.services import badges

router = APIRouter(
    prefix="/api/v1/custom-badges", tags=["badges"], dependencies=[Depends(require_parent)]
)

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
Icon = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=8)]
Desc = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


class BadgeIn(BaseModel):
    name: Name
    icon: Icon
    description: Desc = ""


class BadgePatch(BaseModel):
    name: Name | None = None
    icon: Icon | None = None
    description: Desc | None = None


class AwardIn(BaseModel):
    kid_id: int


def _out(b: CustomBadge) -> dict:
    return {"id": b.id, "name": b.name, "icon": b.icon, "description": b.description}


def _get(db: Session, badge_id: int) -> CustomBadge:
    b = db.get(CustomBadge, badge_id)
    if b is None or not b.active:
        raise HTTPException(404, "That badge doesn't exist. Pick one from the list.")
    return b


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
def award_badge(badge_id: int, body: AwardIn, db: Session = Depends(get_db)):
    b = _get(db, badge_id)
    kid = db.get(User, body.kid_id)
    if kid is None or kid.role != UserRole.KID or not kid.is_active:
        raise HTTPException(404, "We couldn't find that kid.")
    a = badges.give_custom(db, kid, b)
    db.commit()
    return {"tier": a.tier}
