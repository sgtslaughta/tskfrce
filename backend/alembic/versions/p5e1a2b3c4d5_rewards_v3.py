"""rewards v3: glyph icons, hidden/auto rewards, screen-time limits, award notes

Revision ID: p5e1a2b3c4d5
Revises: l5f6a7b8c9d0
Create Date: 2026-10-26 12:00:00.000000
"""

import re
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "p5e1a2b3c4d5"
down_revision: str | Sequence[str] | None = "l5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

GLYPH = re.compile(r"^[a-z0-9_]+$")
EMOJI_TO_GLYPH = {
    **dict.fromkeys("🎬🍿", "movie"),
    **dict.fromkeys("🍦🍨", "icecream"),
    **dict.fromkeys("🛏😴🌙", "bedtime"),
    "🍕": "local_pizza",
    **dict.fromkeys("🍔🍽", "restaurant"),
    **dict.fromkeys("🎮🕹", "sports_esports"),
    **dict.fromkeys("🌳🏞", "park"),
    **dict.fromkeys("🎂🍰", "cake"),
    "🧸": "toys",
    **dict.fromkeys("⏰⏱📱", "timer"),
    **dict.fromkeys("💵💰", "payments"),
    "📚": "menu_book",
    "🎁": "redeem",
    "🛍": "shopping_bag",
    "⚽": "sports_soccer",
    "🎨": "palette",
    "🎵": "music_note",
    "🏊": "pool",
    "🚲": "pedal_bike",
    **dict.fromkeys("🍪🍬🍭", "cookie"),
    "🎉": "celebration",
    "⭐": "star",
}


def _fix_icons() -> None:
    bind = op.get_bind()
    for rid, icon in bind.execute(sa.text("SELECT id, icon FROM rewards")).fetchall():
        if icon is None:
            continue
        clean = icon.replace("️", "")
        new = clean if GLYPH.match(clean) else EMOJI_TO_GLYPH.get(clean, "redeem")
        if new != icon:
            bind.execute(sa.text("UPDATE rewards SET icon=:i WHERE id=:r"), {"i": new, "r": rid})
    for bid, icon in bind.execute(sa.text("SELECT id, icon FROM custom_badges")).fetchall():
        if not GLYPH.match(icon):
            bind.execute(
                sa.text("UPDATE custom_badges SET icon='military_tech' WHERE id=:b"), {"b": bid}
            )


def upgrade() -> None:
    with op.batch_alter_table("rewards") as b:
        b.alter_column("icon", existing_type=sa.String(8), type_=sa.String(40), nullable=True)
        b.add_column(sa.Column("visible", sa.Boolean(), nullable=False, server_default="1"))
        b.add_column(sa.Column("needs_approval", sa.Boolean(), nullable=False, server_default="1"))
    with op.batch_alter_table("redemptions") as b:
        b.add_column(sa.Column("auto", sa.Boolean(), nullable=False, server_default="0"))
        b.add_column(sa.Column("note", sa.String(200), nullable=True))
    with op.batch_alter_table("custom_badges") as b:
        b.alter_column("icon", existing_type=sa.String(8), type_=sa.String(40), nullable=False)
    with op.batch_alter_table("badge_awards") as b:
        b.add_column(sa.Column("note", sa.String(200), nullable=True))
        b.add_column(sa.Column("awarded_by_id", sa.Integer(), nullable=True))
        b.create_foreign_key(
            "fk_badge_award_awarded_by", "users", ["awarded_by_id"], ["id"], ondelete="SET NULL"
        )
    with op.batch_alter_table("family_settings") as b:
        b.add_column(sa.Column("screen_max_minutes", sa.Integer(), nullable=True))
        b.add_column(
            sa.Column("screen_auto_approve", sa.Boolean(), nullable=False, server_default="0")
        )
        b.add_column(
            sa.Column("screen_only_allowed_hours", sa.Boolean(), nullable=False, server_default="1")
        )
        b.add_column(sa.Column("quick_replies", sa.Text(), nullable=True))
    op.create_table(
        "screen_time_limits",
        sa.Column("kid_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("max_minutes", sa.Integer(), nullable=True),
        sa.Column("min_points", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("kid_id"),
    )
    _fix_icons()


def downgrade() -> None:
    op.drop_table("screen_time_limits")
    with op.batch_alter_table("family_settings") as b:
        for c in ("quick_replies", "screen_only_allowed_hours", "screen_auto_approve"):
            b.drop_column(c)
        b.drop_column("screen_max_minutes")
    with op.batch_alter_table("badge_awards") as b:
        b.drop_constraint("fk_badge_award_awarded_by", type_="foreignkey")
        b.drop_column("awarded_by_id")
        b.drop_column("note")
    with op.batch_alter_table("redemptions") as b:
        b.drop_column("note")
        b.drop_column("auto")
    with op.batch_alter_table("rewards") as b:
        b.drop_column("needs_approval")
        b.drop_column("visible")
