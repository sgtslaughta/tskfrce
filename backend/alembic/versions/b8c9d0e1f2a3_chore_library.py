"""chore library: chores, steps, assignments, runs; data copied from tasks

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-10-22 12:00:00.000000

Old `tasks` rows and columns stay in place (dropped by a later revision).
"""

import json
from collections import defaultdict
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b8c9d0e1f2a3"
down_revision: str | Sequence[str] | None = "a7b8c9d0e1f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATUS = {
    "TODO": "todo",
    "ASSIGNED": "todo",
    "IN_PROGRESS": "todo",
    "SUBMITTED_FOR_APPROVAL": "submitted",
    "REVIEW": "submitted",
    "DONE": "done",
    "CANCELLED": "cancelled",
}
RANK = {"done": 3, "submitted": 2, "todo": 1, "cancelled": 0}


def _create_tables() -> None:
    op.create_table(
        "chores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("needs_photo", sa.Boolean(), nullable=False),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("archived_at", sa.DateTime()),
        sa.CheckConstraint("points >= 0", name="ck_chore_points"),
    )
    op.create_table(
        "chore_steps",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "chore_id", sa.Integer(), sa.ForeignKey("chores.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(100), nullable=False),
        sa.UniqueConstraint("chore_id", "position", name="uq_chore_step_pos"),
    )
    op.create_table(
        "chore_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("chore_id", sa.Integer(), sa.ForeignKey("chores.id"), nullable=False),
        sa.Column("mode", sa.String(4), nullable=False),
        sa.Column("repeat", sa.String(6), nullable=False),
        sa.Column("days", sa.String(7)),
        sa.Column("on_date", sa.Date()),
        sa.Column("due_time", sa.String(5)),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime()),
        sa.CheckConstraint("mode IN ('each','race','team')", name="ck_assignment_mode"),
        sa.CheckConstraint("repeat IN ('daily','weekly','once')", name="ck_assignment_repeat"),
        sa.CheckConstraint("repeat != 'weekly' OR days IS NOT NULL", name="ck_assignment_days"),
        sa.CheckConstraint("repeat != 'once' OR on_date IS NOT NULL", name="ck_assignment_on_date"),
    )
    op.create_index("ix_chore_assignments_chore_id", "chore_assignments", ["chore_id"])
    op.create_table(
        "assignment_kids",
        sa.Column(
            "assignment_id",
            sa.Integer(),
            sa.ForeignKey("chore_assignments.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "kid_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
    )
    op.create_table(
        "chore_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "assignment_id", sa.Integer(), sa.ForeignKey("chore_assignments.id"), nullable=False
        ),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("kid_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("attempt", sa.Integer(), nullable=False),
        sa.Column("last_note", sa.String(500)),
        sa.Column("submitted_at", sa.DateTime()),
        sa.Column("submitted_by_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("approved_at", sa.DateTime()),
        sa.Column("approved_by_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("completed_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime()),
        sa.CheckConstraint(
            "status IN ('todo','submitted','done','cancelled')", name="ck_run_status"
        ),
    )
    for col in ("assignment_id", "day", "kid_id", "status"):
        op.create_index(f"ix_chore_runs_{col}", "chore_runs", [col])
    op.create_index(
        "uq_run_kid_day",
        "chore_runs",
        ["assignment_id", "day", "kid_id"],
        unique=True,
        sqlite_where=sa.text("kid_id IS NOT NULL"),
    )
    op.create_index(
        "uq_run_shared_day",
        "chore_runs",
        ["assignment_id", "day"],
        unique=True,
        sqlite_where=sa.text("kid_id IS NULL"),
    )
    op.create_table(
        "run_kids",
        sa.Column(
            "run_id",
            sa.Integer(),
            sa.ForeignKey("chore_runs.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "kid_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
    )
    op.create_table(
        "run_step_ticks",
        sa.Column(
            "run_id",
            sa.Integer(),
            sa.ForeignKey("chore_runs.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "step_id",
            sa.Integer(),
            sa.ForeignKey("chore_steps.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("done_by_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("done_at", sa.DateTime()),
    )


def _add_columns() -> None:
    with op.batch_alter_table("chore_photos") as b:
        b.add_column(sa.Column("run_id", sa.Integer(), nullable=True))
        b.create_foreign_key("fk_chore_photos_run", "chore_runs", ["run_id"], ["id"])
        b.create_index("ix_chore_photos_run_id", ["run_id"])
    with op.batch_alter_table("threads") as b:
        b.add_column(sa.Column("run_id", sa.Integer(), nullable=True))
        b.create_foreign_key("fk_threads_run", "chore_runs", ["run_id"], ["id"])
        b.create_index("ix_threads_run_id", ["run_id"])
    with op.batch_alter_table("points") as b:
        b.add_column(sa.Column("run_id", sa.Integer(), nullable=True))
        b.add_column(sa.Column("redemption_id", sa.Integer(), nullable=True))
        b.create_foreign_key("fk_points_run", "chore_runs", ["run_id"], ["id"])
        b.create_foreign_key("fk_points_redemption", "redemptions", ["redemption_id"], ["id"])
        b.create_index("ix_points_run_id", ["run_id"])
        b.create_index("ix_points_redemption_id", ["redemption_id"])
        b.create_check_constraint("ck_points_one_ref", "run_id IS NULL OR redemption_id IS NULL")


def _pattern(raw) -> dict:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            return {}
    return raw if isinstance(raw, dict) else {}


def _days(p: dict) -> str | None:
    if p.get("type") != "weekly":
        return None
    return "".join(
        str(d) for d in sorted({int(d) for d in p.get("days") or [] if 0 <= int(d) <= 6})
    )


def _migrate_data(conn: sa.Connection) -> None:
    users = {r[0]: r[1] for r in conn.execute(sa.text("SELECT id, role FROM users"))}
    kid_ids = {i for i, role in users.items() if str(role).upper() == "KID"}
    fallback_user = min(users) if users else None

    def uid(v):
        return v if v in users else None

    tasks = [
        dict(r._mapping)
        for r in conn.execute(sa.text("SELECT * FROM tasks ORDER BY id"))
        if _pattern(r._mapping["recurrence_pattern"]).get("chore")
    ]
    for t in tasks:
        t["p"] = _pattern(t["recurrence_pattern"])
    parents = {t["parent_task_id"] for t in tasks if t["parent_task_id"] is not None}
    defs = [t for t in tasks if t["is_recurring"] or t["id"] in parents]
    def_ids = {t["id"] for t in defs}
    instances = [t for t in tasks if t["id"] not in def_ids]
    participants = defaultdict(list)
    for tid, kid in conn.execute(sa.text("SELECT task_id, kid_id FROM chore_participants")):
        participants[tid].append(kid)

    ins_chore = sa.text(
        "INSERT INTO chores (title, points, needs_photo, created_by_id, created_at, updated_at,"
        " archived_at) VALUES (:title, :points, :np, :by, :ca, :ua, :ar)"
    )
    ins_step = sa.text(
        "INSERT INTO chore_steps (chore_id, position, title) VALUES (:c, :pos, :title)"
    )
    ins_asg = sa.text(
        "INSERT INTO chore_assignments (chore_id, mode, repeat, days, on_date, due_time, active,"
        " created_at) VALUES (:c, :mode, :repeat, :days, :on_date, :due, :active, :ca)"
    )
    ins_ak = sa.text("INSERT INTO assignment_kids (assignment_id, kid_id) VALUES (:a, :k)")

    steps_of: dict[int, list[tuple[int, str]]] = {}  # chore id -> [(step id, title)]
    asg_of_task: dict[int, int] = {}  # definition task id -> assignment id

    def make_chore(t, kids, repeat, on_date, active, archived):
        p = t["p"]
        by = uid(t["created_by_id"]) or fallback_user
        cid = conn.execute(
            ins_chore,
            {
                "title": (t["title"] or "Chore")[:100],
                "points": max(t["points"] or 0, 0),
                "np": bool(p.get("needs_photo")),
                "by": by,
                "ca": t["created_at"],
                "ua": t["updated_at"] or t["created_at"],
                "ar": archived,
            },
        ).lastrowid
        steps_of[cid] = []
        for pos, title in enumerate(p.get("subtasks") or []):
            sid = conn.execute(
                ins_step, {"c": cid, "pos": pos, "title": str(title)[:100]}
            ).lastrowid
            steps_of[cid].append((sid, str(title)))
        mode = p.get("mode", "each")
        if mode not in ("each", "race", "team") or len(kids) <= 1:
            mode = "each"
        aid = conn.execute(
            ins_asg,
            {
                "c": cid,
                "mode": mode,
                "repeat": repeat,
                "days": _days(p) if repeat == "weekly" else None,
                "on_date": on_date,
                "due": p.get("due_time"),
                "active": active,
                "ca": t["created_at"],
            },
        ).lastrowid
        for k in kids:
            conn.execute(ins_ak, {"a": aid, "k": k})
        return cid, aid

    def kids_of(t):
        ids = t["p"].get("assignees") or [t["assigned_to_id"]]
        return [k for k in dict.fromkeys(ids) if k in kid_ids]

    for d in defs:
        deleted = not d["is_recurring"]
        repeat = d["p"].get("type") if d["p"].get("type") in ("daily", "weekly") else "daily"
        cid, aid = make_chore(
            d,
            kids_of(d),
            repeat,
            None,
            not deleted,
            (d["updated_at"] or d["created_at"]) if deleted else None,
        )
        asg_of_task[d["id"]] = aid

    # one-time instances: one chore + once assignment per group
    groups: dict[tuple, int] = {}
    for t in instances:
        if t["parent_task_id"] in asg_of_task:
            continue
        key = (
            t["title"],
            str(t["created_at"])[:10],
            t["points"],
            json.dumps(t["p"], sort_keys=True),
        )
        if key not in groups:
            kids = kids_of(t) or ([t["assigned_to_id"]] if t["assigned_to_id"] in kid_ids else [])
            kids = list(
                dict.fromkeys(kids + [k for k in participants.get(t["id"], []) if k in kid_ids])
            )
            day = str(t["due_date"] or t["created_at"])[:10]
            _, groups[key] = make_chore(t, kids, "once", day, False, None)
        asg_of_task[t["id"]] = groups[key]

    # runs: best status wins when legacy data has duplicates for one assignment/day/kid
    run_of: dict[int, int] = {}
    seen: dict[tuple, int] = {}
    ordered = sorted(
        instances,
        key=lambda t: (-RANK[STATUS.get(str(t["status"]).upper(), "todo")], t["id"]),
    )
    ins_run = sa.text(
        "INSERT INTO chore_runs (assignment_id, day, kid_id, status, attempt, last_note,"
        " submitted_at, submitted_by_id, approved_at, approved_by_id, completed_at, created_at)"
        " VALUES (:a, :day, :kid, :st, :att, :note, :sat, :sby, :aat, :aby, :cat, :ca)"
    )
    for t in ordered:
        aid = asg_of_task.get(
            t["parent_task_id"] if t["parent_task_id"] in asg_of_task else t["id"]
        )
        if aid is None:
            continue
        kid = t["assigned_to_id"]
        shared = kid is None
        if not shared and kid not in kid_ids:
            continue
        day = str(t["due_date"] or t["created_at"])[:10]
        key = (aid, day, kid)
        if key in seen:
            run_of[t["id"]] = seen[key]
            continue
        rid = conn.execute(
            ins_run,
            {
                "a": aid,
                "day": day,
                "kid": kid,
                "st": STATUS.get(str(t["status"]).upper(), "todo"),
                "att": t["attempt"] or 1,
                "note": t["last_note"],
                "sat": t["submitted_for_approval_at"],
                "sby": uid(t["submitted_by_id"]),
                "aat": t["approved_at"],
                "aby": uid(t["approved_by_id"]),
                "cat": t["completed_at"],
                "ca": t["created_at"],
            },
        ).lastrowid
        seen[key] = run_of[t["id"]] = rid
        if shared:
            for k in dict.fromkeys(participants.get(t["id"], [])):
                if k in kid_ids:
                    conn.execute(
                        sa.text("INSERT INTO run_kids (run_id, kid_id) VALUES (:r, :k)"),
                        {"r": rid, "k": k},
                    )

    # step ticks: match the chore's step by title, else by position
    chore_of_run = dict(
        conn.execute(
            sa.text(
                "SELECT r.id, a.chore_id FROM chore_runs r JOIN chore_assignments a ON a.id=r.assignment_id"
            )
        ).all()
    )
    ticked: set[tuple[int, int]] = set()
    for sid, tid, pos, title, by, at in conn.execute(
        sa.text(
            "SELECT id, task_id, position, title, done_by_id, done_at FROM chore_subtasks"
            " WHERE done_at IS NOT NULL ORDER BY id"
        )
    ).all():
        rid = run_of.get(tid)
        steps = steps_of.get(chore_of_run.get(rid), [])
        step = next((s for s, st in steps if st == title), None)
        if step is None and 0 <= pos < len(steps):
            step = steps[pos][0]
        if step is None or (rid, step) in ticked:
            continue
        ticked.add((rid, step))
        conn.execute(
            sa.text(
                "INSERT INTO run_step_ticks (run_id, step_id, done_by_id, done_at)"
                " VALUES (:r, :s, :by, :at)"
            ),
            {"r": rid, "s": step, "by": uid(by), "at": at},
        )

    for table in ("chore_photos", "threads"):
        where = " AND kind='chore'" if table == "threads" else ""
        for rid_old, tid in conn.execute(
            sa.text(f"SELECT id, task_id FROM {table} WHERE task_id IS NOT NULL{where}")
        ).all():
            if tid in run_of:
                conn.execute(
                    sa.text(f"UPDATE {table} SET run_id=:r WHERE id=:i"),
                    {"r": run_of[tid], "i": rid_old},
                )
    for pid, ref_type, ref_id in conn.execute(
        sa.text(
            "SELECT id, reference_type, reference_id FROM points WHERE reference_id IS NOT NULL"
        )
    ).all():
        if ref_type in ("task", "task_bonus") and ref_id in run_of:
            conn.execute(
                sa.text("UPDATE points SET run_id=:r WHERE id=:i"), {"r": run_of[ref_id], "i": pid}
            )
        elif ref_type == "redemption":
            ok = conn.execute(
                sa.text("SELECT 1 FROM redemptions WHERE id=:i"), {"i": ref_id}
            ).first()
            if ok:
                conn.execute(
                    sa.text("UPDATE points SET redemption_id=:r WHERE id=:i"),
                    {"r": ref_id, "i": pid},
                )


def upgrade() -> None:
    """Upgrade schema and copy chore data."""
    _create_tables()
    _add_columns()
    _migrate_data(op.get_bind())


def downgrade() -> None:
    raise NotImplementedError("forward-only")
