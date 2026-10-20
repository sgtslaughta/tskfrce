"""
Pydantic schemas for TaaskMaaster.

This package contains all Pydantic schemas for API request/response validation.
"""

from .gamification import (
    AchievementResponse,
    LeaderboardEntryResponse,
    LeaderboardResponse,
    PointsResponse,
    UserAchievementResponse,
)
from .goal import (
    GoalCreate,
    GoalProgressCreate,
    GoalProgressResponse,
    GoalResponse,
    GoalUpdate,
)
from .media import MediaAttachmentCreate, MediaAttachmentResponse
from .task import (
    TaskCategoryCreate,
    TaskCategoryResponse,
    TaskCategoryUpdate,
    TaskCreate,
    TaskList,
    TaskResponse,
    TaskTagCreate,
    TaskTagResponse,
    TaskTemplateCreate,
    TaskTemplateResponse,
    TaskTemplateUpdate,
    TaskUpdate,
)
from .user import UserCreate, UserList, UserResponse, UserUpdate

__all__ = [
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserList",
    "TaskCreate",
    "TaskUpdate",
    "TaskResponse",
    "TaskList",
    "TaskTemplateCreate",
    "TaskTemplateUpdate",
    "TaskTemplateResponse",
    "TaskCategoryCreate",
    "TaskCategoryUpdate",
    "TaskCategoryResponse",
    "TaskTagCreate",
    "TaskTagResponse",
    "GoalCreate",
    "GoalUpdate",
    "GoalResponse",
    "GoalProgressCreate",
    "GoalProgressResponse",
    "AchievementResponse",
    "UserAchievementResponse",
    "PointsResponse",
    "LeaderboardResponse",
    "LeaderboardEntryResponse",
    "MediaAttachmentCreate",
    "MediaAttachmentResponse",
]
