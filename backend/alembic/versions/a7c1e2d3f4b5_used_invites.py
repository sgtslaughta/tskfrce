"""used invites

Revision ID: a7c1e2d3f4b5
Revises: fb864d5a6b5e
Create Date: 2026-10-20 19:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a7c1e2d3f4b5"
down_revision: str | Sequence[str] | None = "fb864d5a6b5e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "used_invites",
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("jti"),
    )


def downgrade() -> None:
    op.drop_table("used_invites")
