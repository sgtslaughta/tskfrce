"""polish 3: users.last_active_at for the Parents list

Revision ID: s2b3c4d5e6f7
Revises: r3b2c3d4e5f6
Create Date: 2026-10-27 15:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "s2b3c4d5e6f7"
down_revision: str | Sequence[str] | None = "r3b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as b:
        b.add_column(sa.Column("last_active_at", sa.DateTime, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users") as b:
        b.drop_column("last_active_at")
