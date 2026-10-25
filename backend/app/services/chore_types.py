"""Chore types and their quick-note presets (seeded; parents edit them later)."""

from sqlalchemy.orm import Session

from app.models.chore_type import ChoreType, ChoreTypeNote

# (name, glyph, notes); the note glyph is its type's glyph. Position = list order.
SEED: list[tuple[str, str, list[str]]] = [
    (
        "Cleaning",
        "cleaning_services",
        ["Out of supplies", "Did part of it", "Too messy for one go"],
    ),
    ("Schoolwork", "school", ["Don't understand it", "Left it at school", "Need the computer"]),
    ("Pets", "pets", ["Out of pet food", "Pet seems sick", "Someone already did it"]),
    ("Kitchen", "restaurant", ["Out of supplies", "Dishwasher still full", "Something broke"]),
    ("Outdoor", "yard", ["Bad weather", "Too dark", "Tool is broken"]),
    ("Practice", "music_note", ["Gear is broken", "Lesson cancelled"]),
    ("Personal", "self_care", ["Don't feel well"]),
    ("Other", "task_alt", ["Did part of it"]),
]

# Offered for every type, after the type's own notes: (label, glyph).
UNIVERSAL: list[tuple[str, str]] = [
    ("Need help", "help"),
    ("Ran out of time", "schedule"),
    ("Can't do it today", "block"),
]


def notes_for(t: ChoreType) -> list[dict]:
    """The type's own notes first, then the universal ones."""
    own = [{"label": n.label, "glyph": n.glyph, "universal": False} for n in t.notes]
    return own + [{"label": lb, "glyph": g, "universal": True} for lb, g in UNIVERSAL]


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
                notes=[
                    ChoreTypeNote(label=n, glyph=glyph, position=j) for j, n in enumerate(notes)
                ],
            )
        )
    db.flush()


def other_id(db: Session) -> int:
    """Id of the default type: the last builtin (seeded last; never keyed on its renamable name)."""
    return (
        db.query(ChoreType.id)
        .filter_by(builtin=True)
        .order_by(ChoreType.id.desc())
        .limit(1)
        .scalar()
    )
