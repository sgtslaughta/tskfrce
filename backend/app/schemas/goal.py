"""
Goal schemas for TaaskMaaster.

This module contains Pydantic schemas for goal-related API operations.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.goal import GoalStatus, GoalType


class GoalBase(BaseModel):
    """Base goal schema with common fields."""

    title: str = Field(
        ..., min_length=1, max_length=255, description="Goal title"
    )
    description: Optional[str] = Field(None, description="Goal description")
    goal_type: GoalType = Field(..., description="Type of goal")
    target_value: float = Field(
        ..., gt=0, description="Target value to achieve"
    )
    end_date: Optional[datetime] = Field(None, description="Goal end date")
    is_recurring: bool = Field(
        default=False, description="Whether goal repeats"
    )


class GoalCreate(GoalBase):
    """Schema for creating a new goal."""

    recurrence_pattern: Optional[Dict[str, Any]] = Field(
        None, description="Recurrence pattern"
    )


class GoalUpdate(BaseModel):
    """Schema for updating goal information."""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    goal_type: Optional[GoalType] = None
    target_value: Optional[float] = Field(None, gt=0)
    current_value: Optional[float] = Field(None, ge=0)
    status: Optional[GoalStatus] = None
    end_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    is_recurring: Optional[bool] = None
    recurrence_pattern: Optional[Dict[str, Any]] = None


class GoalProgressBase(BaseModel):
    """Base goal progress schema."""

    value: float = Field(..., description="Progress value")
    notes: Optional[str] = Field(None, description="Progress notes")


class GoalProgressCreate(GoalProgressBase):
    """Schema for creating goal progress."""

    recorded_at: Optional[datetime] = Field(
        None, description="When progress was recorded"
    )


class GoalProgressResponse(GoalProgressBase):
    """Schema for goal progress response."""

    id: int
    goal_id: int
    recorded_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class GoalResponse(GoalBase):
    """Schema for goal response data."""

    id: int
    current_value: float = 0.0
    status: GoalStatus
    start_date: datetime
    completed_at: Optional[datetime] = None
    recurrence_pattern: Optional[Dict[str, Any]] = None
    user_id: int
    created_at: datetime
    updated_at: datetime

    # Computed properties
    progress_percentage: float
    is_completed: bool

    # Related data
    progress_entries: List[GoalProgressResponse] = []

    class Config:
        from_attributes = True


class GoalList(BaseModel):
    """Schema for goal list response."""

    goals: List[GoalResponse]
    total: int
    page: int
    size: int
    pages: int


class GoalProgressList(BaseModel):
    """Schema for goal progress list response."""

    progress_entries: List[GoalProgressResponse]
    total: int
    page: int
    size: int
    pages: int
