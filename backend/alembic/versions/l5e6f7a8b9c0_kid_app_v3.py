"""kid app v3: age group, push topic, relay flag, seen tracking, alert kinds, dedup

Revision ID: l5e6f7a8b9c0
Revises: k4d5e6f7a8b9
Create Date: 2026-10-26 09:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "l5e6f7a8b9c0"
down_revision: str | Sequence[str] | None = "k4d5e6f7a8b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD = (
    "chore_submitted",
    "redemption_request",
    "redemption_decided",
    "device_resisting",
    "new_device",
    "badge_earned",
    "level_up",
    "chat_message",
    "chore_note",
)
ADDED = (
    "chore_new",
    "due_soon",
    "missed_deadline",
    "chore_approved",
    "chore_sent_back",
    "points_taken",
    "lock_warning",
)


def _in(col: str, vals) -> str:
    return f"{col} IN (" + ",".join(f"'{v}'" for v in vals) + ")"


def upgrade() -> None:
    with op.batch_alter_table("users") as b:
        b.add_column(sa.Column("age_group", sa.String(6), nullable=False, server_default="kid"))
        b.add_column(sa.Column("push_topic", sa.String(40), nullable=True))
        b.create_check_constraint("ck_user_age_group", _in("age_group", ("little", "kid", "teen")))
        b.create_unique_constraint("uq_user_push_topic", ["push_topic"])
    with op.batch_alter_table("family_settings") as b:
        b.add_column(
            sa.Column("ntfy_upstream_relay", sa.Boolean(), nullable=False, server_default="0")
        )
    with op.batch_alter_table("notifications") as b:
        b.add_column(sa.Column("dedup_key", sa.String(60), nullable=True))
        b.create_unique_constraint("uq_notification_dedup", ["user_id", "dedup_key"])
        b.drop_constraint("ck_notification_kind", type_="check")
        b.create_check_constraint("ck_notification_kind", _in("kind", (*OLD, *ADDED)))
    op.create_table(
        "chore_seen",
        sa.Column(
            "assignment_id",
            sa.Integer(),
            sa.ForeignKey("chore_assignments.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "kid_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("seen_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("chore_seen")
    op.execute("DELETE FROM notifications WHERE " + _in("kind", ADDED))
    with op.batch_alter_table("notifications") as b:
        b.drop_constraint("ck_notification_kind", type_="check")
        b.create_check_constraint("ck_notification_kind", _in("kind", OLD))
        b.drop_constraint("uq_notification_dedup", type_="unique")
        b.drop_column("dedup_key")
    with op.batch_alter_table("family_settings") as b:
        b.drop_column("ntfy_upstream_relay")
    with op.batch_alter_table("users") as b:
        b.drop_constraint("uq_user_push_topic", type_="unique")
        b.drop_constraint("ck_user_age_group", type_="check")
        b.drop_column("push_topic")
        b.drop_column("age_group")
