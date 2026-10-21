"""Earned badge tiers (built-in and custom) and parent-made custom badges."""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint

from app.core.database import Base


class CustomBadge(Base):
    __tablename__ = "custom_badges"

    id = Column(Integer, primary_key=True)
    name = Column(String(60), nullable=False)
    icon = Column(String(8), nullable=False)
    description = Column(String(200), nullable=False, default="")
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class BadgeAward(Base):
    __tablename__ = "badge_awards"
    __table_args__ = (UniqueConstraint("kid_id", "badge_key", name="uq_badge_award_kid_key"),)

    id = Column(Integer, primary_key=True)
    kid_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    badge_key = Column(String(40), nullable=False)  # catalog key or "custom:<id>"
    tier = Column(Integer, nullable=False)
    earned_at = Column(DateTime, default=datetime.utcnow)
    seen_by_kid = Column(Boolean, nullable=False, default=False)
