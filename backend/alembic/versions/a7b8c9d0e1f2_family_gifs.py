"""family gif settings

Revision ID: a7b8c9d0e1f2
Revises: e6f7a8b9c0d1
Create Date: 2026-10-22 09:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7b8c9d0e1f2"
down_revision: str | Sequence[str] | None = "e6f7a8b9c0d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("family_settings") as batch:
        batch.add_column(
            sa.Column("gifs_enabled", sa.Boolean(), nullable=False, server_default="0")
        )
        batch.add_column(sa.Column("giphy_api_key", sa.String(100), nullable=True))
        batch.add_column(sa.Column("gif_rating", sa.String(2), nullable=False, server_default="g"))
        batch.create_check_constraint("ck_family_gif_rating", "gif_rating IN ('g','pg')")


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("family_settings") as batch:
        batch.drop_constraint("ck_family_gif_rating", type_="check")
        batch.drop_column("gif_rating")
        batch.drop_column("giphy_api_key")
        batch.drop_column("gifs_enabled")
