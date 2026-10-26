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


def test_family_holiday_beats_kid_school_night():
    holiday = rule(
        1, category="holiday", times=(("08:00", "23:00"),), everyone=True, start=D, end=D
    )
    school = rule(
        2,
        category="school_night",
        days="01236",
        times=(("15:00", "20:00"),),
        kids=[1],
        start=D,
        end=D,
    )
    r = resolve([holiday, school], {1}, set(), D)
    assert r.allowed_sets == (holiday.windows,)


def test_summer_beats_everyday():
    summer = rule(1, category="summer", times=(("09:00", "22:00"),), everyone=True, start=D, end=D)
    weekend = rule(2, category="weekend", days="45", times=(("10:00", "12:00"),), kids=[1])
    other = rule(3, kids=[1], times=(("13:00", "14:00"),))
    r = resolve([weekend, other, summer], {1}, set(), D)
    assert r.allowed_sets == (summer.windows,)


def test_kid_beats_group_beats_everyone_same_tier():
    kid = rule(1, category="weekend", times=(("10:00", "11:00"),), kids=[1])
    grp = rule(2, category="weekend", times=(("11:00", "12:00"),), groups=[5])
    every = rule(3, category="weekend", times=(("12:00", "13:00"),), everyone=True)
    assert resolve([every, grp, kid], {1}, {5}, D).allowed_sets == (kid.windows,)
    assert resolve([every, grp], {1}, {5}, D).allowed_sets == (grp.windows,)
    assert resolve([every], {1}, {5}, D).allowed_sets == (every.windows,)


def test_holiday_beats_school_night():
    school = rule(1, category="school_night", times=(("15:00", "20:00"),), everyone=True)
    holiday = rule(
        2, category="holiday", times=(("08:00", "23:00"),), everyone=True, start=D, end=D
    )
    assert resolve([school, holiday], {1}, set(), D).allowed_sets == (holiday.windows,)


def test_group_below_kid():
    kid = rule(1, times=(("10:00", "11:00"),), kids=[1])
    grp = rule(2, times=(("11:00", "12:00"),), groups=[5])
    assert resolve([grp, kid], {1}, {5}, D).allowed_sets == (kid.windows,)


def test_two_owners_intersect():
    a = rule(1, times=(("15:00", "20:00"),), kids=[1])
    b = rule(2, times=(("17:00", "22:00"),), kids=[2])
    assert resolve([a, b], {1, 2}, set(), D).allowed_sets == (a.windows, b.windows)


def test_off_rule_does_not_replace_allowed():
    fam = rule(1, times=(("08:00", "20:00"),), everyone=True)
    off = rule(2, kind="off", times=(("16:00", "18:00"),), kids=[1])
    r = resolve([fam, off], {1}, set(), D)
    assert r.allowed_sets == (fam.windows,)
    assert r.off == off.windows


def test_free_adds_on_top():
    free = rule(1, kind="free", times=(("10:00", "12:00"),), kids=[1])
    assert resolve([free], {1}, set(), D).free == free.windows


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
