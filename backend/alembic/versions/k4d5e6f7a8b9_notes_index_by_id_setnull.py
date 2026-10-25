"""Backfill wave-A schema tweaks on DBs that already ran h1a2b3c4d5e6."""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "k4d5e6f7a8b9"
down_revision: str | None = "j3c4d5e6f7a8"
branch_labels: str | None = None
depends_on: str | None = None

IX = "ix_chore_type_notes_type_id"


def _by_id_fk() -> str | None:
    for fk in sa.inspect(op.get_bind()).get_foreign_keys("points"):
        if fk["constrained_columns"] == ["by_id"]:
            return fk["name"]
    return None


def _recreate_fk(ondelete: str | None) -> None:
    name = _by_id_fk()
    with op.batch_alter_table("points") as b:
        if name:
            b.drop_constraint(name, type_="foreignkey")
        b.create_foreign_key("fk_points_by", "users", ["by_id"], ["id"], ondelete=ondelete)


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if IX not in {i["name"] for i in insp.get_indexes("chore_type_notes")}:
        op.create_index(IX, "chore_type_notes", ["type_id"])
    _recreate_fk("SET NULL")


def downgrade() -> None:
    _recreate_fk(None)
    op.drop_index(IX, table_name="chore_type_notes")
