"""First-run setup: create the owner parent and family."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.auth import AuthService
from app.models.family import get_family
from app.models.user import User, UserRole

router = APIRouter(prefix="/api/v1/setup", tags=["setup"])


class ParentIn(BaseModel):
    username: str
    password: str
    full_name: str


class SetupIn(BaseModel):
    family_name: str
    timezone: str = "UTC"
    parent: ParentIn


@router.get("")
def setup_needed(db: Session = Depends(get_db)):
    return {"needed": db.query(User.id).first() is None}


@router.post("", status_code=status.HTTP_201_CREATED)
def run_setup(body: SetupIn, db: Session = Depends(get_db)):
    if db.query(User.id).first() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Setup is already done. Log in instead.")
    auth = AuthService(db)
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
    fam = get_family(db)
    fam.name, fam.timezone, fam.owner_id = body.family_name, body.timezone, user.id
    db.commit()
    token = auth.create_access_token(
        data={"sub": str(user.id), "username": user.username, "email": user.email},
        expires_delta=timedelta(minutes=30),
    )
    return {"access_token": token}
