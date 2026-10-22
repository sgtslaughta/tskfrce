"""integrity: badge FK, kid_flair, device_ipv6, ledger reason, CHECKs on free text

Revision ID: c9d0e1f2a3b4
Revises: b9c0d1e2f3a4
Create Date: 2026-10-22 18:00:00.000000
"""

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c9d0e1f2a3b4"
down_revision: str | Sequence[str] | None = "b9c0d1e2f3a4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SLOTS = ("card", "ring", "name", "emblem", "title")
REASONS = "'chore','early_bonus','team_share','redemption','bonus','adjustment'"


def _badges(conn) -> None:
    with op.batch_alter_table("badge_awards") as b:
        b.alter_column("badge_key", existing_type=sa.String(40), nullable=True)
        b.add_column(sa.Column("custom_badge_id", sa.Integer(), nullable=True))
        b.create_foreign_key("fk_badge_award_custom", "custom_badges", ["custom_badge_id"], ["id"])
    for aid, key in conn.execute(
        sa.text("SELECT id, badge_key FROM badge_awards WHERE badge_key LIKE 'custom:%'")
    ).all():
        cid = int(key[7:])
        ok = conn.execute(sa.text("SELECT 1 FROM custom_badges WHERE id=:i"), {"i": cid}).first()
        if ok:
            conn.execute(
                sa.text("UPDATE badge_awards SET custom_badge_id=:c, badge_key=NULL WHERE id=:a"),
                {"c": cid, "a": aid},
            )
        else:
            conn.execute(sa.text("DELETE FROM badge_awards WHERE id=:a"), {"a": aid})
    with op.batch_alter_table("badge_awards") as b:
        b.create_unique_constraint("uq_badge_award_kid_custom", ["kid_id", "custom_badge_id"])
        b.create_check_constraint(
            "ck_badge_award_one_badge", "(badge_key IS NULL) != (custom_badge_id IS NULL)"
        )


def _flair(conn) -> None:
    op.create_table(
        "kid_flair",
        sa.Column("kid_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("slot", sa.String(10)),
        sa.Column("item_id", sa.String(40), nullable=False),
        sa.PrimaryKeyConstraint("kid_id", "slot"),
        sa.CheckConstraint("slot IN ('card','ring','name','emblem','title')", name="ck_flair_slot"),
    )
    for uid, raw in conn.execute(sa.text("SELECT id, flair FROM users")).all():
        try:
            saved = json.loads(raw) if isinstance(raw, str) else (raw or {})
        except ValueError:
            saved = {}
        for slot, item in (saved if isinstance(saved, dict) else {}).items():
            if slot in SLOTS and isinstance(item, str) and item:
                conn.execute(
                    sa.text("INSERT INTO kid_flair (kid_id, slot, item_id) VALUES (:k, :s, :i)"),
                    {"k": uid, "s": slot, "i": item[:40]},
                )
    with op.batch_alter_table("users") as b:
        b.drop_column("flair")


def _ipv6(conn) -> None:
    op.create_table(
        "device_ipv6",
        sa.Column("device_id", sa.Integer(), sa.ForeignKey("devices.id", ondelete="CASCADE")),
        sa.Column("address", sa.String(45)),
        sa.PrimaryKeyConstraint("device_id", "address"),
    )
    for did, raw in conn.execute(sa.text("SELECT id, ipv6 FROM devices")).all():
        try:
            addrs = json.loads(raw) if isinstance(raw, str) else (raw or [])
        except ValueError:
            addrs = []
        for a in dict.fromkeys(a for a in addrs if isinstance(a, str) and a):
            conn.execute(
                sa.text("INSERT INTO device_ipv6 (device_id, address) VALUES (:d, :a)"),
                {"d": did, "a": a[:45]},
            )
    with op.batch_alter_table("devices") as b:
        b.drop_column("ipv6")


def _points(conn) -> None:
    with op.batch_alter_table("points") as b:
        b.add_column(
            sa.Column("reason", sa.String(12), nullable=False, server_default="adjustment")
        )
    conn.execute(
        sa.text(
            "UPDATE points SET reason = CASE"
            " WHEN points_type = 'TASK_COMPLETION' THEN 'chore'"
            " WHEN points_type = 'REDEMPTION' THEN 'redemption'"
            " WHEN points_type = 'BONUS' AND description LIKE 'Early bonus%' THEN 'early_bonus'"
            " WHEN points_type = 'BONUS' THEN 'bonus'"
            " ELSE 'adjustment' END"
        )
    )
    with op.batch_alter_table("points") as b:
        b.drop_column("reference_id")
        b.drop_column("reference_type")
        b.create_check_constraint("ck_points_reason", f"reason IN ({REASONS})")


def _checks(conn) -> None:
    # threads that no longer point at anything can't satisfy the kind/ref rule
    bad = "SELECT id FROM threads WHERE NOT ((kind='chore' AND run_id IS NOT NULL) OR (kind='private' AND kid_id IS NOT NULL) OR kind='family')"
    for t in ("thread_messages", "thread_reads", "chat_photos"):
        conn.execute(sa.text(f"DELETE FROM {t} WHERE thread_id IN ({bad})"))
    conn.execute(sa.text(f"DELETE FROM threads WHERE id IN ({bad})"))
    with op.batch_alter_table("threads") as b:
        b.create_check_constraint(
            "ck_thread_kind",
            "(kind = 'chore' AND run_id IS NOT NULL) OR (kind = 'private' AND kid_id IS NOT NULL)"
            " OR kind = 'family'",
        )
    with op.batch_alter_table("thread_messages") as b:
        b.create_check_constraint("ck_message_kind", "kind IN ('user','system')")
    with op.batch_alter_table("redemptions") as b:
        b.create_check_constraint("ck_redemption_kind", "kind IN ('screen_time','reward')")
        b.create_check_constraint(
            "ck_redemption_status", "status IN ('pending','approved','denied')"
        )
        b.create_check_constraint(
            "ck_redemption_reward", "(kind = 'reward') = (reward_id IS NOT NULL)"
        )
        b.create_check_constraint(
            "ck_redemption_minutes", "(kind = 'screen_time') = (minutes IS NOT NULL)"
        )


def upgrade() -> None:
    conn = op.get_bind()
    _badges(conn)
    _flair(conn)
    _ipv6(conn)
    _points(conn)
    _checks(conn)


def downgrade() -> None:
    raise NotImplementedError("forward-only")
