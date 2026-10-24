"""Flair catalog: code-defined, served to the frontend, rendered by `.flair-<id>` CSS."""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.flair import KidFlair

SLOTS = ("card", "ring", "name", "emblem", "title")


@dataclass(frozen=True)
class FlairItem:
    id: str
    slot: str
    name: str
    unlock_level: int
    emblem: str | None = None


def _i(level: int, slot: str, *items: str | tuple[str, str]) -> list[FlairItem]:
    """Items are `Name` (id `<slot>-<name>`) or `(id suffix, Name)`; emblems use `(suffix, "Name|emoji")`."""
    out = []
    for it in items:
        suffix, name = it if isinstance(it, tuple) else (it.lower().replace(" ", "-"), it)
        name, _, emoji = name.partition("|")
        out.append(FlairItem(f"{slot}-{suffix}", slot, name, level, emoji or None))
    return out


CATALOG: tuple[FlairItem, ...] = tuple(
    [
        *_i(1, "card", "Slate"),
        *_i(1, "emblem", ("star", "Star|⭐")),
        *_i(1, "title", "Basic"),
        *_i(3, "title", "Mint", "Coral", "Sky"),
        *_i(3, "emblem", ("lightning", "Lightning|⚡"), ("paw", "Paw|🐾")),
        *_i(5, "ring", "Mint", "Coral", "Sun"),
        *_i(5, "emblem", ("ninja", "Ninja|🥷"), ("unicorn", "Unicorn|🦄")),
        *_i(8, "name", "Sun", "Mint", "Coral"),
        *_i(8, "emblem", ("crown", "Crown|👑"), ("rocket", "Rocket|🚀")),
        *_i(12, "card", "Grid", "Waves", "Stripes"),
        *_i(12, "emblem", ("dragon", "Dragon|🐉")),
        *_i(16, "ring", ("glow-sun", "Sun Glow"), ("glow-violet", "Violet Glow"), "Pulse"),
        *_i(16, "emblem", ("katana", "Katana|🗡️")),
        *_i(20, "name", "Gold", "Holo", "Flame"),
        *_i(20, "emblem", ("gem", "Gem|💎")),
        *_i(25, "card", "Aurora", "Sheen", "Starfield", ("unicorn", "Unicorn Holo")),
        *_i(25, "emblem", ("crown-flame", "Blazing Crown|👑🔥")),
    ]
)
BY_ID: dict[str, FlairItem] = {f.id: f for f in CATALOG}


def equipped(db: Session, kid_id: int) -> dict[str, str | None]:
    """All five slots; unknown or wrong-slot ids (removed from the catalog) read as empty."""
    saved = dict(db.query(KidFlair.slot, KidFlair.item_id).filter(KidFlair.kid_id == kid_id).all())
    return {
        s: saved[s] if (it := BY_ID.get(saved.get(s))) and it.slot == s else None for s in SLOTS
    }


def equipped_many(db: Session, kid_ids: list[int]) -> dict[int, dict[str, str | None]]:
    """`equipped` for many kids in one query."""
    saved: dict[int, dict[str, str]] = {i: {} for i in kid_ids}
    for kid_id, slot, item in db.query(KidFlair.kid_id, KidFlair.slot, KidFlair.item_id).filter(
        KidFlair.kid_id.in_(kid_ids)
    ):
        saved[kid_id][slot] = item
    return {
        i: {s: m[s] if (it := BY_ID.get(m.get(s))) and it.slot == s else None for s in SLOTS}
        for i, m in saved.items()
    }
