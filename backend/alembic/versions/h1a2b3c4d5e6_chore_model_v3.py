"""chore model v3: types + notes, step order/deadlines, skipped runs, deductions

Revision ID: h1a2b3c4d5e6
Revises: g9c0d1e2f3g4
Create Date: 2026-10-25 09:00:00.000000
"""

import re
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "h1a2b3c4d5e6"
down_revision: str | Sequence[str] | None = "g9c0d1e2f3g4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Copy of app.services.chore_types.SEED (migrations import nothing from app).
SEED = [
    (
        "Cleaning",
        "cleaning_services",
        ["Out of supplies", "Did part of it", "Too messy for one go"],
    ),
    ("Schoolwork", "school", ["Don't understand it", "Left it at school", "Need the computer"]),
    ("Pets", "pets", ["Out of pet food", "Pet seems sick", "Someone already did it"]),
    ("Kitchen", "restaurant", ["Out of supplies", "Dishwasher still full", "Something broke"]),
    ("Outdoor", "yard", ["Bad weather", "Too dark", "Tool is broken"]),
    ("Practice", "music_note", ["Gear is broken", "Lesson cancelled"]),
    ("Personal", "self_care", ["Don't feel well"]),
    ("Other", "task_alt", ["Did part of it"]),
]

# Ported from frontend/src/v2/today/choreIcon.ts; first match wins, else Other.
GUESS = [
    ("Kitchen", r"dish|kitchen|table|cook|lunch|dinner"),
    ("Schoolwork", r"homework|read|study|math|school|book"),
    ("Pets", r"pet|cat|dog|fish|feed"),
    ("Practice", r"piano|music|guitar|violin|practice"),
    (
        "Cleaning",
        r"bed\b|make bed|tidy|clean|room|vacuum|sweep|dust|laundry|clothes|wash|trash|garbage|recycl|bin",
    ),
    ("Personal", r"teeth|brush|shower|bath"),
    ("Outdoor", r"yard|garden|plant|water|lawn"),
]

RUN_STATUS = "status IN ('todo','submitted','done','cancelled'{})"
REASONS = "'chore','early_bonus','team_share','redemption','bonus','adjustment'"
KINDS = (
    "chore_submitted",
    "redemption_request",
    "redemption_decided",
    "device_resisting",
    "new_device",
    "badge_earned",
    "level_up",
    "chat_message",
)


def _in(col: str, vals) -> str:
    return f"{col} IN (" + ",".join(f"'{v}'" for v in vals) + ")"


def _tables() -> dict[str, int]:
    types = op.create_table(
        "chore_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(40), nullable=False),
        sa.Column("glyph", sa.String(40), nullable=False),
        sa.Column("builtin", sa.Boolean(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
    )
    notes = op.create_table(
        "chore_type_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "type_id",
            sa.Integer(),
            sa.ForeignKey("chore_types.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("label", sa.String(40), nullable=False),
        sa.Column("glyph", sa.String(40), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
    )
    ids: dict[str, int] = {}
    for i, (name, glyph, labels) in enumerate(SEED, 1):
        ids[name] = i
        op.bulk_insert(
            types, [{"id": i, "name": name, "glyph": glyph, "builtin": True, "position": i - 1}]
        )
        op.bulk_insert(
            notes,
            [
                {"type_id": i, "label": n, "glyph": glyph, "position": j}
                for j, n in enumerate(labels)
            ],
        )
    return ids


def _chores(conn, ids: dict[str, int]) -> None:
    with op.batch_alter_table("chores") as b:
        b.add_column(sa.Column("type_id", sa.Integer(), nullable=True))
    for cid, title in conn.execute(sa.text("SELECT id, title FROM chores")).all():
        name = next((n for n, rx in GUESS if re.search(rx, title, re.I)), "Other")
        conn.execute(
            sa.text("UPDATE chores SET type_id=:t WHERE id=:i"), {"t": ids[name], "i": cid}
        )
    with op.batch_alter_table("chores") as b:
        b.alter_column(
            "type_id",
            existing_type=sa.Integer(),
            nullable=False,
            server_default=sa.text(str(ids["Other"])),
        )
        b.create_foreign_key("fk_chore_type", "chore_types", ["type_id"], ["id"])
        b.create_index("ix_chores_type_id", ["type_id"])


def upgrade() -> None:
    conn = op.get_bind()
    _chores(conn, _tables())
    with op.batch_alter_table("chore_steps") as b:
        b.add_column(
            sa.Column("after_previous", sa.Boolean(), nullable=False, server_default=sa.text("0"))
        )
        b.add_column(sa.Column("due_time", sa.String(5), nullable=True))
    with op.batch_alter_table("chore_runs") as b:
        b.add_column(sa.Column("note_label", sa.String(40), nullable=True))
        b.add_column(sa.Column("note_at", sa.DateTime(), nullable=True))
        b.drop_constraint("ck_run_status", type_="check")
        b.create_check_constraint("ck_run_status", RUN_STATUS.format(",'skipped'"))
    with op.batch_alter_table("thread_messages") as b:
        b.add_column(sa.Column("step_id", sa.Integer(), nullable=True))
        b.add_column(sa.Column("note_label", sa.String(40), nullable=True))
        b.create_foreign_key(
            "fk_message_step", "chore_steps", ["step_id"], ["id"], ondelete="SET NULL"
        )
    with op.batch_alter_table("points") as b:
        b.add_column(sa.Column("by_id", sa.Integer(), nullable=True))
        b.create_foreign_key("fk_points_by", "users", ["by_id"], ["id"])
        b.drop_constraint("ck_points_reason", type_="check")
        b.create_check_constraint("ck_points_reason", f"reason IN ({REASONS},'deduction')")
    with op.batch_alter_table("notifications") as b:
        b.drop_constraint("ck_notification_kind", type_="check")
        b.create_check_constraint("ck_notification_kind", _in("kind", (*KINDS, "chore_note")))


def downgrade() -> None:
    # Rows using the new values are removed so the old CHECKs hold.
    op.execute("DELETE FROM notifications WHERE kind='chore_note'")
    op.execute("DELETE FROM points WHERE reason='deduction'")
    op.execute("UPDATE chore_runs SET status='cancelled' WHERE status='skipped'")
    with op.batch_alter_table("notifications") as b:
        b.drop_constraint("ck_notification_kind", type_="check")
        b.create_check_constraint("ck_notification_kind", _in("kind", KINDS))
    with op.batch_alter_table("points") as b:
        b.drop_constraint("ck_points_reason", type_="check")
        b.create_check_constraint("ck_points_reason", f"reason IN ({REASONS})")
        b.drop_constraint("fk_points_by", type_="foreignkey")
        b.drop_column("by_id")
    with op.batch_alter_table("thread_messages") as b:
        b.drop_constraint("fk_message_step", type_="foreignkey")
        b.drop_column("note_label")
        b.drop_column("step_id")
    with op.batch_alter_table("chore_runs") as b:
        b.drop_constraint("ck_run_status", type_="check")
        b.create_check_constraint("ck_run_status", RUN_STATUS.format(""))
        b.drop_column("note_at")
        b.drop_column("note_label")
    with op.batch_alter_table("chore_steps") as b:
        b.drop_column("due_time")
        b.drop_column("after_previous")
    with op.batch_alter_table("chores") as b:
        b.drop_index("ix_chores_type_id")
        b.drop_constraint("fk_chore_type", type_="foreignkey")
        b.drop_column("type_id")
    op.drop_table("chore_type_notes")
    op.drop_table("chore_types")
