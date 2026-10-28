from datetime import UTC, date, datetime, timedelta

from app.lock.reset import chore_day, reset_due
from app.lock.schedule import local_now
from app.lock.state import tick
from app.models.chores import ChoreRun
from app.models.family import get_family
from app.services import chores as svc
from app.services.chores import run_reset
from tests.factories import make_chore, make_run

D = date(2026, 10, 20)  # Tuesday


def test_reset_creates_daily_runs_once(db, parent, kid):
    make_chore(db, parent, kids=[kid])
    assert run_reset(db, D) == 1
    assert run_reset(db, D) == 0
    assert db.query(ChoreRun).count() == 1


def test_generate_twice_is_idempotent_for_each_and_shared(db, parent, kid):
    """Review focus 3: two workers / a box restart never double up."""
    from app.models.user import UserRole
    from tests.conftest import _make_user

    other = _make_user(db, "maya", UserRole.KID)
    make_chore(db, parent, kids=[kid, other], mode="each")
    make_chore(db, parent, title="Race", kids=[kid, other], mode="race")
    assert len(svc.generate(db, D)) == 3
    db.commit()
    assert svc.generate(db, D) == []
    db.commit()
    assert db.query(ChoreRun).count() == 3


def test_reset_cancels_unfinished_yesterday(db, parent, kid):
    make_chore(db, parent, kids=[kid])
    run_reset(db, D - timedelta(days=1))
    old = db.query(ChoreRun).one()
    done = make_run(db, parent, kid, status="done", approved=True, day=D - timedelta(days=1))
    run_reset(db, D)
    db.refresh(old)
    assert old.status == "cancelled"
    assert done.status == "done"
    assert svc.counts(db, kid.id, D) == (0, 1)


def test_weekly_chore_only_on_its_days(db, parent, kid):
    make_chore(db, parent, kids=[kid], repeat="weekly", days="0")  # Monday
    assert run_reset(db, D) == 0
    assert run_reset(db, date(2026, 10, 26)) == 1


def test_once_assignment_only_on_its_date(db, parent, kid):
    _, a = make_chore(db, parent, kids=[kid], repeat="once", on_date=D)
    assert run_reset(db, D - timedelta(days=1)) == 0
    assert run_reset(db, D) == 1
    assert run_reset(db, D + timedelta(days=1)) == 0
    db.refresh(a)
    assert a.active is False


def test_before_reset_time_yesterday_still_counts(db):
    fam = get_family(db)
    fam.timezone, fam.reset_time, fam.last_reset_date = "UTC", "06:00", D
    db.commit()
    now = local_now("UTC", datetime(2026, 10, 21, 3, 0))
    assert not reset_due(fam, now)
    assert chore_day(fam) == D


def test_dst_day_resets_once(db):
    fam = get_family(db)
    fam.timezone, fam.reset_time = "America/New_York", "06:00"
    fam.last_reset_date = date(2026, 10, 31)
    db.commit()
    resets = 0
    t = datetime(2026, 11, 1, 0, 0)
    while t < datetime(2026, 11, 2, 4, 0):
        now = local_now(fam.timezone, t)
        if reset_due(fam, now):
            run_reset(db, now.date())
            resets += 1
        t += timedelta(minutes=30)
    assert resets == 1
    assert fam.last_reset_date == date(2026, 11, 1)


def test_done_without_parent_approval_does_not_count(db, parent, kid):
    row = make_run(db, parent, kid, status="done")
    assert svc.counts(db, kid.id, D)[0] == 0
    row.approved_by_id = kid.id  # a kid is not an approver
    db.commit()
    assert svc.counts(db, kid.id, D)[0] == 0
    row.approved_by_id = parent.id
    db.commit()
    assert svc.counts(db, kid.id, D) == (1, 1)


def test_today_is_the_family_date_just_after_utc_midnight(db, parent, kid):
    """Review focus 4: 00:30 UTC is still yesterday evening in New York."""
    fam = get_family(db)
    fam.timezone, fam.reset_time = "America/New_York", "06:00"
    db.commit()
    make_chore(db, parent, kids=[kid])
    now = datetime(2026, 10, 22, 0, 30, tzinfo=UTC)
    assert svc.today(db, now) == date(2026, 10, 21)
    tick(db, now)
    assert {r.day for r in db.query(ChoreRun)} == {date(2026, 10, 21)}
    assert fam.last_reset_date == date(2026, 10, 21)
