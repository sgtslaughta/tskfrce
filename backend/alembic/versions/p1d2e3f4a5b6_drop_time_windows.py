"""Drop time_windows (replaced by hour rules); downgrade rebuilds it from the rules."""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "p1d2e3f4a5b6"
down_revision: str | None = "p0d1e2f3a4b5"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.drop_table("time_windows")


def downgrade() -> None:
    op.create_table(
        "time_windows",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("days", sa.String(length=7), nullable=False),
        sa.Column("start", sa.String(length=5), nullable=False),
        sa.Column("end", sa.String(length=5), nullable=False),
        sa.Column("kid_id", sa.Integer(), nullable=True),
        sa.Column("group_id", sa.Integer(), nullable=True),
        sa.CheckConstraint("kind IN ('allowed','free')", name="ck_window_kind"),
        sa.CheckConstraint("(kid_id IS NULL) != (group_id IS NULL)", name="ck_window_one_target"),
        sa.ForeignKeyConstraint(["group_id"], ["device_groups.id"]),
        sa.ForeignKeyConstraint(["kid_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    bind = op.get_bind()
    ins = sa.text(
        'INSERT INTO time_windows (kind, days, start, "end", kid_id, group_id) '
        "VALUES (:k, :d, :s, :e, :kid, :grp)"
    )
    rules = bind.execute(
        sa.text("SELECT id, kind, days, everyone FROM hour_rules WHERE kind IN ('allowed','free')")
    ).fetchall()
    kids = [r[0] for r in bind.execute(sa.text("SELECT id FROM users WHERE role = 'KID'"))]
    for rid, kind, days, everyone in rules:
        times = bind.execute(
            sa.text('SELECT start, "end" FROM hour_rule_times WHERE rule_id = :r ORDER BY id'),
            {"r": rid},
        ).fetchall()
        targets = [
            (k, g)
            for k, g in bind.execute(
                sa.text("SELECT kid_id, group_id FROM hour_rule_targets WHERE rule_id = :r"),
                {"r": rid},
            )
        ]
        if everyone:
            targets += [(k, None) for k in kids]
        for kid, grp in targets:
            for s, e in times:
                bind.execute(ins, {"k": kind, "d": days, "s": s, "e": e, "kid": kid, "grp": grp})
