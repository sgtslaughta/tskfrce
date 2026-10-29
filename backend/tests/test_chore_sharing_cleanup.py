from datetime import date

from app.models.chores import ChoreAssignment, ChoreRun
from app.services import chores as svc

from tests.factories import api_chore
from tests.test_chore_sharing import _chores, _setup


def test_once_chore_stays_in_the_library(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    chore, _ = api_chore(client, parent_headers, [a], repeat={"type": "once"})
    assert db.query(ChoreRun).count() == 1 and len(_chores(client, ha)) == 1
    assert svc.run_reset(db, date(2026, 10, 21)) == 0
    asg = db.query(ChoreAssignment).one()
    assert asg.active is False  # lapsed, still listed for reuse
    rows = client.get("/api/v1/chores/", headers=parent_headers).json()
    assert rows[0]["id"] == chore["id"] and len(rows[0]["assignments"]) == 1


def test_once_race_chore_is_one_shared_run(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    api_chore(client, parent_headers, [a, b], "race", repeat={"type": "once"})
    assert db.query(ChoreRun).count() == 1
    assert len(_chores(client, ha)) == 1 and len(_chores(client, hb)) == 1


def test_deleting_a_kid_keeps_shared_chore_for_the_rest(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    _, asg = api_chore(client, parent_headers, [a, b], "race")
    assert client.delete(f"/api/v1/kids/{a.id}", headers=parent_headers).status_code == 200
    row = db.get(ChoreAssignment, asg["id"])
    db.refresh(row)
    assert row.active and [k.id for k in row.kids] == [b.id] and row.mode == "each"
    assert svc.run_reset(db, date(2026, 10, 21)) == 1
    db.commit()
    assert db.query(ChoreRun).filter(ChoreRun.kid_id == b.id).count() == 1


def test_reset_skips_kids_that_no_longer_exist(client, db, parent_headers):
    a, b, ha, hb = _setup(db)
    api_chore(client, parent_headers, [a, b], "each")
    assert client.delete(f"/api/v1/kids/{a.id}", headers=parent_headers).status_code == 200
    assert svc.run_reset(db, date(2026, 10, 21)) == 1
