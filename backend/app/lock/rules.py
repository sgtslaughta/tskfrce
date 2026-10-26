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
    free: tuple[Window, ...]  # free windows that apply to this device
    override: str | None  # newest unexpired manual: "lock" | "unlock" | None
    bonus_active: bool
    new_devices_blocked: bool
    points_unlock_early: bool
    off: tuple[Window, ...] = ()  # internet-off windows
    chores_apply: bool = True  # False: family or a group switched the chore check off
    exempt: bool = False  # never locked by hours or chores
    bonus_any_hours: bool = False  # bonus screen time also opens outside hours


def _in_any(ws: tuple[Window, ...], now_local: datetime) -> bool:
    return any(in_window(w, now_local) for w in ws)


def in_allowed(f: DeviceFacts, now_local: datetime) -> bool:
    """Inside allowed hours: no off window and every allowed set has one containing now."""
    return not _in_any(f.off, now_local) and all(_in_any(s, now_local) for s in f.allowed_sets)


def _chores_ok(f: DeviceFacts) -> bool:
    return not f.chores_apply or all(o.total == 0 or o.approved == o.total for o in f.owners)


def block_reason(f: DeviceFacts, now_local: datetime) -> str | None:
    """Why the device is offline: manual | new_device | schedule | chores; None when online."""
    if f.override == "lock":
        return "manual"
    if f.status == "guest":
        return None
    if f.status == "unassigned":
        ok = f.override == "unlock" or not f.new_devices_blocked
        return None if ok else "new_device"
    if f.exempt:
        return None
    if f.bonus_active and f.points_unlock_early and f.bonus_any_hours:
        return None
    if not in_allowed(f, now_local):
        return "schedule"
    if (
        _chores_ok(f)
        or _in_any(f.free, now_local)
        or f.override == "unlock"
        or (f.bonus_active and f.points_unlock_early)
    ):
        return None
    return "chores"


def is_online(f: DeviceFacts, now_local: datetime) -> bool:
    return block_reason(f, now_local) is None


def open_reason(f: DeviceFacts, now_local: datetime) -> str | None:
    """Why the device is online; None when blocked."""
    if block_reason(f, now_local) is not None:
        return None
    if f.override == "unlock":  # a parent's unlock wins, even inside hours
        return "manual"
    if f.status == "guest":
        return "guest"
    if f.status == "unassigned":
        return "unassigned"
    if f.exempt:
        return "exempt"
    if f.bonus_active and f.points_unlock_early and not in_allowed(f, now_local):
        return "bonus"  # bonus_any_hours opened it outside hours
    if f.chores_apply and any(o.total > 0 for o in f.owners) and _chores_ok(f):
        return "chores"
    if not f.chores_apply or all(o.total == 0 for o in f.owners):
        return "schedule"
    if _in_any(f.free, now_local):
        return "free_time"
    return "bonus"
