"""Hour rules (merged from time_windows), device activity tables, device flags."""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "p0d1e2f3a4b5"
down_revision: str | None = "l5e6f7a8b9c0"
branch_labels: str | None = None
depends_on: str | None = None

KINDS = (
    "bypass",
    "new_address",
    "outside_hours",
    "locked_try",
    "left_wifi",
    "sign_in",
    "address_change",
    "locked",
    "unlocked",
)
CAT = {frozenset("01236"): "school_night", frozenset("45"): "weekend"}
NAME = {"school_night": "School nights", "weekend": "Weekends"}


def _convert(bind) -> None:
    rows = bind.execute(
        sa.text(
            'SELECT id, kind, days, start, "end", kid_id, group_id FROM time_windows ORDER BY id'
        )
    ).fetchall()
    # 1. per target: (kind, days) -> times; 2. signature -> targets
    per_target: dict = {}
    first_id: dict = {}
    for wid, kind, days, start, end, kid, grp in rows:
        key = (kind, days, ("kid", kid) if kid is not None else ("group", grp))
        per_target.setdefault(key, set()).add((start, end))
        first_id.setdefault(key, wid)
    # allowed windows of one target with different categories that share a weekday would
    # hide each other under rank precedence: force them all to "other" so they union
    cats: dict = {}
    for kind, days, target in per_target:
        if kind == "allowed":
            cats.setdefault(target, {})[days] = CAT.get(frozenset(days), "other")
    mixed = {
        t
        for t, dc in cats.items()
        if any(dc[a] != dc[b] and set(a) & set(b) for a in dc for b in dc)
    }
    rules: dict = {}
    for key, times in per_target.items():
        kind, days, target = key
        cat = (
            "other" if kind == "allowed" and target in mixed else CAT.get(frozenset(days), "other")
        )
        sig = (kind, days, tuple(sorted(times)), cat)
        entry = rules.setdefault(sig, {"first": first_id[key], "targets": []})
        entry["first"] = min(entry["first"], first_id[key])
        entry["targets"].append(target)
    for (kind, days, times, category), entry in sorted(
        rules.items(), key=lambda kv: kv[1]["first"]
    ):
        name = NAME.get(category) or ("Free time" if kind == "free" else "Online hours")
        rid = bind.execute(
            sa.text(
                "INSERT INTO hour_rules (name, category, kind, days, everyone) "
                "VALUES (:n, :c, :k, :d, 0)"
            ),
            {"n": name, "c": category, "k": kind, "d": days},
        ).lastrowid
        for s, e in times:
            bind.execute(
                sa.text('INSERT INTO hour_rule_times (rule_id, start, "end") VALUES (:r, :s, :e)'),
                {"r": rid, "s": s, "e": e},
            )
        for tkind, tid in entry["targets"]:
            col = "kid_id" if tkind == "kid" else "group_id"
            bind.execute(
                sa.text(f"INSERT INTO hour_rule_targets (rule_id, {col}) VALUES (:r, :t)"),
                {"r": rid, "t": tid},
            )


def upgrade() -> None:
    op.create_table(
        "hour_rules",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("category", sa.String(14), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("days", sa.String(7), nullable=False),
        sa.Column("start_date", sa.Date, nullable=True),
        sa.Column("end_date", sa.Date, nullable=True),
        sa.Column("everyone", sa.Boolean, nullable=False, server_default="0"),
        sa.CheckConstraint(
            "category IN ('holiday','summer','weekend','school_night','other')",
            name="ck_rule_category",
        ),
        sa.CheckConstraint("kind IN ('allowed','free','off')", name="ck_rule_kind"),
    )
    op.create_table(
        "hour_rule_times",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "rule_id",
            sa.Integer,
            sa.ForeignKey("hour_rules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("start", sa.String(5), nullable=False),
        sa.Column("end", sa.String(5), nullable=False),
    )
    op.create_table(
        "hour_rule_targets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "rule_id",
            sa.Integer,
            sa.ForeignKey("hour_rules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kid_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("group_id", sa.Integer, sa.ForeignKey("device_groups.id", ondelete="CASCADE")),
        sa.CheckConstraint("(kid_id IS NULL) != (group_id IS NULL)", name="ck_rule_target_one"),
        sa.UniqueConstraint("rule_id", "kid_id", "group_id", name="uq_rule_target"),
    )
    op.create_table(
        "device_events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "device_id", sa.Integer, sa.ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("at", sa.DateTime, nullable=False),
        sa.Column("last_at", sa.DateTime, nullable=True),
        sa.Column("count", sa.Integer, nullable=False, server_default="1"),
        sa.Column("reason", sa.String(16), nullable=True),
        sa.Column("kid_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("by_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("other_device_id", sa.Integer, sa.ForeignKey("devices.id", ondelete="SET NULL")),
        sa.Column("minutes", sa.Integer, nullable=True),
        sa.Column("detail", sa.String(120), nullable=True),
        sa.Column("reviewed_at", sa.DateTime, nullable=True),
        sa.CheckConstraint(
            "kind IN (" + ",".join(f"'{k}'" for k in KINDS) + ")", name="ck_device_event_kind"
        ),
    )
    op.create_index("ix_device_events_device_id", "device_events", ["device_id"])
    op.create_index("ix_device_events_at", "device_events", ["at"])
    op.create_table(
        "device_presence",
        sa.Column(
            "device_id",
            sa.Integer,
            sa.ForeignKey("devices.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("slot", sa.DateTime, primary_key=True),
        sa.Column("locked", sa.Boolean, nullable=False, server_default="0"),
    )
    with op.batch_alter_table("device_groups") as b:
        b.add_column(sa.Column("icon", sa.String(40), nullable=False, server_default="devices"))
        b.add_column(sa.Column("chore_lock", sa.Boolean, nullable=False, server_default="1"))
    with op.batch_alter_table("devices") as b:
        b.add_column(sa.Column("blocked_since", sa.DateTime, nullable=True))
        b.add_column(sa.Column("exempt", sa.Boolean, nullable=False, server_default="0"))
    with op.batch_alter_table("family_settings") as b:
        b.add_column(sa.Column("chores_lock", sa.Boolean, nullable=False, server_default="1"))
    _convert(op.get_bind())


def downgrade() -> None:
    with op.batch_alter_table("family_settings") as b:
        b.drop_column("chores_lock")
    with op.batch_alter_table("devices") as b:
        b.drop_column("exempt")
        b.drop_column("blocked_since")
    with op.batch_alter_table("device_groups") as b:
        b.drop_column("chore_lock")
        b.drop_column("icon")
    op.drop_table("device_presence")
    op.drop_index("ix_device_events_at", table_name="device_events")
    op.drop_index("ix_device_events_device_id", table_name="device_events")
    op.drop_table("device_events")
    op.drop_table("hour_rule_targets")
    op.drop_table("hour_rule_times")
    op.drop_table("hour_rules")
