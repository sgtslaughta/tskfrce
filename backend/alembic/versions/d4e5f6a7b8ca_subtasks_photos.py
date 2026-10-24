"""chore subtasks and proof photos

Revision ID: d4e5f6a7b8ca
Revises: c3d4e5f6a7b9
Create Date: 2026-10-21 17:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8ca"
down_revision: str | Sequence[str] | None = "c3d4e5f6a7b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "chore_subtasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("done_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("done_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_chore_subtasks_task_id", "chore_subtasks", ["task_id"])
    op.create_table(
        "chore_photos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id"), nullable=False),
        sa.Column("attempt", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("path", sa.String(255), nullable=False),
        sa.Column("thumb_path", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_chore_photos_task_id", "chore_photos", ["task_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("chore_photos")
    op.drop_table("chore_subtasks")
