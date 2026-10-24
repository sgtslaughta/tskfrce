"""user flair

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-21 19:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: str | Sequence[str] | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("users") as b:
        b.add_column(sa.Column("flair", sa.JSON(), nullable=False, server_default="{}"))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("users") as b:
        b.drop_column("flair")
