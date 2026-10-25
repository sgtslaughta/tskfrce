"""Parent API: family settings and the /today home screen."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db, require_parent
from app.api.devices import device_out
from app.api.rewards import redemption_name
from app.lock.loop import trigger
from app.lock.schedule import Window, local_now, window_end
from app.lock.state import Prefetch
from app.models.chore_extra import ChorePhoto
from app.models.chores import ChoreRun
from app.models.family import get_family
from app.models.lock import Device
from app.models.reward import Redemption, Reward
from app.models.user import User, UserRole
from app.schemas.lock import FamilyPatch
from app.services import chores as svc
from app.services import progression

router = APIRouter(prefix="/api/v1", tags=["family"], dependencies=[Depends(require_parent)])


def _fam_out(fam) -> dict:
    return {
        "name": fam.name,
        "timezone": fam.timezone,
        "reset_time": fam.reset_time,
        "new_devices_blocked": fam.new_devices_blocked,
        "points_unlock_early": fam.points_unlock_early,
        "early_bonus_cap": fam.early_bonus_cap,
        "screen_time_price": fam.screen_time_price,
        "gifs_enabled": fam.gifs_enabled,
        "gif_rating": fam.gif_rating,
        "accent": fam.accent,
        "giphy_key_set": bool(fam.giphy_api_key),  # the key itself is never returned
    }


@router.get("/family")
def get_family_settings(db: Session = Depends(get_db)):
    fam = get_family(db)
    db.commit()
    return _fam_out(fam)


@router.patch("/family")
def patch_family(body: FamilyPatch, db: Session = Depends(get_db)):
    fam = get_family(db)
    if body.timezone is not None:
        try:
            ZoneInfo(body.timezone)
        except Exception:
            raise HTTPException(400, "Unknown time zone.") from None
    # a time zone change takes effect at the next reset; no immediate reset
    for k, v in body.model_dump(exclude_unset=True).items():
        if k == "giphy_api_key" and v is not None:
            fam.giphy_api_key = v.strip() or None
        elif v is not None:
            setattr(fam, k, v)
    db.commit()
    trigger()
    return _fam_out(fam)


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() + "Z" if dt else None


def _needs_you(
    db: Session,
    runs: list[ChoreRun],
    names: dict[int, str],
    fam,
    balances: dict[int, int] | None = None,
) -> list[dict]:
    """Submitted chores and pending requests, oldest first."""
    sub = [r for r in runs if r.status == "submitted"]
    photos = {}
    if sub:
        rows = (
            db.query(ChorePhoto)
            .filter(ChorePhoto.run_id.in_([r.id for r in sub]))
            .order_by(ChorePhoto.id)
            .all()
        )
        photos = {(p.run_id, p.attempt): p.id for p in rows}  # latest wins
    items = []
    for r in sub:
        kid_id = r.submitted_by_id or (svc.run_kid_ids(r) or [None])[0]
        pid = photos.get((r.id, r.attempt))
        steps = svc.steps_out(r, fam)
        items.append(
            {
                "type": "redo" if r.attempt > 1 else "chore",
                "id": r.id,
                "kid_id": kid_id,
                "kid_name": names.get(kid_id),
                "title": svc.chore_of(r).title,
                "attempt": r.attempt,
                "thumb_url": f"/chore-photos/{pid}/thumb" if pid else None,
                "subtasks_done": sum(s["done"] for s in steps),
                "subtasks_total": len(steps),
                "submitted_at": _iso(r.submitted_at),
                "mode": svc.mode_of(r),
            }
        )
    reds = db.query(Redemption).filter(Redemption.status == "pending").all()
    if balances is None:
        balances = {
            i: b for i, (_, b) in progression.totals_many(db, [r.kid_id for r in reds]).items()
        }
    items += [
        {
            "type": r.kind,
            "id": r.id,
            "kid_id": r.kid_id,
            "kid_name": names.get(r.kid_id),
            "title": redemption_name(db, r),
            "cost": r.cost,
            "kid_balance": balances.get(r.kid_id, 0),
            "submitted_at": _iso(r.created_at),
        }
        for r in reds
    ]
    return sorted(items, key=lambda x: x["submitted_at"] or "")


def _chore_out(
    r: ChoreRun, names: dict[int, str], fam, notes: dict, tmrw: date, deds: list[dict]
) -> dict:
    c, st, mode = svc.chore_of(r), svc.state(r), svc.mode_of(r)
    steps = svc.steps_out(r, fam)
    taken = mode == "race" and st != "todo" and r.submitted_by_id
    return {
        "id": r.id,
        "title": c.title,
        "points": c.points or 0,
        "state": st,
        "due_time": r.assignment.due_time,
        "due_at": svc.iso_z(svc.due_at(r, fam)),
        "type": svc.type_out(c),
        "sent_back": svc.sent_back(r),
        "mode": mode,
        "subtasks_done": sum(s["done"] for s in steps),
        "subtasks_total": len(steps),
        "attempt": r.attempt,
        "last_note": r.last_note,
        "note": svc.note_out(r, notes),
        "taken_by": names.get(r.submitted_by_id) if taken else None,
        "can_move": svc.can_move(r, tmrw),
        "deducted": sum(d["amount"] for d in deds),
    }


def _next_reward(prices: list[int], balance: int) -> int | None:
    """Points still needed for the cheapest reward the kid can't afford yet."""
    return next((p - balance for p in prices if p > balance), None)


def _locks_at(pre: Prefetch, kid_id: int, now_local: datetime) -> str | None:
    """End of the kid's current allowed hours today (their own windows, not groups')."""
    rows = pre.windows.get(("kid_id", kid_id), [])
    end = window_end([Window.from_row(r) for r in rows if r.kind == "allowed"], now_local)
    return _iso(end.astimezone(UTC).replace(tzinfo=None)) if end else None


@router.get("/today")
def today(db: Session = Depends(get_db)):
    fam, now = get_family(db), datetime.now(UTC)
    day = svc.today(db, now)
    tmrw = day + timedelta(days=1)
    shown = (
        svc.with_detail(svc.day_runs(db, day, skipped=True), photos=False)
        .order_by(ChoreRun.id)
        .all()
    )
    tasks = [t for t in shown if t.status != "skipped"]  # skipped: listed, never counted
    kid_rows = db.query(User).filter(User.role == UserRole.KID).order_by(User.id).all()
    devices = (
        db.query(Device)
        .options(selectinload(Device.owners), selectinload(Device.groups))
        .order_by(Device.id)
        .all()
    )
    mine_by = {k.id: [t for t in tasks if k.id in svc.run_kid_ids(t)] for k in kid_rows}
    shown_by = {k.id: [t for t in shown if k.id in svc.run_kid_ids(t)] for k in kid_rows}
    counts = {i: (sum(svc.state(t) == "done" for t in m), len(m)) for i, m in mine_by.items()}
    kid_devs = {k.id: [d for d in devices if k in d.owners] for k in kid_rows}
    new = [d for d in devices if d.status == "unassigned"]
    pre = Prefetch(db, devices, counts)
    balances: dict = {}
    prog = progression.progress_many(db, kid_rows, fam, balances)
    names = {k.id: k.full_name for k in kid_rows}
    notes = svc.note_texts(db, shown)
    deds = svc.deductions(db, shown)
    needs = _needs_you(db, tasks, names, fam, balances)
    prices = sorted(p for (p,) in db.query(Reward.price).filter(Reward.active.is_(True)))
    now_local = local_now(fam.timezone, now)
    kids = []
    for k in kid_rows:
        devs = [device_out(db, d, fam, now, pre) for d in kid_devs[k.id]]
        mine = mine_by[k.id]
        seen = [d.last_seen for d in kid_devs[k.id] if d.last_seen]
        kids.append(
            {
                "id": k.id,
                "name": k.full_name,
                "avatar": k.avatar,
                "online_all": bool(devs) and all(d["online"] for d in devs),
                "done": sum(svc.state(t) == "done" for t in mine),
                "total": len(mine),
                "needs_you_count": sum(n["kid_id"] == k.id for n in needs),
                "last_active": _iso(max(seen)) if seen else None,
                "progress": prog[k.id],
                "points": balances.get(k.id, 0),
                "next_reward": _next_reward(prices, balances.get(k.id, 0)),
                "locks_at": _locks_at(pre, k.id, now_local),
                "chores": [
                    _chore_out(t, names, fam, notes, tmrw, deds.get(t.id, []))
                    for t in shown_by[k.id]
                ],
                "devices": [
                    {"id": d["id"], "name": d["name"], "vendor": d["vendor"], "online": d["online"]}
                    for d in devs
                ],
            }
        )
    out = {
        "day": day.isoformat(),
        "pending_approvals": sum(t.status == "submitted" for t in tasks),
        "new_devices": [device_out(db, d, fam, now, pre) for d in new],
        "needs_you": needs,
        "kids": kids,
    }
    db.commit()  # after the payload is built: commit expires every loaded row
    return out
