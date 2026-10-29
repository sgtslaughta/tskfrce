"""polish 2: pending parent invites, setup wizard step

Revision ID: q2a1b2c3d4e5
Revises: p5e1a2b3c4d5
Create Date: 2026-10-27 09:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "q2a1b2c3d4e5"
down_revision: str | Sequence[str] | None = "p5e1a2b3c4d5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pending_invites",
        sa.Column("jti", sa.String(64), primary_key=True),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column(
            "invited_by", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=False),
    )
    with op.batch_alter_table("family_settings") as b:
        b.add_column(sa.Column("setup_step", sa.Integer, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("family_settings") as b:
        b.drop_column("setup_step")
    op.drop_table("pending_invites")
