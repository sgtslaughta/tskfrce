"""Parent password recovery: a parent makes a link for another parent; the link sets a new password."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import require_parent
from app.core.client_ip import client_ip
from app.core.config import settings
from app.core.database import get_db_session
from app.core.ratelimit import limit
from app.models.family import FamilySettings
from app.models.user import User, UserRole
from app.services.password_reset import EXPIRED, create_reset, redeem_reset

router = APIRouter(tags=["password-reset"])


class ResetIn(BaseModel):
    token: str = Field(..., min_length=1, max_length=200)
    password: str = Field(..., min_length=8)


def reset_url(request: Request, token: str) -> str:
    base = settings.BOX_URL or request.headers.get("origin") or str(request.base_url)
    return f"{base.rstrip('/')}/reset?token={token}"


@router.get("/api/v1/parents")
def list_parents(
    db: Session = Depends(get_db_session), me: User = Depends(require_parent)
) -> list[dict]:
    rows = (
        db.query(User)
        .filter(User.role == UserRole.PARENT, User.is_active.is_(True))
        .order_by(User.id)
        .all()
    )
    fam = db.get(FamilySettings, 1)
    owner = fam.owner_id if fam and fam.owner_id else (rows[0].id if rows else None)
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "is_me": u.id == me.id,
            "is_owner": u.id == owner,
        }
        for u in rows
    ]


@router.post("/api/v1/parents/{parent_id}/reset-link")
def make_reset_link(
    parent_id: int,
    request: Request,
    db: Session = Depends(get_db_session),
    me: User = Depends(require_parent),
) -> dict:
    if parent_id == me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Use Change password for your own account.")
    target = db.get(User, parent_id)
    if target is None or target.role != UserRole.PARENT or not target.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That parent was not found.")
    return {"url": reset_url(request, create_reset(db, target, me))}


@router.post("/api/v1/auth/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    body: ResetIn, request: Request, db: Session = Depends(get_db_session)
) -> Response:
    limit(f"reset:{client_ip(request)}", 10, 60)
    if not redeem_reset(db, body.token, body.password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, EXPIRED)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
