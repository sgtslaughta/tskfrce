from dataclasses import replace
from datetime import datetime, time

from app.lock.rules import DeviceFacts, OwnerChores, block_reason, is_online, open_reason
from app.lock.schedule import Window

NOW = datetime(2026, 10, 19, 17, 0)  # Monday 17:00
INSIDE = Window(frozenset({0}), time(16), time(20))
OUTSIDE = Window(frozenset({0}), time(8), time(9))
PENDING = (OwnerChores(2, 1),)
DONE = (OwnerChores(2, 2),)


def facts(**kw):
    base = DeviceFacts(
        status="assigned",
        owners=DONE,
        allowed_sets=(),
        free=(),
        override=None,
        bonus_active=False,
        new_devices_blocked=True,
        points_unlock_early=False,
    )
    return replace(base, **kw)


def test_override_lock_wins_even_for_guest():
    assert not is_online(facts(override="lock", status="guest"), NOW)


def test_guest_online():
    assert is_online(facts(status="guest", owners=PENDING), NOW)


def test_unassigned_blocked_offline():
    assert not is_online(facts(status="unassigned"), NOW)


def test_unassigned_not_blocked_online():
    assert is_online(facts(status="unassigned", new_devices_blocked=False), NOW)


def test_unassigned_unlock_override_online():
    assert is_online(facts(status="unassigned", override="unlock"), NOW)


def test_outside_allowed_hours_offline():
    assert not is_online(facts(allowed_sets=((OUTSIDE,),)), NOW)


def test_inside_allowed_hours_chores_done_online():
    assert is_online(facts(allowed_sets=((INSIDE,),)), NOW)


def test_pending_chores_offline():
    assert not is_online(facts(owners=PENDING), NOW)


def test_free_time_unlocks_with_pending_chores():
    assert is_online(facts(owners=PENDING, free=(INSIDE,)), NOW)


def test_free_window_not_current_stays_offline():
    assert not is_online(facts(owners=PENDING, free=(OUTSIDE,)), NOW)


def test_unlock_override_with_pending_chores():
    assert is_online(facts(owners=PENDING, override="unlock"), NOW)


def test_unlock_still_respects_allowed_hours():
    f = facts(owners=PENDING, override="unlock", allowed_sets=((OUTSIDE,),))
    assert not is_online(f, NOW)


def test_bonus_unlocks_early_only_when_enabled():
    assert is_online(facts(owners=PENDING, bonus_active=True, points_unlock_early=True), NOW)
    assert not is_online(facts(owners=PENDING, bonus_active=True), NOW)
    assert not is_online(facts(owners=PENDING, points_unlock_early=True), NOW)


def test_no_windows_no_chores_online_all_day():
    assert is_online(facts(owners=(OwnerChores(0, 0),)), NOW)
    assert is_online(facts(owners=()), NOW)


def test_shared_device_one_owner_no_chores_other_pending_is_offline():
    owners = (OwnerChores(0, 0), OwnerChores(2, 1))
    assert not is_online(facts(owners=owners), NOW)


def test_group_and_kid_allowed_both_required():
    f = facts(allowed_sets=((INSIDE,), (OUTSIDE,)))
    assert not is_online(f, NOW)
    assert is_online(replace(f, allowed_sets=((INSIDE,), (INSIDE, OUTSIDE))), NOW)


def test_off_window_blocks_with_schedule_reason():
    f = facts(allowed_sets=((INSIDE,),), off=(INSIDE,))
    assert not is_online(f, NOW)
    assert block_reason(f, NOW) == "schedule"


def test_exempt_skips_hours_and_chores_but_not_manual_lock():
    f = facts(exempt=True, owners=PENDING, allowed_sets=((OUTSIDE,),), off=(INSIDE,))
    assert is_online(f, NOW) and open_reason(f, NOW) == "exempt"
    assert block_reason(replace(f, override="lock"), NOW) == "manual"


def test_chores_apply_false_skips_chores():
    assert is_online(facts(owners=PENDING, chores_apply=False), NOW)


def test_block_reasons():
    assert block_reason(facts(), NOW) is None
    assert block_reason(facts(override="lock"), NOW) == "manual"
    assert block_reason(facts(status="unassigned"), NOW) == "new_device"
    assert block_reason(facts(owners=PENDING), NOW) == "chores"
    assert block_reason(facts(allowed_sets=((OUTSIDE,),)), NOW) == "schedule"


def test_open_reasons():
    assert open_reason(facts(owners=PENDING), NOW) is None
    assert open_reason(facts(status="guest"), NOW) == "guest"
    assert open_reason(facts(status="unassigned", new_devices_blocked=False), NOW) == "unassigned"
    assert open_reason(facts(), NOW) == "chores"
    assert open_reason(facts(owners=(OwnerChores(0, 0),)), NOW) == "schedule"
    assert open_reason(facts(chores_apply=False), NOW) == "schedule"
    assert open_reason(facts(owners=PENDING, free=(INSIDE,)), NOW) == "free_time"
    assert open_reason(facts(owners=PENDING, override="unlock"), NOW) == "manual"
    assert (
        open_reason(facts(owners=PENDING, bonus_active=True, points_unlock_early=True), NOW)
        == "bonus"
    )


def test_manual_unlock_wins_open_reason():
    """A parent's unlock of a device already inside its hours reads as the parent's."""
    assert open_reason(facts(override="unlock"), NOW) == "manual"
    assert open_reason(facts(override="unlock", owners=(OwnerChores(0, 0),)), NOW) == "manual"
    inside = facts(override="unlock", chores_apply=False, allowed_sets=((INSIDE,),))
    assert open_reason(inside, NOW) == "manual"


def test_bonus_any_hours_unlocks_outside_window():
    f = facts(
        allowed_sets=((OUTSIDE,),),
        owners=PENDING,
        bonus_active=True,
        points_unlock_early=True,
    )
    assert not is_online(f, NOW)
    assert is_online(replace(f, bonus_any_hours=True), NOW)


def test_bonus_any_hours_reads_as_bonus():
    f = facts(allowed_sets=((OUTSIDE,),), bonus_active=True, points_unlock_early=True)
    assert open_reason(replace(f, bonus_any_hours=True), NOW) == "bonus"


def test_bonus_any_hours_never_opens_an_off_window():
    f = facts(
        owners=PENDING,
        off=(INSIDE,),
        bonus_active=True,
        points_unlock_early=True,
        bonus_any_hours=True,
    )
    assert block_reason(f, NOW) == "schedule"
    assert open_reason(f, NOW) is None
