from datetime import date, datetime, timedelta

from app.lock.reset import chore_counts, chore_day, reset_due, run_reset
from app.lock.rules import OwnerChores
from app.lock.schedule import local_now
from app.models.family import get_family
from app.models.task import Task, TaskStatus

D = date(2026, 10, 20)  # Tuesday


def defn(db, parent, kid, pattern):
    t = Task(
        title="Dishes",
        is_recurring=True,
        recurrence_pattern={**pattern, "chore": True},
        assigned_to_id=kid.id,
        created_by_id=parent.id,
        points=5,
    )
    db.add(t)
    db.commit()
    return t


def instances(db):
    return db.query(Task).filter(Task.is_recurring.is_(False)).all()


def test_reset_creates_daily_instances_once(db, parent, kid):
    defn(db, parent, kid, {"type": "daily"})
    assert run_reset(db, D) == 1
    assert run_reset(db, D) == 0
    assert len(instances(db)) == 1


def test_reset_cancels_unfinished_yesterday(db, parent, kid):
    defn(db, parent, kid, {"type": "daily"})
    run_reset(db, D - timedelta(days=1))
    old = instances(db)[0]
    done = Task(
        title="x",
        created_by_id=parent.id,
        assigned_to_id=kid.id,
        due_date=datetime(2026, 10, 19),
        status=TaskStatus.DONE,
        recurrence_pattern={"chore": True},
    )
    db.add(done)
    db.commit()
    run_reset(db, D)
    db.refresh(old)
    assert old.status == TaskStatus.CANCELLED
    assert done.status == TaskStatus.DONE
    assert chore_counts(db, kid.id, D).total == 1


def test_weekly_chore_only_on_its_days(db, parent, kid):
    defn(db, parent, kid, {"type": "weekly", "days": [0]})  # Monday
    assert run_reset(db, D) == 0
    assert run_reset(db, date(2026, 10, 26)) == 1


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


def test_reset_leaves_non_chore_tasks_alone(db, parent, kid):
    v1 = Task(
        title="v1",
        created_by_id=parent.id,
        due_date=datetime(2026, 10, 1),
        status=TaskStatus.TODO,
    )
    db.add(v1)
    db.commit()
    run_reset(db, D)
    db.refresh(v1)
    assert v1.status == TaskStatus.TODO


def test_done_without_parent_approval_does_not_count(db, parent, kid):
    row = Task(
        title="x",
        created_by_id=parent.id,
        assigned_to_id=kid.id,
        due_date=datetime(2026, 10, 20),
        status=TaskStatus.DONE,
        recurrence_pattern={"chore": True},
    )
    db.add(row)
    db.commit()
    assert chore_counts(db, kid.id, D).approved == 0
    row.approved_by_id = kid.id  # a kid is not an approver
    db.commit()
    assert chore_counts(db, kid.id, D).approved == 0
    row.approved_by_id = parent.id
    db.commit()
    assert chore_counts(db, kid.id, D) == OwnerChores(1, 1)
