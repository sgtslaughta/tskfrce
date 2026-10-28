"""Dismissed tips tracking."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base

__all__ = ["DismissedTip"]


class DismissedTip(Base):
    """Track dismissed tips per user."""

    __tablename__ = "dismissed_tips"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tip_key = Column(String(64), nullable=False)
    dismissed_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", backref="dismissed_tips")

    __table_args__ = (UniqueConstraint("user_id", "tip_key", name="uq_dismissed_tips_user_key"),)
