"""Add thread_messages.edited_at for edited chat messages."""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "i2b3c4d5e6f7"
down_revision: str | None = "h1a2b3c4d5e6"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    with op.batch_alter_table("thread_messages") as b:
        b.add_column(sa.Column("edited_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("thread_messages") as b:
        b.drop_column("edited_at")
