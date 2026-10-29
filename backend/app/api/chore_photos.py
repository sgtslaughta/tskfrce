"""Authenticated access to chore proof photos."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.chore_extra import ChorePhoto
from app.models.chores import ChoreRun
from app.models.user import User, UserRole
from app.services.chores import kid_runs_filter
from app.services.photos import storage

router = APIRouter(prefix="/api/v1/chore-photos", tags=["chores"])


def _file(photo_id: int, db: Session, user: User, thumb: bool) -> FileResponse:
    p = db.get(ChorePhoto, photo_id)
    ok = p is not None and (
        user.role == UserRole.PARENT
        or db.query(ChoreRun.id).filter(ChoreRun.id == p.run_id, kid_runs_filter(user.id)).first()
    )
    if not ok:
        raise HTTPException(404, "We couldn't find that photo.")
    try:
        path = storage().open(p.thumb_path if thumb else p.path)
    except FileNotFoundError:
        raise HTTPException(404, "We couldn't find that photo.") from None
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "private"})


@router.get("/{photo_id}")
def photo(
    photo_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)
):
    return _file(photo_id, db, user, False)


@router.get("/{photo_id}/thumb")
def thumb(
    photo_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)
):
    return _file(photo_id, db, user, True)
