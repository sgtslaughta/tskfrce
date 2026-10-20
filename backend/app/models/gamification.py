"""
Gamification models for TaaskMaaster.

This module contains models for points, achievements, leaderboards,
and other gamification features.
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


class AchievementType(str, Enum):
    """Achievement types."""

    TASK_COMPLETION = "task_completion"
    STREAK = "streak"
    POINTS_MILESTONE = "points_milestone"
    GOAL_COMPLETION = "goal_completion"
    TIME_SPENT = "time_spent"
    SOCIAL = "social"
    CUSTOM = "custom"


class AchievementRarity(str, Enum):
    """Achievement rarity levels."""

    COMMON = "common"
    UNCOMMON = "uncommon"
    RARE = "rare"
    EPIC = "epic"
    LEGENDARY = "legendary"


class PointsType(str, Enum):
    """Points transaction types."""

    TASK_COMPLETION = "task_completion"
    ACHIEVEMENT = "achievement"
    STREAK_BONUS = "streak_bonus"
    GOAL_COMPLETION = "goal_completion"
    BONUS = "bonus"
    PENALTY = "penalty"
    TRANSFER = "transfer"


class Achievement(Base):
    """
    Achievement model for gamification system.

    Attributes:
        id: Primary key
        name: Achievement name
        description: Achievement description
        achievement_type: Type of achievement
        rarity: Achievement rarity
        points_reward: Points awarded for achievement
        icon: Achievement icon
        criteria: JSON criteria for earning achievement
        is_active: Whether achievement is active
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    achievement_type = Column(
        SQLEnum(AchievementType), nullable=False, index=True
    )
    rarity = Column(
        SQLEnum(AchievementRarity),
        default=AchievementRarity.COMMON,
        index=True,
    )
    points_reward = Column(Integer, default=0)
    icon = Column(String(100), nullable=True)
    criteria = Column(JSON, nullable=True)  # Achievement criteria
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user_achievements = relationship(
        "UserAchievement", back_populates="achievement"
    )

    def __repr__(self) -> str:
        """String representation of Achievement."""
        return (
            f"<Achievement(id={self.id}, name='{self.name}', "
            f"rarity='{self.rarity}')>"
        )


class UserAchievement(Base):
    """
    User achievement tracking.

    Attributes:
        id: Primary key
        user_id: User who earned the achievement
        achievement_id: Achievement that was earned
        earned_at: When achievement was earned
        progress_value: Progress value when earned
        created_at: Creation timestamp
    """

    __tablename__ = "user_achievements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    achievement_id = Column(
        Integer, ForeignKey("achievements.id"), nullable=False
    )
    earned_at = Column(DateTime, default=datetime.utcnow)
    progress_value = Column(
        Float, nullable=True
    )  # Value when achievement was earned
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="achievements")
    achievement = relationship(
        "Achievement", back_populates="user_achievements"
    )

    def __repr__(self) -> str:
        """String representation of UserAchievement."""
        return (
            f"<UserAchievement(user_id={self.user_id}, "
            f"achievement_id={self.achievement_id})>"
        )


class Points(Base):
    """
    Points tracking for users.

    Attributes:
        id: Primary key
        user_id: User who owns the points
        points_type: Type of points transaction
        amount: Points amount (positive or negative)
        description: Transaction description
        reference_id: Reference to related entity (task, achievement, etc.)
        reference_type: Type of reference entity
        created_at: Creation timestamp
    """

    __tablename__ = "points"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    points_type = Column(SQLEnum(PointsType), nullable=False, index=True)
    amount = Column(Integer, nullable=False)
    description = Column(String(255), nullable=True)
    reference_id = Column(Integer, nullable=True)  # ID of related entity
    reference_type = Column(
        String(50), nullable=True
    )  # Type of related entity
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="points")

    def __repr__(self) -> str:
        """String representation of Points."""
        return (
            f"<Points(user_id={self.user_id}, amount={self.amount}, "
            f"type='{self.points_type}')>"
        )


class Leaderboard(Base):
    """
    Leaderboard for competitive features.

    Attributes:
        id: Primary key
        name: Leaderboard name
        description: Leaderboard description
        leaderboard_type: Type of leaderboard
        time_period: Time period for leaderboard (daily, weekly, monthly,
        all_time)
        start_date: Leaderboard start date
        end_date: Leaderboard end date
        is_active: Whether leaderboard is active
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "leaderboards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    leaderboard_type = Column(
        String(50), nullable=False, index=True
    )  # points, tasks, streaks, etc.
    time_period = Column(
        String(20), nullable=False, index=True
    )  # daily, weekly, monthly, all_time
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    entries = relationship(
        "LeaderboardEntry",
        back_populates="leaderboard",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        """String representation of Leaderboard."""
        return (
            f"<Leaderboard(id={self.id}, name='{self.name}', "
            f"type='{self.leaderboard_type}')>"
        )


class LeaderboardEntry(Base):
    """
    Individual leaderboard entries.

    Attributes:
        id: Primary key
        leaderboard_id: Associated leaderboard
        user_id: User in the leaderboard
        score: User's score
        rank: User's rank
        metadata: Additional metadata (JSON)
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "leaderboard_entries"

    id = Column(Integer, primary_key=True, index=True)
    leaderboard_id = Column(
        Integer, ForeignKey("leaderboards.id"), nullable=False
    )
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Float, nullable=False, index=True)
    rank = Column(Integer, nullable=True, index=True)
    metadata_json = Column(JSON, nullable=True)  # Additional data
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    leaderboard = relationship("Leaderboard", back_populates="entries")
    user = relationship("User")

    def __repr__(self) -> str:
        """String representation of LeaderboardEntry."""
        return (
            f"<LeaderboardEntry(user_id={self.user_id}, score={self.score}, "
            f"rank={self.rank})>"
        )


class Streak(Base):
    """
    Streak tracking for continuous task completion.

    Attributes:
        id: Primary key
        user_id: User who has the streak
        streak_type: Type of streak
        current_streak: Current streak count
        longest_streak: Longest streak achieved
        last_activity: Last activity date
        start_date: Streak start date
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "streaks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    streak_type = Column(
        String(50), nullable=False, index=True
    )  # daily_tasks, weekly_goals, etc.
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_activity = Column(DateTime, nullable=True)
    start_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user = relationship("User")

    def __repr__(self) -> str:
        """String representation of Streak."""
        return (
            f"<Streak(user_id={self.user_id}, type='{self.streak_type}', "
            f"current={self.current_streak})>"
        )
