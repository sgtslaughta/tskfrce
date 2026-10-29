"""notifications inbox rebuilt relationally; points.seen_by_kid for bonus celebrations

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-10-23 09:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d0e1f2a3b4c5"
down_revision: str | Sequence[str] | None = "c9d0e1f2a3b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

KINDS = (
    "chore_submitted",
    "redemption_request",
    "redemption_decided",
    "device_resisting",
    "new_device",
    "badge_earned",
    "level_up",
    "chat_message",
)


def _fk(col: str, table: str) -> sa.Column:
    return sa.Column(col, sa.Integer(), sa.ForeignKey(f"{table}.id", ondelete="CASCADE"))


def upgrade() -> None:
    op.drop_table("notifications")  # legacy rows are dropped (spec)
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("body", sa.String(300), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        _fk("run_id", "chore_runs"),
        _fk("redemption_id", "redemptions"),
        _fk("device_id", "devices"),
        _fk("thread_id", "threads"),
        sa.CheckConstraint(
            "kind IN (" + ",".join(f"'{k}'" for k in KINDS) + ")", name="ck_notification_kind"
        ),
    )
    for col in ("user_id", "run_id", "redemption_id", "device_id", "thread_id"):
        op.create_index(f"ix_notifications_{col}", "notifications", [col])
    with op.batch_alter_table("points") as b:
        b.add_column(
            sa.Column("seen_by_kid", sa.Boolean(), nullable=False, server_default=sa.text("1"))
        )


def downgrade() -> None:
    raise NotImplementedError("forward-only")
