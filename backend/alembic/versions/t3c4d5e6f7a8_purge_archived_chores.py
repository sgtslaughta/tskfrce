"""deleting a chore deletes it: purge archived chores, drop chores.archived_at

Archived chores go the way a delete now goes: assignments, runs, ticks, proof photos (files
too) and chore chat. Points stay in the kids' balances with run_id cleared.

Revision ID: t3c4d5e6f7a8
Revises: s2b3c4d5e6f7
Create Date: 2026-10-28 18:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "t3c4d5e6f7a8"
down_revision: str | Sequence[str] | None = "s2b3c4d5e6f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

C = "SELECT id FROM chores WHERE archived_at IS NOT NULL"
A = f"SELECT id FROM chore_assignments WHERE chore_id IN ({C})"
R = f"SELECT id FROM chore_runs WHERE assignment_id IN ({A})"
T = f"SELECT id FROM threads WHERE run_id IN ({R})"
M = f"SELECT id FROM thread_messages WHERE thread_id IN ({T})"


def _unlink_photos(conn) -> None:
    from app.core.config import settings  # env.py reads it too; only the path is used here

    root = (settings.DATA_DIR / "uploads").resolve()  # = app.services.photos.storage()
    for row in conn.execute(
        sa.text(f"SELECT path, thumb_path FROM chore_photos WHERE run_id IN ({R})")
    ):
        for key in row:
            p = (root / key).resolve()
            if p.is_relative_to(root):
                p.unlink(missing_ok=True)


def upgrade() -> None:
    conn = op.get_bind()
    _unlink_photos(conn)
    # migrations run with foreign keys off: every child row goes explicitly, leaves first
    for sql in (
        f"UPDATE points SET run_id = NULL WHERE run_id IN ({R})",
        f"DELETE FROM message_reactions WHERE message_id IN ({M})",
        f"DELETE FROM notifications WHERE thread_id IN ({T}) OR run_id IN ({R})",
        f"DELETE FROM thread_messages WHERE thread_id IN ({T})",
        f"DELETE FROM thread_reads WHERE thread_id IN ({T})",
        f"DELETE FROM chat_photos WHERE thread_id IN ({T})",
        f"DELETE FROM threads WHERE id IN ({T})",
        f"UPDATE thread_messages SET proof_photo_id = NULL"
        f" WHERE proof_photo_id IN (SELECT id FROM chore_photos WHERE run_id IN ({R}))",
        f"DELETE FROM chore_photos WHERE run_id IN ({R})",
        f"DELETE FROM run_step_ticks WHERE run_id IN ({R})",
        f"DELETE FROM run_kids WHERE run_id IN ({R})",
        f"DELETE FROM chore_runs WHERE id IN ({R})",
        f"DELETE FROM assignment_kids WHERE assignment_id IN ({A})",
        f"DELETE FROM chore_seen WHERE assignment_id IN ({A})",
        f"DELETE FROM chore_assignments WHERE id IN ({A})",
        f"UPDATE thread_messages SET step_id = NULL"
        f" WHERE step_id IN (SELECT id FROM chore_steps WHERE chore_id IN ({C}))",
        f"DELETE FROM chore_steps WHERE chore_id IN ({C})",
        C.replace("SELECT id", "DELETE"),
    ):
        conn.execute(sa.text(sql))
    with op.batch_alter_table("chores") as b:
        b.drop_column("archived_at")


def downgrade() -> None:
    with op.batch_alter_table("chores") as b:
        b.add_column(sa.Column("archived_at", sa.DateTime, nullable=True))
