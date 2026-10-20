from dataclasses import replace
from datetime import datetime, time

from app.lock.rules import DeviceFacts, OwnerChores, is_online
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
