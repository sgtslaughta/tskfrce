"""Legacy (pre-v2) routes and tables are gone."""

import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect

BACKEND = Path(__file__).resolve().parent.parent
PREFIXES = (
    "tasks",
    "goals",
    "gamification",
    "lists",
    "media",
    "comments",
    "workflow",
    "messages",
    "mentions",
    "presence",
)
LEGACY_TABLES = {
    "tasks",
    "chore_participants",
    "chore_subtasks",
    "task_templates",
    "task_categories",
    "task_tags",
    "task_tag_associations",
    "task_dependencies",
    "goals",
    "goal_progress",
    "achievements",
    "user_achievements",
    "streaks",
    "leaderboards",
    "leaderboard_entries",
    "task_lists",
    "task_list_associations",
    "media_attachments",
    "task_comments",
    "comment_audit_trail",
    "comment_mentions",
    "comment_reactions",
    "comment_media_attachments",
    "task_status_history",
    "conversations",
    "conversation_participants",
    "conversation_settings",
    "direct_messages",
    "direct_message_media",
    "message_read_receipts",
    "task_chat_messages",
    "task_chat_message_media",
    "user_status",
}


def test_legacy_routes_404(client, parent_headers):
    for p in PREFIXES:
        r = client.get(f"/api/v1/{p}/", headers=parent_headers)
        assert r.status_code == 404, (p, r.status_code)


def test_ws_not_routed(client):
    from app.main import fastapi_app

    assert not [r for r in fastapi_app.routes if getattr(r, "path", "").startswith("/ws")]


def test_legacy_tables_dropped(tmp_path):
    url = f"sqlite:///{tmp_path / 'g.db'}"
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND,
        env={**os.environ, "DATABASE_URL": url},
        check=True,
        capture_output=True,
    )
    insp = inspect(create_engine(url))
    assert not LEGACY_TABLES & set(insp.get_table_names())
    # the legacy name is reused by v3 chat reactions, now pointing at thread_messages
    fks = insp.get_foreign_keys("message_reactions")
    assert {"thread_messages", "users"} == {f["referred_table"] for f in fks}
    assert "task_id" not in {c["name"] for c in insp.get_columns("chore_photos")}
    assert "task_id" not in {c["name"] for c in insp.get_columns("threads")}
