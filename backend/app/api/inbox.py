"""Notification inbox: own items only, for parents and kids alike."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.inbox import Notification
from app.models.user import User
from app.schemas.lock import utc_z

router = APIRouter()
PAGE = 50


def _out(n: Notification) -> dict:
    return {
        "id": n.id,
        "kind": n.kind,
        "title": n.title,
        "body": n.body,
        "created_at": utc_z(n.created_at),
        "read": n.read_at is not None,
        "run_id": n.run_id,
        "redemption_id": n.redemption_id,
        "device_id": n.device_id,
        "thread_id": n.thread_id,
        "points": getattr(n, "points", None),
    }


def _mine(db: Session, user: User):
    return db.query(Notification).filter(Notification.user_id == user.id)


@router.get("")
def list_notifications(
    unread: bool = False,
    before: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    q = _mine(db, user)
    if unread:
        q = q.filter(Notification.read_at.is_(None))
    if before:
        q = q.filter(Notification.id < before)
    rows = q.order_by(Notification.id.desc()).limit(PAGE + 1).all()
    return {
        "items": [_out(n) for n in rows[:PAGE]],
        "unread": _mine(db, user).filter(Notification.read_at.is_(None)).count(),
        "has_more": len(rows) > PAGE,
    }


@router.post("/read-all")
def read_all(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    _mine(db, user).filter(Notification.read_at.is_(None)).update(
        {"read_at": datetime.utcnow()}, synchronize_session=False
    )
    db.commit()
    return {"ok": True}


@router.post("/{nid}/read")
def read_one(
    nid: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)
):
    n = _mine(db, user).filter(Notification.id == nid).first()
    if n is None:
        raise HTTPException(404, "That notification isn't yours.")
    n.read_at = n.read_at or datetime.utcnow()
    db.commit()
    return _out(n)


@router.delete("/{nid}", status_code=204)
def dismiss(nid: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if not _mine(db, user).filter(Notification.id == nid).delete():
        raise HTTPException(404, "That notification isn't yours.")
    db.commit()
