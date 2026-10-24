"""badges and celebrations

Revision ID: a1b2c3d4e5f6
Revises: d4e5f6a7b8ca
Create Date: 2026-10-21 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "d4e5f6a7b8ca"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "custom_badges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("icon", sa.String(8), nullable=False),
        sa.Column("description", sa.String(200), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "badge_awards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kid_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("badge_key", sa.String(40), nullable=False),
        sa.Column("tier", sa.Integer(), nullable=False),
        sa.Column("earned_at", sa.DateTime(), nullable=True),
        sa.Column("seen_by_kid", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("kid_id", "badge_key", name="uq_badge_award_kid_key"),
    )
    op.create_index("ix_badge_awards_kid_id", "badge_awards", ["kid_id"])
    with op.batch_alter_table("users") as b:
        b.add_column(
            sa.Column("celebrated_level", sa.Integer(), nullable=False, server_default="1")
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("users") as b:
        b.drop_column("celebrated_level")
    op.drop_table("badge_awards")
    op.drop_table("custom_badges")
