"""Points ledger: one row per award, redemption or bonus."""

from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.core.database import Base


class PointsType(str, Enum):
    """Points transaction types."""

    TASK_COMPLETION = "task_completion"
    ACHIEVEMENT = "achievement"
    STREAK_BONUS = "streak_bonus"
    GOAL_COMPLETION = "goal_completion"
    BONUS = "bonus"
    PENALTY = "penalty"
    TRANSFER = "transfer"
    REDEMPTION = "redemption"


class Points(Base):
    """
    Points tracking for users.

    Attributes:
        id: Primary key
        user_id: User who owns the points
        points_type: Type of points transaction
        amount: Points amount (positive or negative)
        description: Transaction description
        reason: Machine-read kind (chore, early_bonus, team_share, redemption, bonus, adjustment)
        created_at: Creation timestamp
    """

    __tablename__ = "points"
    __table_args__ = (
        CheckConstraint("run_id IS NULL OR redemption_id IS NULL", name="ck_points_one_ref"),
        CheckConstraint(
            "reason IN ('chore','early_bonus','team_share','redemption','bonus','adjustment','deduction')",
            name="ck_points_reason",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    points_type = Column(SQLEnum(PointsType), nullable=False, index=True)
    amount = Column(Integer, nullable=False)
    description = Column(String(255), nullable=True)
    reason = Column(String(12), nullable=False, default="adjustment", server_default="adjustment")
    by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    run_id = Column(Integer, ForeignKey("chore_runs.id"), nullable=True, index=True)
    redemption_id = Column(Integer, ForeignKey("redemptions.id"), nullable=True, index=True)
    seen_by_kid = Column(Boolean, nullable=False, default=True, server_default="1")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="points", foreign_keys=[user_id])

    def __repr__(self) -> str:
        """String representation of Points."""
        return f"<Points(user_id={self.user_id}, amount={self.amount}, type='{self.points_type}')>"
