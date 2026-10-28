"""polish 3: screen-time requests name the device the kid asked about

Revision ID: s1a2b3c4d5e6
Revises: r3b2c3d4e5f6
Create Date: 2026-10-27 13:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "s1a2b3c4d5e6"
down_revision: str | Sequence[str] | None = "r3b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("redemptions") as b:
        b.add_column(sa.Column("device_id", sa.Integer, nullable=True))
        b.create_foreign_key(
            "fk_redemptions_device", "devices", ["device_id"], ["id"], ondelete="SET NULL"
        )


def downgrade() -> None:
    with op.batch_alter_table("redemptions") as b:
        b.drop_constraint("fk_redemptions_device", type_="foreignkey")
        b.drop_column("device_id")
