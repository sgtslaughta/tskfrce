"""Parent API: hour rules (when kids' and groups' devices may be online)."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.lock import hours
from app.lock.loop import trigger
from app.lock.schedule import local_now
from app.models.family import get_family
from app.models.hours import HourRule, HourRuleTarget, HourRuleTime
from app.models.lock import DeviceGroup
from app.models.user import User, UserRole
from app.schemas.hours import RuleIn

router = APIRouter(prefix="/api/v1/hours", tags=["hours"], dependencies=[Depends(require_parent)])


def _out(r: HourRule) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "category": r.category,
        "kind": r.kind,
        "days": r.days,
        "start_date": r.start_date.isoformat() if r.start_date else None,
        "end_date": r.end_date.isoformat() if r.end_date else None,
        "everyone": bool(r.everyone),
        "kid_ids": sorted(r.kid_ids),
        "group_ids": sorted(r.group_ids),
        "times": [{"start": t.start, "end": t.end} for t in r.times],
    }


def _check(db: Session, b: RuleIn) -> None:
    if b.category in ("holiday", "summer") and not (b.start_date and b.end_date):
        raise HTTPException(422, "Holidays and summer need a first and last day.")
    if (b.start_date is None) != (b.end_date is None):
        raise HTTPException(422, "Give both a first and last day, or neither.")
    if b.start_date and b.end_date and b.end_date < b.start_date:
        raise HTTPException(422, "The last day can't be before the first day.")
    if b.everyone and (b.kid_ids or b.group_ids):
        raise HTTPException(422, "Pick Everyone or some kids and groups, not both.")
    if not (b.everyone or b.kid_ids or b.group_ids):
        raise HTTPException(422, "Pick who this is for.")
    if any(t.start == t.end for t in b.times):
        raise HTTPException(422, "Start and end can't be the same.")
    kids = set(b.kid_ids)
    if kids and db.query(User).filter(User.id.in_(kids), User.role == UserRole.KID).count() != len(
        kids
    ):
        raise HTTPException(404, "That kid doesn't exist. Pick a kid from the list.")
    groups = set(b.group_ids)
    if groups and db.query(DeviceGroup).filter(DeviceGroup.id.in_(groups)).count() != len(groups):
        raise HTTPException(404, "That group doesn't exist. Pick a group from the list.")


def _fill(r: HourRule, b: RuleIn) -> None:
    r.name, r.category, r.kind, r.days = b.name, b.category, b.kind, b.days
    r.start_date, r.end_date, r.everyone = b.start_date, b.end_date, b.everyone
    r.times = [HourRuleTime(start=t.start, end=t.end) for t in b.times]
    # dedupe: SQLite UNIQUE treats the NULL group_id of two identical kid targets as distinct
    r.targets = [HourRuleTarget(kid_id=k) for k in dict.fromkeys(b.kid_ids)] + [
        HourRuleTarget(group_id=g) for g in dict.fromkeys(b.group_ids)
    ]


def _rule(db: Session, rule_id: int) -> HourRule:
    r = db.get(HourRule, rule_id)
    if r is None:
        raise HTTPException(404, "That rule doesn't exist. Refresh and try again.")
    return r


@router.get("")
def list_rules(db: Session = Depends(get_db)):
    fam = get_family(db)
    day = local_now(fam.timezone, datetime.now(UTC)).date()
    rows = db.query(HourRule).order_by(HourRule.id).all()
    out = {"today": hours.today_category(hours.load(db), day), "rules": [_out(r) for r in rows]}
    db.commit()
    return out


@router.post("")
def create_rule(body: RuleIn, db: Session = Depends(get_db)):
    _check(db, body)
    r = HourRule()
    _fill(r, body)
    db.add(r)
    db.commit()
    trigger()
    return _out(r)


@router.put("/{rule_id}")
def replace_rule(rule_id: int, body: RuleIn, db: Session = Depends(get_db)):
    r = _rule(db, rule_id)
    _check(db, body)
    _fill(r, body)
    db.commit()
    trigger()
    return _out(r)


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    db.delete(_rule(db, rule_id))
    db.commit()
    trigger()
    return {"ok": True}
