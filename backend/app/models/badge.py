"""Earned badge tiers (built-in and custom) and parent-made custom badges."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)

from app.core.database import Base


class CustomBadge(Base):
    __tablename__ = "custom_badges"

    id = Column(Integer, primary_key=True)
    name = Column(String(60), nullable=False)
    icon = Column(String(40), nullable=False)
    description = Column(String(200), nullable=False, default="")
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class BadgeAward(Base):
    __tablename__ = "badge_awards"
    __table_args__ = (
        UniqueConstraint("kid_id", "badge_key", name="uq_badge_award_kid_key"),
        UniqueConstraint("kid_id", "custom_badge_id", name="uq_badge_award_kid_custom"),
        CheckConstraint(
            "(badge_key IS NULL) != (custom_badge_id IS NULL)", name="ck_badge_award_one_badge"
        ),
    )

    id = Column(Integer, primary_key=True)
    kid_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    badge_key = Column(String(40), nullable=True)  # catalog key (code, not a row)
    custom_badge_id = Column(Integer, ForeignKey("custom_badges.id"), nullable=True)
    tier = Column(Integer, nullable=False)
    earned_at = Column(DateTime, default=datetime.utcnow)
    seen_by_kid = Column(Boolean, nullable=False, default=False)
    note = Column(String(200), nullable=True)
    awarded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
