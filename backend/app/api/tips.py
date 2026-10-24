"""Tips API: manage dismissed tips."""

import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.tips import DismissedTip
from app.models.user import User

router = APIRouter(prefix="/api/v1/me", tags=["tips"])

# Allowed tip keys: alphanumeric, dots, underscores, hyphens, max 64 chars
TIP_KEY_PATTERN = re.compile(r"^[a-z0-9._-]{1,64}$")


@router.get("/tips")
def get_dismissed_tips(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    """Get list of tips dismissed by the current user."""
    tips = db.query(DismissedTip).filter(DismissedTip.user_id == user.id).all()
    return {"dismissed": [t.tip_key for t in tips]}


@router.post("/tips/{tip_key}/dismiss")
def dismiss_tip(
    tip_key: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Mark a tip as dismissed by the current user."""
    if not TIP_KEY_PATTERN.match(tip_key):
        raise HTTPException(400, "Invalid tip key format.")

    # Check if already dismissed
    existing = db.query(DismissedTip).filter(
        and_(DismissedTip.user_id == user.id, DismissedTip.tip_key == tip_key)
    ).first()

    if not existing:
        db.add(DismissedTip(user_id=user.id, tip_key=tip_key))
        db.commit()

    return {"dismissed": tip_key}


@router.delete("/tips")
def reset_tips(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    """Clear all dismissed tips for the current user."""
    db.query(DismissedTip).filter(DismissedTip.user_id == user.id).delete()
    db.commit()
    return {"dismissed": []}
