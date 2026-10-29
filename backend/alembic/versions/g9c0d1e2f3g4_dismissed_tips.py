"""Add dismissed_tips table for tip tracking."""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "g9c0d1e2f3g4"
down_revision: str | None = "f8b9c0d1e2f3"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Create dismissed_tips table."""
    op.create_table(
        "dismissed_tips",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("tip_key", sa.String(64), nullable=False),
        sa.Column("dismissed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "tip_key", name="uq_dismissed_tips_user_key"),
    )
    op.create_index("ix_dismissed_tips_user_id", "dismissed_tips", ["user_id"])


def downgrade() -> None:
    """Drop dismissed_tips table."""
    op.drop_index("ix_dismissed_tips_user_id", table_name="dismissed_tips")
    op.drop_table("dismissed_tips")
