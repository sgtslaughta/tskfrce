"""Chore library migration: legacy task rows -> chores/assignments/runs."""

import json
import os
import sqlite3
import subprocess
import sys
from datetime import UTC, date, datetime
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
OLD, NEW = "a7b8c9d0e1f2", "b8c9d0e1f2a3"


def _alembic(url: str, rev: str) -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", rev],
        cwd=BACKEND,
        env={**os.environ, "DATABASE_URL": url},
        check=True,
        capture_output=True,
    )


def _pat(**kw) -> str:
    return json.dumps({"chore": True, **kw})


def _seed(c: sqlite3.Cursor) -> None:
    for uid, name, role in [(1, "mom", "PARENT"), (2, "ann", "KID"), (3, "bob", "KID")]:
        c.execute(
            "INSERT INTO users (id, username, email, hashed_password, role) VALUES (?,?,?,?,?)",
            (uid, name, f"{name}@x.io", "x", role),
        )
    cols = (
        "id,title,status,points,is_recurring,recurrence_pattern,created_by_id,assigned_to_id,"
        "parent_task_id,due_date,attempt,last_note,submitted_by_id,approved_by_id,created_at"
    )
    day = "2026-10-21 00:00:00.000000"
    rows = [
        # D1 daily/each for ann+bob, 2 subtasks, photo, due time
        (
            1,
            "Dishes",
            "TODO",
            10,
            1,
            _pat(
                type="daily",
                days=[],
                assignees=[2, 3],
                mode="each",
                needs_photo=True,
                due_time="18:00",
                subtasks=["Rinse", "Load"],
            ),
            1,
            2,
            None,
            None,
            1,
            None,
            None,
            None,
        ),
        # D2 weekly race Mon/Wed/Fri
        (
            2,
            "Trash",
            "TODO",
            5,
            1,
            _pat(type="weekly", days=[0, 2, 4], assignees=[2, 3], mode="race"),
            1,
            2,
            None,
            None,
            1,
            None,
            None,
            None,
        ),
        # D3 team
        (
            3,
            "Yard",
            "TODO",
            20,
            1,
            _pat(type="daily", days=[], assignees=[2, 3], mode="team"),
            1,
            2,
            None,
            None,
            1,
            None,
            None,
            None,
        ),
        # D4 deleted definition (cancelled, with a cancelled instance)
        (
            4,
            "Old chore",
            "CANCELLED",
            3,
            0,
            _pat(type="daily", days=[], assignees=[2], mode="each"),
            1,
            2,
            None,
            None,
            1,
            None,
            None,
            None,
        ),
        # instances
        (
            10,
            "Dishes",
            "TODO",
            10,
            0,
            _pat(
                type="daily",
                assignees=[2, 3],
                mode="each",
                needs_photo=True,
                due_time="18:00",
                subtasks=["Rinse", "Load"],
            ),
            1,
            3,
            1,
            day,
            1,
            None,
            None,
            None,
        ),
        (
            11,
            "Dishes",
            "TODO",
            10,
            0,
            _pat(
                type="daily",
                assignees=[2, 3],
                mode="each",
                needs_photo=True,
                due_time="18:00",
                subtasks=["Rinse", "Load"],
            ),
            1,
            2,
            1,
            day,
            2,
            "Missed a spot",
            None,
            None,
        ),
        (
            12,
            "Trash",
            "SUBMITTED_FOR_APPROVAL",
            5,
            0,
            _pat(type="weekly", days=[0, 2, 4], assignees=[2, 3], mode="race"),
            1,
            None,
            2,
            day,
            1,
            None,
            3,
            None,
        ),
        (
            13,
            "Yard",
            "DONE",
            20,
            0,
            _pat(type="daily", assignees=[2, 3], mode="team"),
            1,
            None,
            3,
            day,
            1,
            None,
            2,
            1,
        ),
        (
            14,
            "Old chore",
            "CANCELLED",
            3,
            0,
            _pat(type="daily", assignees=[2], mode="each"),
            1,
            2,
            4,
            day,
            1,
            None,
            None,
            None,
        ),
        # one-time chore instance (no parent)
        (
            15,
            "Birthday card",
            "TODO",
            7,
            0,
            _pat(type="once", assignees=[2], mode="each"),
            1,
            2,
            None,
            day,
            1,
            None,
            None,
            None,
        ),
    ]
    for r in rows:
        c.execute(f"INSERT INTO tasks ({cols}) VALUES ({'?,' * 14}'2026-10-20 08:00:00.000000')", r)
    c.execute("INSERT INTO chore_participants VALUES (12,2),(12,3),(13,2),(13,3)")
    for i, (tid, pos, title, done) in enumerate(
        [(10, 0, "Rinse", 0), (10, 1, "Load", 0), (11, 0, "Rinse", 1), (11, 1, "Load", 0)], 1
    ):
        c.execute(
            "INSERT INTO chore_subtasks (id,task_id,position,title,done_by_id,done_at) VALUES (?,?,?,?,?,?)",
            (
                i,
                tid,
                pos,
                title,
                2 if done else None,
                "2026-10-21 10:00:00.000000" if done else None,
            ),
        )
    c.execute(
        "INSERT INTO chore_photos (id,task_id,attempt,uploaded_by_id,path,thumb_path) VALUES "
        "(1,11,2,2,'p.jpg','t.jpg')"
    )
    c.execute(
        "INSERT INTO threads (id,kind,task_id,created_at) VALUES (1,'chore',11,'2026-10-21 09:00:00')"
    )
    c.execute(
        "INSERT INTO thread_messages (id,thread_id,kind,body,created_at) VALUES "
        "(1,1,'user','hi','2026-10-21 09:01:00'),(2,1,'system','Sent back','2026-10-21 09:02:00')"
    )
    c.execute(
        "INSERT INTO points (id,user_id,points_type,amount,reference_type,reference_id) VALUES "
        "(1,2,'TASK_COMPLETION',10,'task',13),(2,3,'TASK_COMPLETION',10,'task',13),"
        "(3,2,'BONUS',2,'task_bonus',13)"
    )


def test_chore_library_migration(tmp_path):
    path = tmp_path / "m.db"
    url = f"sqlite:///{path}"
    _alembic(url, OLD)
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    c = con.cursor()
    _seed(c)
    con.commit()
    con.close()
    _alembic(url, NEW)
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    q = lambda sql: [dict(r) for r in con.execute(sql)]  # noqa: E731

    chores = {r["title"]: r for r in q("SELECT * FROM chores")}
    assert len(chores) == 5
    assert chores["Old chore"]["archived_at"] is not None
    assert chores["Dishes"]["archived_at"] is None and chores["Dishes"]["needs_photo"] == 1
    steps = q(
        f"SELECT title FROM chore_steps WHERE chore_id={chores['Dishes']['id']} ORDER BY position"
    )
    assert [s["title"] for s in steps] == ["Rinse", "Load"]

    asg = {
        r["title"]: r
        for r in q("SELECT a.*, c.title FROM chore_assignments a JOIN chores c ON c.id=a.chore_id")
    }
    assert asg["Dishes"]["mode"] == "each" and asg["Dishes"]["repeat"] == "daily"
    assert asg["Dishes"]["due_time"] == "18:00" and asg["Dishes"]["active"] == 1
    assert asg["Trash"]["mode"] == "race" and asg["Trash"]["days"] == "024"
    assert asg["Old chore"]["active"] == 0
    assert (
        asg["Birthday card"]["repeat"] == "once" and asg["Birthday card"]["on_date"] == "2026-10-21"
    )
    kids = q(
        f"SELECT kid_id FROM assignment_kids WHERE assignment_id={asg['Dishes']['id']} ORDER BY kid_id"
    )
    assert [k["kid_id"] for k in kids] == [2, 3]

    runs = q(
        "SELECT r.*, c.title FROM chore_runs r JOIN chore_assignments a ON a.id=r.assignment_id "
        "JOIN chores c ON c.id=a.chore_id ORDER BY r.id"
    )
    assert len(runs) == 6
    by = {(r["title"], r["kid_id"]): r for r in runs}
    sent_back = by[("Dishes", 2)]
    assert (sent_back["attempt"], sent_back["last_note"], sent_back["status"]) == (
        2,
        "Missed a spot",
        "todo",
    )
    race = by[("Trash", None)]
    assert race["status"] == "submitted" and race["submitted_by_id"] == 3
    team = by[("Yard", None)]
    assert (
        team["status"] == "done"
        and team["approved_by_id"] == 1
        and str(team["day"]) == "2026-10-21"
    )
    assert by[("Old chore", 2)]["status"] == "cancelled"
    shared = q("SELECT run_id, kid_id FROM run_kids ORDER BY run_id, kid_id")
    assert {(s["run_id"], s["kid_id"]) for s in shared} == {
        (race["id"], 2),
        (race["id"], 3),
        (team["id"], 2),
        (team["id"], 3),
    }

    ticks = q("SELECT * FROM run_step_ticks")
    assert len(ticks) == 1 and ticks[0]["run_id"] == sent_back["id"] and ticks[0]["done_by_id"] == 2
    assert q("SELECT run_id FROM chore_photos")[0]["run_id"] == sent_back["id"]
    assert q("SELECT run_id FROM threads")[0]["run_id"] == sent_back["id"]
    assert q("SELECT COUNT(*) n FROM thread_messages")[0]["n"] == 2
    assert [p["run_id"] for p in q("SELECT run_id FROM points ORDER BY id")] == [team["id"]] * 3


def _snapshot(url: str) -> dict:
    """What the parent and the lock see: needs-you items, attempts, notes, blocked MACs."""
    from app.api.family import _needs_you
    from app.lock.state import desired_blocked
    from app.models.chores import ChoreRun
    from app.models.family import get_family
    from app.models.user import User
    from app.services import chores as svc
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    with Session(create_engine(url)) as db:
        runs = svc.day_runs(db, date(2026, 10, 21)).order_by(ChoreRun.id).all()
        names = {u.id: u.full_name for u in db.query(User)}
        return {
            "needs_you": _needs_you(db, runs, names, get_family(db)),
            "runs": [(r.id, r.attempt, r.last_note, r.status, svc.run_kid_ids(r)) for r in runs],
            "blocked": desired_blocked(db, datetime(2026, 10, 21, 12, 0, tzinfo=UTC)),
        }


def test_drop_legacy_keeps_what_parents_and_lock_see(tmp_path):
    from app.models.lock import Device
    from app.models.user import User
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    url = f"sqlite:///{tmp_path / 'm.db'}"
    _alembic(url, OLD)
    con = sqlite3.connect(tmp_path / "m.db")
    _seed(con.cursor())
    con.commit()
    con.close()
    _alembic(url, "d0e1f2a3b4c5")
    with Session(create_engine(url)) as db:
        for i, kid in enumerate(db.query(User).filter(User.id.in_([2, 3]))):
            db.add(
                Device(mac=f"aa:bb:cc:dd:ee:0{i}", name=f"d{i}", status="assigned", owners=[kid])
            )
        db.commit()
    # Migrate to head to ensure all schema columns exist (including accent) before taking snapshot
    _alembic(url, "head")
    before = _snapshot(url)
    assert before["needs_you"] and before["runs"] and before["blocked"]
    # Snapshot at final state should match
    assert _snapshot(url) == before
