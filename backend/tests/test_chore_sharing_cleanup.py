from datetime import date

from app.lock.reset import run_reset
from app.models.task import Task

from tests.test_chore_sharing import _chores, _create, _setup


def test_once_chore_creates_no_phantom_row(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _create(client, parent_headers, [a], "each", repeat={"type": "once"})
    assert db.query(Task).count() == 1
    assert len(_chores(client, ha)) == 1


def test_once_race_chore_is_one_shared_row(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _create(client, parent_headers, [a, b], "race", repeat={"type": "once"})
    assert db.query(Task).count() == 1
    assert len(_chores(client, ha)) == 1 and len(_chores(client, hb)) == 1


def test_deleting_a_kid_keeps_shared_chore_for_the_rest(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    d = _create(client, parent_headers, [a, b], "race")["definition"]
    assert client.delete(f"/api/v1/kids/{a.id}", headers=parent_headers).status_code == 200
    defn = db.get(Task, d["id"])
    db.refresh(defn)
    assert defn.is_recurring
    assert defn.recurrence_pattern["assignees"] == [b.id]
    assert defn.recurrence_pattern["mode"] == "each"
    assert run_reset(db, date(2026, 10, 21)) == 1
    db.commit()
    assert db.query(Task).filter(Task.assigned_to_id == b.id).count() >= 1


def test_reset_skips_assignees_that_no_longer_exist(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    d = _create(client, parent_headers, [a, b], "each")["definition"]
    defn = db.get(Task, d["id"])
    defn.recurrence_pattern = {**defn.recurrence_pattern, "assignees": [a.id, 99999]}
    db.commit()
    assert run_reset(db, date(2026, 10, 21)) == 1
