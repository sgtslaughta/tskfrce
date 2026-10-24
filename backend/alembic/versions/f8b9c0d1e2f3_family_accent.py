"""family accent

Revision ID: f8b9c0d1e2f3
Revises: f7a8b9c0d1e2
Create Date: 2026-10-24 09:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f8b9c0d1e2f3"
down_revision: str | Sequence[str] | None = "f7a8b9c0d1e2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("family_settings") as batch:
        batch.add_column(
            sa.Column("accent", sa.String(length=12), nullable=False, server_default="neon")
        )
        batch.create_check_constraint(
            "ck_family_accent",
            "accent IN ('neon','sun','tangerine','bubblegum','lilac','sky','aqua','mint','peach','ice')",
        )


def downgrade() -> None:
    with op.batch_alter_table("family_settings") as batch:
        batch.drop_constraint("ck_family_accent")
        batch.drop_column("accent")
