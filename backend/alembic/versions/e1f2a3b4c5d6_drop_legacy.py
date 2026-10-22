"""drop every legacy (pre-v2) table and the task_id columns that pointed at tasks

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-10-23 10:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e1f2a3b4c5d6"
down_revision: str | Sequence[str] | None = "d0e1f2a3b4c5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# children before parents
LEGACY = (
    "comment_reactions",
    "comment_mentions",
    "comment_media_attachments",
    "comment_audit_trail",
    "task_comments",
    "direct_message_media",
    "message_read_receipts",
    "message_reactions",
    "direct_messages",
    "conversation_participants",
    "conversation_settings",
    "conversations",
    "task_chat_message_media",
    "task_chat_messages",
    "user_status",
    "media_attachments",
    "task_status_history",
    "task_dependencies",
    "task_list_associations",
    "task_tag_associations",
    "task_lists",
    "task_tags",
    "task_templates",
    "task_categories",
    "goal_progress",
    "goals",
    "user_achievements",
    "achievements",
    "leaderboard_entries",
    "leaderboards",
    "streaks",
    "chore_participants",
    "chore_subtasks",
)


def upgrade() -> None:
    for table in ("chore_photos", "threads"):
        op.drop_index(f"ix_{table}_task_id", table_name=table)
        with op.batch_alter_table(table) as b:
            b.drop_column("task_id")
    for table in (*LEGACY, "tasks"):
        op.drop_table(table)


def downgrade() -> None:
    raise NotImplementedError("legacy tables are gone for good (restore the pre-migration backup)")
