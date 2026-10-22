"""Rewards catalog and point-spend requests."""

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String

from app.core.database import Base


class Reward(Base):
    __tablename__ = "rewards"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    price = Column(Integer, nullable=False)
    icon = Column(String(8), nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Redemption(Base):
    __tablename__ = "redemptions"
    __table_args__ = (
        CheckConstraint("kind IN ('screen_time','reward')", name="ck_redemption_kind"),
        CheckConstraint("status IN ('pending','approved','denied')", name="ck_redemption_status"),
        CheckConstraint("(kind = 'reward') = (reward_id IS NOT NULL)", name="ck_redemption_reward"),
        CheckConstraint(
            "(kind = 'screen_time') = (minutes IS NOT NULL)", name="ck_redemption_minutes"
        ),
    )

    id = Column(Integer, primary_key=True)
    kid_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String(12), nullable=False)  # screen_time | reward
    reward_id = Column(Integer, ForeignKey("rewards.id"), nullable=True)
    minutes = Column(Integer, nullable=True)
    cost = Column(Integer, nullable=False)
    status = Column(String(10), nullable=False, default="pending")  # pending|approved|denied
    created_at = Column(DateTime, default=datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)
    decided_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    seen_by_kid = Column(Boolean, nullable=False, default=False)
