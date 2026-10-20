"""
Goal models for TaaskMaaster.

This module contains models for goal tracking and progress monitoring.
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.core.database import Base


class GoalType(str, Enum):
    """Goal types."""

    TASK_COUNT = "task_count"
    POINTS = "points"
    STREAK = "streak"
    TIME_SPENT = "time_spent"
    CUSTOM = "custom"


class GoalStatus(str, Enum):
    """Goal status values."""

    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class Goal(Base):
    """
    Goal model for tracking user objectives and achievements.

    Attributes:
        id: Primary key
        title: Goal title
        description: Goal description
        goal_type: Type of goal
        target_value: Target value to achieve
        current_value: Current progress value
        status: Goal status
        start_date: Goal start date
        end_date: Goal end date
        completed_at: Completion timestamp
        is_recurring: Whether goal repeats
        recurrence_pattern: JSON pattern for recurring goals
        user_id: User who owns the goal
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    goal_type = Column(SQLEnum(GoalType), nullable=False, index=True)
    target_value = Column(Float, nullable=False)
    current_value = Column(Float, default=0.0)
    status = Column(SQLEnum(GoalStatus), default=GoalStatus.ACTIVE, index=True)
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    is_recurring = Column(Boolean, default=False)
    recurrence_pattern = Column(JSON, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user = relationship("User", back_populates="goals")
    progress_entries = relationship(
        "GoalProgress", back_populates="goal", cascade="all, delete-orphan"
    )

    @property
    def progress_percentage(self) -> float:
        """Calculate progress percentage."""
        if self.target_value == 0:
            return 0.0
        return min(100.0, (self.current_value / self.target_value) * 100)

    @property
    def is_completed(self) -> bool:
        """Check if goal is completed."""
        return self.current_value >= self.target_value

    def __repr__(self) -> str:
        """String representation of Goal."""
        return (
            f"<Goal(id={self.id}, title='{self.title}', "
            f"status='{self.status}')>"
        )


class GoalProgress(Base):
    """
    Goal progress tracking for detailed progress monitoring.

    Attributes:
        id: Primary key
        goal_id: Associated goal
        value: Progress value
        notes: Progress notes
        recorded_at: When progress was recorded
        created_at: Creation timestamp
    """

    __tablename__ = "goal_progress"

    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    value = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    goal = relationship("Goal", back_populates="progress_entries")

    def __repr__(self) -> str:
        """String representation of GoalProgress."""
        return (
            f"<GoalProgress(id={self.id}, goal_id={self.goal_id}, "
            f"value={self.value})>"
        )
