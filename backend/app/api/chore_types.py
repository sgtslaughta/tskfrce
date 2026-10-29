"""Parent API: chore types (Cleaning, Pets, ...) and their quick-note presets."""

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.models.chore_type import ChoreType, ChoreTypeNote
from app.models.chores import Chore
from app.services.chore_types import UNIVERSAL, other_id

router = APIRouter(tags=["chore-types"], dependencies=[Depends(require_parent)])

Label = Field(min_length=1, max_length=40)


def _clean(v):
    """Strip whitespace; a blank label is rejected."""
    if v is None:
        return None
    items = v if isinstance(v, list) else [v]
    out = [x.strip() for x in items]
    if not all(out):
        raise ValueError("can't be blank")
    return out if isinstance(v, list) else out[0]


class TypeIn(BaseModel):
    name: str = Label
    glyph: str = Label
    notes: list[str] = Field(default_factory=list, max_length=8)

    _strip = field_validator("name", "glyph", "notes")(_clean)


class TypePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=40)
    glyph: str | None = Field(default=None, min_length=1, max_length=40)
    notes: list[str] | None = Field(default=None, max_length=8)

    _strip = field_validator("name", "glyph", "notes")(_clean)


def _out(t: ChoreType, count: int) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "glyph": t.glyph,
        "builtin": t.builtin,
        "notes": [{"id": n.id, "label": n.label, "glyph": n.glyph} for n in t.notes],
        "chore_count": count,
    }


def _count(db: Session, t: ChoreType) -> int:
    return db.query(func.count(Chore.id)).filter(Chore.type_id == t.id).scalar()


def _type(db: Session, type_id: int) -> ChoreType:
    t = db.get(ChoreType, type_id)
    if t is None:
        raise HTTPException(404, "We couldn't find that chore type.")
    return t


def _check_name(db: Session, name: str, own_id: int | None = None) -> None:
    q = db.query(ChoreType.id).filter(func.lower(ChoreType.name) == name.lower())
    if own_id is not None:
        q = q.filter(ChoreType.id != own_id)
    if q.first() is not None:
        raise HTTPException(409, f"There's already a type called {name}.")


def _set_notes(t: ChoreType, labels: list[str]) -> None:
    seen = {lb.lower() for lb, _ in UNIVERSAL}
    keep = []
    for lb in labels:
        if lb.lower() not in seen:
            seen.add(lb.lower())
            keep.append(lb)
    t.notes[:] = [ChoreTypeNote(label=lb, glyph=t.glyph, position=i) for i, lb in enumerate(keep)]


@router.get("/api/v1/chore-types")
def list_types(db: Session = Depends(get_db)):
    counts = dict(db.query(Chore.type_id, func.count(Chore.id)).group_by(Chore.type_id))
    types = db.query(ChoreType).order_by(ChoreType.position, ChoreType.id)
    return [_out(t, counts.get(t.id, 0)) for t in types]


@router.post("/api/v1/chore-types")
def create_type(body: TypeIn, db: Session = Depends(get_db)):
    _check_name(db, body.name)
    top = db.query(func.max(ChoreType.position)).scalar()
    t = ChoreType(name=body.name, glyph=body.glyph, builtin=False, position=(top or 0) + 1)
    _set_notes(t, body.notes)
    db.add(t)
    db.commit()
    return _out(t, 0)


@router.patch("/api/v1/chore-types/{type_id}")
def patch_type(type_id: int, body: TypePatch, db: Session = Depends(get_db)):
    t = _type(db, type_id)
    if body.name is not None:
        _check_name(db, body.name, t.id)
        t.name = body.name
    if body.glyph is not None:
        t.glyph = body.glyph
    if body.notes is not None:
        _set_notes(t, body.notes)
    elif body.glyph is not None:
        for n in t.notes:
            n.glyph = t.glyph
    db.commit()
    return _out(t, _count(db, t))


@router.delete("/api/v1/chore-types/{type_id}", status_code=204, response_class=Response)
def delete_type(type_id: int, db: Session = Depends(get_db)):
    t = _type(db, type_id)
    if t.builtin:
        raise HTTPException(409, "Built-in types can't be deleted. Rename it instead.")
    db.query(Chore).filter(Chore.type_id == t.id).update({"type_id": other_id(db)})
    db.delete(t)
    db.commit()
    return Response(status_code=204)
