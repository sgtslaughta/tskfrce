"""Archived chores are purged like a delete; points stay, detached from the run."""

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
PREV = "s2b3c4d5e6f7"


def _alembic(url, target, data):
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", target],
        cwd=BACKEND,
        env={**os.environ, "DATABASE_URL": url, "DATA_DIR": str(data)},
        check=True,
        capture_output=True,
    )


def test_purge_archived_chores(tmp_path):
    path, data = tmp_path / "m.db", tmp_path / "data"
    url = f"sqlite:///{path}"
    _alembic(url, PREV, data)
    photo = data / "uploads" / "chore" / "1" / "a.jpg"
    photo.parent.mkdir(parents=True)
    photo.write_bytes(b"x")
    con = sqlite3.connect(path)
    for sql in (
        "INSERT INTO users (id, username, email, hashed_password, role)"
        " VALUES (1,'mom','m@x.io','x','PARENT'),(2,'ann','a@x.io','x','KID')",
        "INSERT INTO chores (id,title,points,needs_photo,created_by_id,type_id,archived_at)"
        " VALUES (1,'Old',5,0,1,1,'2026-10-01'),(2,'Live',5,0,1,1,NULL)",
        "INSERT INTO chore_steps (id,chore_id,position,title) VALUES (1,1,0,'s'),(2,2,0,'t')",
        "INSERT INTO chore_assignments (id,chore_id,mode,repeat,active)"
        " VALUES (1,1,'each','daily',0),(2,2,'each','daily',1)",
        "INSERT INTO assignment_kids VALUES (1,2),(2,2)",
        "INSERT INTO chore_runs (id,assignment_id,day,kid_id,status,attempt)"
        " VALUES (1,1,'2026-09-30',2,'done',1),(2,2,'2026-10-27',2,'todo',1)",
        "INSERT INTO run_step_ticks (run_id,step_id) VALUES (1,1)",
        "INSERT INTO chore_photos (id,run_id,attempt,uploaded_by_id,path,thumb_path)"
        " VALUES (1,1,1,2,'chore/1/a.jpg','chore/1/a_thumb.jpg')",
        "INSERT INTO threads (id,kind,run_id) VALUES (1,'chore',1),(2,'chore',2)",
        "INSERT INTO thread_messages (id,thread_id,kind,body,created_at)"
        " VALUES (1,1,'system','Photo added','2026-09-30'),(2,2,'user','hi','2026-10-27')",
        "INSERT INTO points (id,user_id,points_type,amount,reason,run_id,seen_by_kid)"
        " VALUES (1,2,'TASK_COMPLETION',5,'chore',1,1),(2,2,'TASK_COMPLETION',5,'chore',2,1)",
    ):
        con.execute(sql)
    con.commit()
    con.close()

    _alembic(url, "head", data)

    con = sqlite3.connect(path)
    one = lambda sql: [r[0] for r in con.execute(sql)]  # noqa: E731
    assert one("SELECT id FROM chores") == [2]
    assert one("SELECT id FROM chore_steps") == [2]
    assert one("SELECT id FROM chore_assignments") == [2]
    assert one("SELECT id FROM chore_runs") == [2]
    assert one("SELECT count(*) FROM run_step_ticks") == [0]
    assert one("SELECT count(*) FROM chore_photos") == [0]
    assert one("SELECT id FROM threads") == [2]
    assert one("SELECT id FROM thread_messages") == [2]
    assert one("SELECT run_id FROM points ORDER BY id") == [None, 2]
    assert "archived_at" not in [r[1] for r in con.execute("PRAGMA table_info(chores)")]
    con.close()
    assert not photo.exists()
