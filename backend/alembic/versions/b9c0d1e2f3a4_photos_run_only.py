"""chore_photos.task_id becomes optional (new photos hang off runs only)

Revision ID: b9c0d1e2f3a4
Revises: b8c9d0e1f2a3
"""

import sqlalchemy as sa
from alembic import op

revision = "b9c0d1e2f3a4"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("chore_photos") as b:
        b.alter_column("task_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    raise NotImplementedError("forward-only")
