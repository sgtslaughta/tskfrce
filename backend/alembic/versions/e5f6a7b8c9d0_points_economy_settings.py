"""points economy settings

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-21 14:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: str | Sequence[str] | None = "d4e5f6a7b8c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "family_settings",
        sa.Column("early_bonus_cap", sa.Integer(), nullable=False, server_default="5"),
    )
    op.add_column(
        "family_settings",
        sa.Column("screen_time_price", sa.Integer(), nullable=False, server_default="20"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("family_settings") as batch:
        batch.drop_column("screen_time_price")
        batch.drop_column("early_bonus_cap")
