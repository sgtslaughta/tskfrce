"""chore sharing: participants, submitted_by, attempt, last_note

Revision ID: c3d4e5f6a7b9
Revises: f6a7b8c9d0e1
Create Date: 2026-10-21 16:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b9"
down_revision: str | Sequence[str] | None = "f6a7b8c9d0e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "chore_participants",
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id"), primary_key=True),
        sa.Column("kid_id", sa.Integer(), sa.ForeignKey("users.id"), primary_key=True),
    )
    with op.batch_alter_table("tasks") as batch:
        batch.add_column(sa.Column("submitted_by_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("attempt", sa.Integer(), nullable=False, server_default="1"))
        batch.add_column(sa.Column("last_note", sa.String(500), nullable=True))
        batch.create_foreign_key("fk_tasks_submitted_by", "users", ["submitted_by_id"], ["id"])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("tasks") as batch:
        batch.drop_constraint("fk_tasks_submitted_by", type_="foreignkey")
        batch.drop_column("last_note")
        batch.drop_column("attempt")
        batch.drop_column("submitted_by_id")
    op.drop_table("chore_participants")
