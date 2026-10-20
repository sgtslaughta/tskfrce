"""Parent API: time windows."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.lock.loop import trigger
from app.models.lock import DeviceGroup, TimeWindow
from app.models.user import User, UserRole
from app.schemas.lock import WindowIn

router = APIRouter(
    prefix="/api/v1/windows", tags=["windows"], dependencies=[Depends(require_parent)]
)


def _out(w: TimeWindow) -> dict:
    return {
        "id": w.id,
        "kind": w.kind,
        "days": w.days,
        "start": w.start,
        "end": w.end,
        "kid_id": w.kid_id,
        "group_id": w.group_id,
    }


@router.get("")
def list_windows(
    kid_id: int | None = None, group_id: int | None = None, db: Session = Depends(get_db)
):
    q = db.query(TimeWindow)
    if kid_id is not None:
        q = q.filter(TimeWindow.kid_id == kid_id)
    if group_id is not None:
        q = q.filter(TimeWindow.group_id == group_id)
    return [_out(w) for w in q.order_by(TimeWindow.id)]


@router.post("")
def create_window(body: WindowIn, db: Session = Depends(get_db)):
    if body.kid_id is None and body.group_id is None:
        raise HTTPException(400, "Pick a kid or a group.")
    if body.kid_id is not None and body.group_id is not None:
        raise HTTPException(400, "Pick a kid or a group, not both.")
    if body.kid_id is not None:
        kid = db.get(User, body.kid_id)
        if kid is None or kid.role != UserRole.KID:
            raise HTTPException(404, "That kid doesn't exist. Pick a kid from the list.")
    elif db.get(DeviceGroup, body.group_id) is None:
        raise HTTPException(404, "That group doesn't exist. Pick a group from the list.")
    w = TimeWindow(**body.model_dump())
    db.add(w)
    db.commit()
    trigger()
    return _out(w)


@router.delete("/{window_id}")
def delete_window(window_id: int, db: Session = Depends(get_db)):
    w = db.get(TimeWindow, window_id)
    if w is None:
        raise HTTPException(404, "That window doesn't exist. Refresh the list and try again.")
    db.delete(w)
    db.commit()
    trigger()
    return {"ok": True}
