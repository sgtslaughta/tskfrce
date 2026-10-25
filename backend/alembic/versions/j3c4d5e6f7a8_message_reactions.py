"""Add message_reactions for emoji reactions on chat messages."""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "j3c4d5e6f7a8"
down_revision: str | None = "i2b3c4d5e6f7"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "message_reactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "message_id",
            sa.Integer(),
            sa.ForeignKey("thread_messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("emoji", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("message_id", "user_id", "emoji", name="uq_message_reaction"),
    )
    op.create_index("ix_message_reactions_message_id", "message_reactions", ["message_id"])


def downgrade() -> None:
    op.drop_index("ix_message_reactions_message_id", "message_reactions")
    op.drop_table("message_reactions")
