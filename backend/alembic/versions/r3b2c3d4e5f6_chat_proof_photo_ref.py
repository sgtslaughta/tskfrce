"""polish 2: chat replies can reference a chore proof photo

Revision ID: r3b2c3d4e5f6
Revises: q2a1b2c3d4e5
Create Date: 2026-10-27 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "r3b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "q2a1b2c3d4e5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("thread_messages") as b:
        b.add_column(sa.Column("proof_photo_id", sa.Integer, nullable=True))
        b.create_foreign_key(
            "fk_thread_messages_proof_photo",
            "chore_photos",
            ["proof_photo_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("thread_messages") as b:
        b.drop_constraint("fk_thread_messages_proof_photo", type_="foreignkey")
        b.drop_column("proof_photo_id")
