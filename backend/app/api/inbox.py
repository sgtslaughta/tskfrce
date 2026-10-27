"""Notification inbox: own items only, for parents and kids alike."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_active_user, get_db
from app.models.chores import Chore, ChoreAssignment, ChoreRun
from app.models.inbox import Notification
from app.models.lock import Device
from app.models.reward import Redemption
from app.models.user import User
from app.schemas.lock import utc_z
from app.services import chores as svc
from app.services import inbox

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
        "kid_id": None,
        "kid_name": None,
        "glyph": None,
        "points": None,
        "pending": False,
    }


def _enrich(db: Session, rows: list[Notification]) -> list[dict]:
    """Add kid, glyph, points and pending; one query per ref type plus one User query."""
    out = [_out(n) for n in rows]
    run_ids = {n.run_id for n in rows if n.run_id}
    red_ids = {n.redemption_id for n in rows if n.redemption_id}
    dev_ids = {n.device_id for n in rows if n.device_id}
    runs = (
        {
            r.id: r
            for r in db.query(ChoreRun)
            .options(
                selectinload(ChoreRun.assignment)
                .selectinload(ChoreAssignment.chore)
                .selectinload(Chore.type),
                selectinload(ChoreRun.kids),
            )
            .filter(ChoreRun.id.in_(run_ids))
        }
        if run_ids
        else {}
    )
    reds = (
        {r.id: r for r in db.query(Redemption).filter(Redemption.id.in_(red_ids))}
        if red_ids
        else {}
    )
    devs = (
        {
            d.id: d
            for d in db.query(Device)
            .options(selectinload(Device.owners))
            .filter(Device.id.in_(dev_ids))
        }
        if dev_ids
        else {}
    )
    # only the newest row per (kind, run) is actionable: two notes on one run count once
    newest = (
        {
            (k, rid): mid
            for k, rid, mid in db.query(
                Notification.kind, Notification.run_id, func.max(Notification.id)
            )
            .filter(Notification.user_id == rows[0].user_id, Notification.run_id.in_(run_ids))
            .group_by(Notification.kind, Notification.run_id)
        }
        if run_ids
        else {}
    )
    for n, o in zip(rows, out, strict=True):
        if n.run_id in runs and newest.get((n.kind, n.run_id)) != n.id:
            r = runs[n.run_id]
            c = svc.chore_of(r)
            o["glyph"], o["points"] = c.type.glyph, c.points
            o["kid_id"] = r.submitted_by_id or (svc.run_kid_ids(r) or [None])[0]
        elif n.run_id in runs:
            r = runs[n.run_id]
            c = svc.chore_of(r)
            o["glyph"], o["points"] = c.type.glyph, c.points
            o["kid_id"] = r.submitted_by_id or (svc.run_kid_ids(r) or [None])[0]
            if n.kind == "chore_submitted":
                o["pending"] = r.status == "submitted"
            elif n.kind == "chore_note":
                o["pending"] = inbox.is_pending_note(r)
        elif n.redemption_id in reds:
            r = reds[n.redemption_id]
            o["kid_id"], o["pending"] = r.kid_id, r.status == "pending"
        elif n.device_id in devs:
            owners = sorted(o_.id for o_ in devs[n.device_id].owners)
            o["kid_id"] = owners[0] if owners else None
    ids = {o["kid_id"] for o in out if o["kid_id"]}
    names = (
        {i: nm for i, nm in db.query(User.id, User.full_name).filter(User.id.in_(ids))}
        if ids
        else {}
    )
    for o in out:
        o["kid_name"] = names.get(o["kid_id"])
    return out


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
        "items": _enrich(db, rows[:PAGE]),
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
    return _enrich(db, [n])[0]


@router.delete("/{nid}", status_code=204)
def dismiss(nid: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    if not _mine(db, user).filter(Notification.id == nid).delete():
        raise HTTPException(404, "That notification isn't yours.")
    db.commit()
