"""Apprise notification places, held pings, quiet-hour columns."""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "l5f6a7b8c9d0"
down_revision: str | None = "k4d5e6f7a8b9"
branch_labels: str | None = None
depends_on: str | None = None

OLD_KINDS = (
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
NEW_KINDS = (*OLD_KINDS, "device_bypass", "box_offline")


def _in(kinds: tuple[str, ...]) -> str:
    return "kind IN (" + ",".join(f"'{k}'" for k in kinds) + ")"


def upgrade() -> None:
    op.create_table(
        "notify_places",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("url_enc", sa.Text(), nullable=False),
        sa.Column("url_mask", sa.String(80), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("events", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "notify_held",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "place_id",
            sa.Integer(),
            sa.ForeignKey("notify_places.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("body", sa.String(300), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_notify_held_place_id", "notify_held", ["place_id"])
    with op.batch_alter_table("family_settings") as b:
        b.add_column(sa.Column("quiet_start", sa.String(5), nullable=True))
        b.add_column(sa.Column("quiet_end", sa.String(5), nullable=True))
        b.add_column(sa.Column("quiet_security", sa.Boolean(), nullable=False, server_default="1"))
        b.add_column(sa.Column("app_address", sa.String(200), nullable=True))
        b.add_column(sa.Column("summary_date", sa.Date(), nullable=True))
        b.add_column(sa.Column("notify_scan_at", sa.DateTime(), nullable=True))
        b.add_column(sa.Column("blocker_alerted", sa.Boolean(), nullable=False, server_default="0"))
    with op.batch_alter_table("notifications") as b:
        b.drop_constraint("ck_notification_kind", type_="check")
        b.create_check_constraint("ck_notification_kind", _in(NEW_KINDS))


def downgrade() -> None:
    op.execute("DELETE FROM notifications WHERE kind IN ('device_bypass','box_offline')")
    with op.batch_alter_table("notifications") as b:
        b.drop_constraint("ck_notification_kind", type_="check")
        b.create_check_constraint("ck_notification_kind", _in(OLD_KINDS))
    with op.batch_alter_table("family_settings") as b:
        for c in (
            "blocker_alerted",
            "notify_scan_at",
            "summary_date",
            "app_address",
            "quiet_security",
            "quiet_end",
            "quiet_start",
        ):
            b.drop_column(c)
    op.drop_index("ix_notify_held_place_id", table_name="notify_held")
    op.drop_table("notify_held")
    op.drop_table("notify_places")
