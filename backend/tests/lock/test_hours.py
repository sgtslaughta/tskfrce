from datetime import date, datetime, time

from app.lock import hours
from app.lock.hours import RuleView, resolve
from app.lock.schedule import Window

D = date(2026, 12, 25)  # Friday
ALL = "0123456"


def rule(
    id,
    *,
    category="other",
    kind="allowed",
    days=ALL,
    times=(("00:00", "23:59"),),
    kids=(),
    groups=(),
    everyone=False,
    start=None,
    end=None,
):
    ds = frozenset(int(c) for c in days)
    ws = tuple(Window(ds, time.fromisoformat(s), time.fromisoformat(e)) for s, e in times)
    return RuleView(
        id, category, kind, ds, start, end, everyone, frozenset(kids), frozenset(groups), ws
    )


def w(s, e, days=ALL):
    return Window(frozenset(int(c) for c in days), time.fromisoformat(s), time.fromisoformat(e))


def spans(r):
    """Allowed sets as tuples of (start, end) strings, for comparing without day pinning."""
    return tuple(
        tuple((w.start.strftime("%H:%M"), w.end.strftime("%H:%M")) for w in ws)
        for ws in r.allowed_sets
    )


def t(rule_):
    return tuple((w.start.strftime("%H:%M"), w.end.strftime("%H:%M")) for w in rule_.windows)


def test_family_holiday_beats_kid_school_night():
    thu = date(2026, 12, 24)  # weekday 3: inside the school-night days
    holiday = rule(
        1, category="holiday", times=(("08:00", "23:00"),), everyone=True, start=thu, end=thu
    )
    school = rule(
        2,
        category="school_night",
        days="01236",
        times=(("15:00", "20:00"),),
        kids=[1],
        start=thu,
        end=thu,
    )
    assert hours.active_on(school, thu)
    r = resolve([holiday, school], {1}, set(), thu)
    assert spans(r) == (t(holiday),)


def test_summer_beats_everyday():
    summer = rule(1, category="summer", times=(("09:00", "22:00"),), everyone=True, start=D, end=D)
    weekend = rule(2, category="weekend", days="45", times=(("10:00", "12:00"),), kids=[1])
    other = rule(3, kids=[1], times=(("13:00", "14:00"),))
    r = resolve([weekend, other, summer], {1}, set(), D)
    assert spans(r) == (t(summer),)


def test_kid_group_and_everyone_all_restrict_same_tier():
    kid = rule(1, category="weekend", times=(("10:00", "12:00"),), kids=[1])
    grp = rule(2, category="weekend", times=(("11:00", "13:00"),), groups=[5])
    every = rule(3, category="weekend", times=(("09:00", "11:30"),), everyone=True)
    r = resolve([every, grp, kid], {1}, {5}, D)
    assert sorted(spans(r)) == sorted((t(kid), t(grp), t(every)))
    assert blocked_at(r, datetime(2026, 12, 25, 10, 30))  # group not open yet
    assert not blocked_at(r, datetime(2026, 12, 25, 11, 15))
    assert blocked_at(r, datetime(2026, 12, 25, 11, 45))


def test_kid_and_group_school_nights_intersect():
    thu = date(2026, 12, 24)
    kid = rule(1, category="school_night", days="01236", times=(("18:00", "20:00"),), kids=[1])
    grp = rule(2, category="school_night", days="01236", times=(("19:00", "21:00"),), groups=[5])
    r = resolve([kid, grp], {1}, {5}, thu)
    for hh, mm, ok in ((18, 30, False), (19, 0, True), (19, 59, True), (20, 30, False)):
        assert blocked_at(r, datetime(2026, 12, 24, hh, mm)) is not ok


def test_family_holiday_beats_kid_and_group_everyday():
    thu = date(2026, 12, 24)
    hol = rule(
        1, category="holiday", times=(("08:00", "23:00"),), everyone=True, start=thu, end=thu
    )
    kid = rule(2, category="school_night", days="01236", times=(("18:00", "20:00"),), kids=[1])
    grp = rule(3, category="school_night", days="01236", times=(("19:00", "21:00"),), groups=[5])
    r = resolve([kid, grp, hol], {1}, {5}, thu)
    assert spans(r) == (t(hol),)
    assert not blocked_at(r, datetime(2026, 12, 24, 10, 0))


def test_holiday_beats_school_night():
    school = rule(1, category="school_night", times=(("15:00", "20:00"),), everyone=True)
    holiday = rule(
        2, category="holiday", times=(("08:00", "23:00"),), everyone=True, start=D, end=D
    )
    assert spans(resolve([school, holiday], {1}, set(), D)) == (t(holiday),)


def test_group_and_kid_both_restrict():
    kid = rule(1, times=(("10:00", "12:00"),), kids=[1])
    grp = rule(2, times=(("11:00", "13:00"),), groups=[5])
    r = resolve([grp, kid], {1}, {5}, D)
    assert blocked_at(r, datetime(2026, 12, 25, 10, 30))
    assert not blocked_at(r, datetime(2026, 12, 25, 11, 30))
    assert blocked_at(r, datetime(2026, 12, 25, 12, 30))


def test_two_owners_intersect():
    a = rule(1, times=(("15:00", "20:00"),), kids=[1])
    b = rule(2, times=(("17:00", "22:00"),), kids=[2])
    assert spans(resolve([a, b], {1, 2}, set(), D)) == (t(a), t(b))


def test_off_rule_does_not_replace_allowed():
    fam = rule(1, times=(("08:00", "20:00"),), everyone=True)
    off = rule(2, kind="off", times=(("16:00", "18:00"),), kids=[1])
    r = resolve([fam, off], {1}, set(), D)
    assert spans(r) == (t(fam),)
    assert [(w.start.hour, w.end.hour) for w in r.off] == [(16, 18)]


def test_free_adds_on_top():
    free = rule(1, kind="free", times=(("10:00", "12:00"),), kids=[1])
    assert [(w.start.hour, w.end.hour) for w in resolve([free], {1}, set(), D).free] == [(10, 12)]


def test_dates_inclusive():
    r = rule(1, everyone=True, start=date(2026, 12, 24), end=date(2026, 12, 25))
    assert hours.active_on(r, date(2026, 12, 24))
    assert hours.active_on(r, date(2026, 12, 25))
    assert not hours.active_on(r, date(2026, 12, 23))
    assert not hours.active_on(r, date(2026, 12, 26))


def test_active_on_checks_weekday():
    assert not hours.active_on(rule(1, days="0", everyone=True), D)  # D is Friday


def test_everyone_needs_owner():
    r = rule(1, everyone=True)
    assert resolve([r], set(), set(), D).allowed_sets == ()


def test_locks_at_off_window():
    off = (w("16:00", "18:00"),)
    allowed = ((w("00:00", "23:59"),),)
    now = datetime(2026, 12, 25, 15, 0)
    assert hours.locks_at(allowed, off, now) == datetime(2026, 12, 25, 16, 0)


def test_locks_at_bedtime_and_edges():
    sets = ((w("07:00", "20:00"),),)
    assert hours.locks_at(sets, (), datetime(2026, 12, 25, 15, 3)) == datetime(2026, 12, 25, 20, 0)
    assert hours.locks_at(sets, (), datetime(2026, 12, 25, 21, 0)) is None  # already locked
    assert hours.locks_at((), (), datetime(2026, 12, 25, 15)) is None  # no hours set
    over = ((Window(frozenset({4}), time(18), time(2)),),)
    assert hours.locks_at(over, (), datetime(2026, 12, 25, 23)) == datetime(2026, 12, 26, 2)


def test_today_category_lowest_rank_of_everyone_allowed():
    rules = [
        rule(1, category="school_night", everyone=True),
        rule(2, category="weekend", everyone=True),
        rule(3, category="holiday", kids=[1], start=D, end=D),  # not everyone: ignored
        rule(4, category="holiday", kind="off", everyone=True),  # not allowed: ignored
    ]
    assert hours.today_category(rules, D) == "weekend"
    assert hours.today_category([], D) is None


MON = date(2026, 12, 21)
SUN = date(2026, 12, 20)
SAT = date(2026, 12, 26)


def blocked_at(r, now):
    return not hours._allowing(r.allowed_sets, r.off, now)


def test_overnight_tail_survives_midnight():
    sun = rule(1, days="6", times=(("20:00", "07:00"),), kids=[1])
    r = resolve([sun], {1}, set(), MON)
    assert not blocked_at(r, datetime(2026, 12, 21, 1, 0))
    assert blocked_at(r, datetime(2026, 12, 21, 8, 0))


def test_no_rule_today_fails_closed():
    wk = rule(1, days="0123", times=(("08:00", "20:00"),), kids=[1])
    r = resolve([wk], {1}, set(), SAT)
    assert () in r.allowed_sets
    assert blocked_at(r, datetime(2026, 12, 26, 12, 0))


def test_unrestricted_without_any_rule():
    assert resolve([], {1}, set(), SAT).allowed_sets == ()


def test_shared_device_resolved_per_owner():
    thu = date(2026, 12, 24)
    a = rule(1, category="holiday", times=(("08:00", "23:00"),), kids=[1], start=thu, end=thu)
    fam = rule(2, category="school_night", days="01236", times=(("15:00", "20:00"),), everyone=True)
    r = resolve([a, fam], {1, 2}, set(), thu)
    assert spans(r) == ((("08:00", "23:00"),), (("15:00", "20:00"),))
    assert blocked_at(r, datetime(2026, 12, 24, 10, 0))
    assert not blocked_at(r, datetime(2026, 12, 24, 16, 0))


def test_own_rule_for_one_owner_does_not_free_the_other():
    a = rule(1, times=(("08:00", "23:00"),), kids=[1])
    fam = rule(2, times=(("15:00", "20:00"),), everyone=True)
    r = resolve([a, fam], {1, 2}, set(), D)
    assert blocked_at(r, datetime(2026, 12, 25, 10, 0))  # B only has 15-20


def test_dated_rule_ended_yesterday_does_not_lock():
    thu = date(2026, 12, 24)
    ended = rule(1, category="holiday", times=(("08:00", "23:00"),), kids=[1], start=thu, end=thu)
    r = resolve([ended], {1}, set(), date(2026, 12, 25))
    assert r.allowed_sets == ()
    assert not blocked_at(r, datetime(2026, 12, 25, 12, 0))
