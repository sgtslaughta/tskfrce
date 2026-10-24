"""rewards and redemptions

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-10-21 15:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: str | Sequence[str] | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "rewards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("icon", sa.String(8), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "redemptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kid_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("kind", sa.String(12), nullable=False),
        sa.Column("reward_id", sa.Integer(), sa.ForeignKey("rewards.id"), nullable=True),
        sa.Column("minutes", sa.Integer(), nullable=True),
        sa.Column("cost", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
        sa.Column("decided_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("seen_by_kid", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_redemptions_kid_id", "redemptions", ["kid_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_redemptions_kid_id", table_name="redemptions")
    op.drop_table("redemptions")
    op.drop_table("rewards")
