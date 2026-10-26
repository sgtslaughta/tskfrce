"""Notification inbox: one row per recipient, linked to what it's about."""

from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String

from app.core.database import Base

KINDS = (
    "chore_submitted",
    "redemption_request",
    "redemption_decided",
    "device_resisting",
    "new_device",
    "badge_earned",
    "level_up",
    "chat_message",
    "chore_note",
    "device_bypass",
    "box_offline",
)


def _fk(table: str) -> Column:
    return Column(Integer, ForeignKey(f"{table}.id", ondelete="CASCADE"), index=True)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(
            "kind IN (" + ",".join(f"'{k}'" for k in KINDS) + ")", name="ck_notification_kind"
        ),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind = Column(String(20), nullable=False)
    title = Column(String(120), nullable=False)
    body = Column(String(300), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    read_at = Column(DateTime, nullable=True)
    run_id = _fk("chore_runs")
    redemption_id = _fk("redemptions")
    device_id = _fk("devices")
    thread_id = _fk("threads")
