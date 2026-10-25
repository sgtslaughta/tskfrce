"""Chore types and their quick-note presets (seeded; parents edit them later)."""

from sqlalchemy.orm import Session

from app.models.chore_type import ChoreType, ChoreTypeNote

# (name, glyph, notes); the note glyph is its type's glyph. Position = list order.
SEED: list[tuple[str, str, list[str]]] = [
    ("Cleaning", "cleaning_services", ["Out of supplies", "Did part of it", "Too messy for one go"]),
    ("Schoolwork", "school", ["Don't understand it", "Left it at school", "Need the computer"]),
    ("Pets", "pets", ["Out of pet food", "Pet seems sick", "Someone already did it"]),
    ("Kitchen", "restaurant", ["Out of supplies", "Dishwasher still full", "Something broke"]),
    ("Outdoor", "yard", ["Bad weather", "Too dark", "Tool is broken"]),
    ("Practice", "music_note", ["Gear is broken", "Lesson cancelled"]),
    ("Personal", "self_care", ["Don't feel well"]),
    ("Other", "task_alt", ["Did part of it"]),
]


def seed(db: Session) -> None:
    """Insert the builtin types once; no-op when any type exists."""
    if db.query(ChoreType.id).first() is not None:
        return
    for i, (name, glyph, notes) in enumerate(SEED):
        db.add(
            ChoreType(
                name=name,
                glyph=glyph,
                builtin=True,
                position=i,
                notes=[ChoreTypeNote(label=n, glyph=glyph, position=j) for j, n in enumerate(notes)],
            )
        )
    db.flush()


def other_id(db: Session) -> int:
    """Id of the builtin "Other" type (the default for new chores)."""
    return db.query(ChoreType.id).filter_by(name="Other", builtin=True).scalar()
