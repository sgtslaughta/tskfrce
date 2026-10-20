"""First-run setup: create the owner parent and family."""

from datetime import timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.auth import AuthService
from app.core.config import settings
from app.models.family import FamilySettings
from app.models.user import User, UserRole

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


@router.get("")
def setup_needed(db: Session = Depends(get_db)):
    return {"needed": db.query(User.id).first() is None}


@router.post("", status_code=status.HTTP_201_CREATED)
def run_setup(body: SetupIn, db: Session = Depends(get_db)):
    if db.query(User.id).first() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, DONE)
    auth = AuthService(db)
    try:
        # Family row id=1 is the lock: a concurrent setup hits the PK and loses.
        db.add(FamilySettings(id=1, name=body.family_name, timezone=body.timezone))
        db.flush()
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
        db.get(FamilySettings, 1).owner_id = user.id
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, DONE) from None
    token = auth.create_access_token(
        data={"sub": str(user.id), "username": user.username, "email": user.email},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token}
