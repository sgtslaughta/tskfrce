"""chat threads

Revision ID: e6f7a8b9c0d1
Revises: b2c3d4e5f6a7
Create Date: 2026-10-21 20:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e6f7a8b9c0d1"
down_revision: str | Sequence[str] | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "threads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id"), nullable=True),
        sa.Column("kid_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_threads_kind", "threads", ["kind"])
    op.create_index("ix_threads_task_id", "threads", ["task_id"])
    op.create_index("ix_threads_kid_id", "threads", ["kid_id"])
    op.create_table(
        "thread_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("thread_id", sa.Integer(), sa.ForeignKey("threads.id"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("photo_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_thread_messages_thread_id", "thread_messages", ["thread_id"])
    op.create_table(
        "thread_reads",
        sa.Column("thread_id", sa.Integer(), sa.ForeignKey("threads.id"), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("last_read_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "chat_photos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("thread_id", sa.Integer(), sa.ForeignKey("threads.id"), nullable=False),
        sa.Column("uploaded_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("path", sa.String(255), nullable=False),
        sa.Column("thumb_path", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_chat_photos_thread_id", "chat_photos", ["thread_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("chat_photos")
    op.drop_table("thread_reads")
    op.drop_table("thread_messages")
    op.drop_table("threads")
