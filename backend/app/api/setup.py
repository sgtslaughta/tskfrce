"""First-run setup: create the owner parent and family."""

from datetime import timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.auth import AuthService
from app.core.client_ip import client_ip
from app.core.config import settings
from app.core.ratelimit import limit
from app.models.family import FamilySettings, get_family
from app.models.user import User, UserRole
from app.services.chore_types import seed as seed_chore_types

router = APIRouter(prefix="/api/v1/setup", tags=["setup"])

DONE = "Setup is already done. Log in instead."


class ParentIn(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=8)
    full_name: str = Field(max_length=100)


class SetupIn(BaseModel):
    family_name: str = Field(min_length=1, max_length=100)
    timezone: str = "UTC"
    parent: ParentIn

    @field_validator("timezone")
    @classmethod
    def _known_tz(cls, v: str) -> str:
        try:
            ZoneInfo(v)
        except Exception:
            raise ValueError("Unknown time zone.") from None
        return v


def _owner_set(db: Session) -> bool:
    fam = db.get(FamilySettings, 1)
    return fam is not None and fam.owner_id is not None


def claim_owner(db: Session, user_id: int, name: str, tz: str) -> int:
    """Compare-and-set on owner_id is the lock: only one setup can win (returns 1)."""
    return db.execute(
        update(FamilySettings)
        .where(FamilySettings.id == 1, FamilySettings.owner_id.is_(None))
        .values(owner_id=user_id, name=name, timezone=tz)
    ).rowcount


@router.get("")
def setup_needed(db: Session = Depends(get_db)):
    return {"needed": db.query(User.id).first() is None and not _owner_set(db)}


def _limit_setup(request: Request) -> None:
    limit(f"setup:{client_ip(request)}", 5, 60)


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(_limit_setup)])
def run_setup(body: SetupIn, db: Session = Depends(get_db)):
    if db.query(User.id).first() is not None or _owner_set(db):
        raise HTTPException(status.HTTP_409_CONFLICT, DONE)
    auth = AuthService(db)
    try:
        try:
            get_family(db)
            seed_chore_types(db)
        except IntegrityError:  # concurrent insert of row id=1
            db.rollback()
        user = User(
            username=body.parent.username,
            email=f"{body.parent.username}@family.local",
            hashed_password=auth.get_password_hash(body.parent.password),
            full_name=body.parent.full_name,
            role=UserRole.PARENT,
            is_superuser=True,
        )
        db.add(user)
        db.flush()
        won = claim_owner(db, user.id, body.family_name, body.timezone)
        if won != 1:
            db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, DONE)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, DONE) from None
    token = auth.create_access_token(
        data={"sub": str(user.id), "username": user.username, "email": user.email},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh = auth.create_refresh_token(
        data={"sub": str(user.id), "username": user.username, "email": user.email},
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    return {
        "access_token": token,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "refresh_expires_in": settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    }
