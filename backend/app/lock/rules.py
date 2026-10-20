"""Pure rule engine: is a device online right now?"""

from dataclasses import dataclass
from datetime import datetime

from app.lock.schedule import Window, in_window


@dataclass(frozen=True)
class OwnerChores:
    total: int  # today's chore instances, excluding cancelled
    approved: int  # status done


@dataclass(frozen=True)
class DeviceFacts:
    status: str  # unassigned | assigned | guest
    owners: tuple[OwnerChores, ...]
    allowed_sets: tuple[tuple[Window, ...], ...]  # one per owner/group with windows
    free: tuple[Window, ...]  # union of owners' + groups' free windows
    override: str | None  # newest unexpired: "lock" | "unlock" | None
    bonus_active: bool
    new_devices_blocked: bool
    points_unlock_early: bool


def is_online(f: DeviceFacts, now_local: datetime) -> bool:
    if f.override == "lock":
        return False
    if f.status == "guest":
        return True
    if f.status == "unassigned":
        return f.override == "unlock" or not f.new_devices_blocked
    if not all(any(in_window(w, now_local) for w in s) for s in f.allowed_sets):
        return False
    chores_ok = all(o.total == 0 or o.approved == o.total for o in f.owners)
    return (
        chores_ok
        or any(in_window(w, now_local) for w in f.free)
        or f.override == "unlock"
        or (f.bonus_active and f.points_unlock_early)
    )
