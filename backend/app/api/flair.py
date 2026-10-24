"""Kid API: flair catalog and equips (the Locker)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.kid import require_kid
from app.flair.catalog import BY_ID, CATALOG, SLOTS, equipped
from app.models.family import get_family
from app.models.flair import KidFlair
from app.models.user import User
from app.services import badges, progression

router = APIRouter(prefix="/api/v1/kid", tags=["flair"])


class EquipIn(BaseModel):
    slot: str
    id: str | None = None


def _level(db: Session, kid: User) -> int:
    return progression.level_for(progression.xp(db, kid.id)).level


@router.get("/flair")
def get_flair(db: Session = Depends(get_db), kid: User = Depends(require_kid)):
    lv = _level(db, kid)
    return {
        "level": lv,
        "items": [
            {
                "id": f.id,
                "slot": f.slot,
                "name": f.name,
                "unlock_level": f.unlock_level,
                "emblem": f.emblem,
                "unlocked": lv >= f.unlock_level,
            }
            for f in CATALOG
        ],
        "equipped": equipped(db, kid.id),
    }


@router.put("/flair")
def put_flair(body: EquipIn, db: Session = Depends(get_db), kid: User = Depends(require_kid)):
    if body.slot not in SLOTS:
        raise HTTPException(400, "That isn't a flair slot.")
    if body.id is not None:
        item = BY_ID.get(body.id)
        if item is None:
            raise HTTPException(400, "That flair doesn't exist.")
        if item.slot != body.slot:
            raise HTTPException(400, "That doesn't go there.")
        if _level(db, kid) < item.unlock_level:
            raise HTTPException(403, f"Reach level {item.unlock_level} to unlock that.")
    # Rebuild from valid ids so stale ones are dropped on save.
    merged = {**equipped(db, kid.id), body.slot: body.id}
    db.query(KidFlair).filter(KidFlair.kid_id == kid.id).delete()
    db.add_all(KidFlair(kid_id=kid.id, slot=s, item_id=v) for s, v in merged.items() if v)
    new = badges.check_badges(db, kid, get_family(db))
    db.commit()
    return {
        "equipped": equipped(db, kid.id),
        "new_badges": [badges.badge_info(db, a) for a in new],
    }
