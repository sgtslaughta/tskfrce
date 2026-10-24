"""device resisting_since

Revision ID: c3d4e5f6a7b8
Revises: a7c1e2d3f4b5
Create Date: 2026-10-21 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: str | Sequence[str] | None = "a7c1e2d3f4b5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("devices", sa.Column("resisting_since", sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("devices") as batch:
        batch.drop_column("resisting_since")
