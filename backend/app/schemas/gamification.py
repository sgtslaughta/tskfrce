"""
Gamification schemas for TaaskMaaster.

This module contains Pydantic schemas for gamification-related API operations.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.gamification import (
    AchievementRarity,
    AchievementType,
    PointsType,
)


class AchievementBase(BaseModel):
    """Base achievement schema."""

    name: str = Field(
        ..., min_length=1, max_length=255, description="Achievement name"
    )
    description: Optional[str] = Field(
        None, description="Achievement description"
    )
    achievement_type: AchievementType = Field(
        ..., description="Type of achievement"
    )
    rarity: AchievementRarity = Field(
        default=AchievementRarity.COMMON, description="Achievement rarity"
    )
    points_reward: int = Field(
        default=0, ge=0, description="Points awarded for achievement"
    )
    icon: Optional[str] = Field(
        None, max_length=100, description="Achievement icon"
    )


class AchievementResponse(AchievementBase):
    """Schema for achievement response data."""

    id: int
    criteria: Optional[Dict[str, Any]] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserAchievementBase(BaseModel):
    """Base user achievement schema."""

    progress_value: Optional[float] = Field(
        None, description="Progress value when earned"
    )


class UserAchievementResponse(UserAchievementBase):
    """Schema for user achievement response data."""

    id: int
    user_id: int
    achievement_id: int
    earned_at: datetime
    created_at: datetime

    # Related data
    achievement: AchievementResponse

    class Config:
        from_attributes = True


class PointsBase(BaseModel):
    """Base points schema."""

    points_type: PointsType = Field(
        ..., description="Type of points transaction"
    )
    amount: int = Field(
        ..., description="Points amount (positive or negative)"
    )
    description: Optional[str] = Field(
        None, max_length=255, description="Transaction description"
    )
    reference_id: Optional[int] = Field(
        None, description="Reference to related entity"
    )
    reference_type: Optional[str] = Field(
        None, max_length=50, description="Type of reference entity"
    )


class PointsResponse(PointsBase):
    """Schema for points response data."""

    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PointsList(BaseModel):
    """Schema for points list response."""

    points: List[PointsResponse]
    total: int
    page: int
    size: int
    pages: int


class UserPointsSummary(BaseModel):
    """Schema for user points summary."""

    user_id: int
    total_points: int
    points_this_week: int
    points_this_month: int
    points_this_year: int
    rank: Optional[int] = None
    total_users: int


class LeaderboardBase(BaseModel):
    """Base leaderboard schema."""

    name: str = Field(
        ..., min_length=1, max_length=255, description="Leaderboard name"
    )
    description: Optional[str] = Field(
        None, description="Leaderboard description"
    )
    leaderboard_type: str = Field(
        ..., max_length=50, description="Type of leaderboard"
    )
    time_period: str = Field(
        ..., max_length=20, description="Time period for leaderboard"
    )


class LeaderboardCreate(LeaderboardBase):
    """Schema for creating a leaderboard."""

    start_date: datetime = Field(..., description="Leaderboard start date")
    end_date: Optional[datetime] = Field(
        None, description="Leaderboard end date"
    )


class LeaderboardUpdate(BaseModel):
    """Schema for updating a leaderboard."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    leaderboard_type: Optional[str] = Field(None, max_length=50)
    time_period: Optional[str] = Field(None, max_length=20)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None


class LeaderboardResponse(LeaderboardBase):
    """Schema for leaderboard response data."""

    id: int
    start_date: datetime
    end_date: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    # Related data
    entries: List[dict] = []  # Will be populated by service layer

    class Config:
        from_attributes = True


class LeaderboardList(BaseModel):
    """Schema for leaderboard list response."""

    leaderboards: List[LeaderboardResponse]
    total: int
    page: int
    size: int
    pages: int


class LeaderboardEntryBase(BaseModel):
    """Base leaderboard entry schema."""

    score: float = Field(..., description="User's score")
    rank: Optional[int] = Field(None, description="User's rank")
    metadata_json: Optional[Dict[str, Any]] = Field(
        None, description="Additional metadata"
    )


class LeaderboardEntryResponse(LeaderboardEntryBase):
    """Schema for leaderboard entry response data."""

    id: int
    leaderboard_id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    # Related data
    user: Optional[dict] = None  # Will be populated by service layer

    class Config:
        from_attributes = True


class LeaderboardEntryList(BaseModel):
    """Schema for leaderboard entry list response."""

    entries: List[LeaderboardEntryResponse]
    total: int
    page: int
    size: int
    pages: int


class StreakBase(BaseModel):
    """Base streak schema."""

    streak_type: str = Field(..., max_length=50, description="Type of streak")
    current_streak: int = Field(
        default=0, ge=0, description="Current streak count"
    )
    longest_streak: int = Field(
        default=0, ge=0, description="Longest streak achieved"
    )


class StreakResponse(StreakBase):
    """Schema for streak response data."""

    id: int
    user_id: int
    last_activity: Optional[datetime] = None
    start_date: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StreakList(BaseModel):
    """Schema for streak list response."""

    streaks: List[StreakResponse]
    total: int
    page: int
    size: int
    pages: int
