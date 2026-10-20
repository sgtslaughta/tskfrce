"""
Task schemas for TaaskMaaster.

This module contains Pydantic schemas for task-related API operations.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.task import RewardType, TaskPriority, TaskStatus


class TaskBase(BaseModel):
    """Base task schema with common fields."""

    title: str = Field(..., min_length=1, max_length=255, description="Task title")
    description: str | None = Field(None, description="Task description")
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM, description="Task priority")
    due_date: datetime | None = Field(None, description="Task due date")
    estimated_hours: float = Field(default=0.0, ge=0, description="Estimated hours to complete")
    points: int = Field(default=0, ge=0, description="Points awarded for completion (legacy)")
    reward_type: RewardType = Field(
        default=RewardType.POINTS, description="Type of reward for completion"
    )
    reward_value: float = Field(default=0.0, ge=0, description="Value of the reward")
    reward_description: str | None = Field(
        None, max_length=255, description="Description for custom rewards"
    )


class TaskCreate(TaskBase):
    """Schema for creating a new task."""

    assigned_to_id: int | None = Field(None, description="User ID to assign task to")
    category_id: int | None = Field(None, description="Task category ID")
    template_id: int | None = Field(None, description="Task template ID")
    parent_task_id: int | None = Field(None, description="Parent task ID for subtasks")
    is_recurring: bool = Field(default=False, description="Whether task repeats")
    recurrence_pattern: dict[str, Any] | None = Field(None, description="Recurrence pattern")
    tag_names: list[str] | None = Field(None, description="List of tag names")


class TaskUpdate(BaseModel):
    """Schema for updating task information."""

    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    due_date: datetime | None = None
    completed_at: datetime | None = None
    estimated_hours: float | None = Field(None, ge=0)
    actual_hours: float | None = Field(None, ge=0)
    points: int | None = Field(None, ge=0)
    reward_type: str | None = None
    reward_value: float | None = Field(None, ge=0)
    reward_description: str | None = Field(None, max_length=255)
    assigned_to_id: int | None = None
    category_id: int | None = None
    parent_task_id: int | None = None
    is_recurring: bool | None = None
    recurrence_pattern: dict[str, Any] | None = None
    tag_names: list[str] | None = None

    class Config:
        use_enum_values = True


class TaskBulkUpdate(BaseModel):
    """Schema for bulk updating multiple tasks."""

    task_ids: list[int] = Field(..., description="List of task IDs to update")
    updates: TaskUpdate = Field(..., description="Updates to apply to all tasks")


class TaskExportRequest(BaseModel):
    """Schema for task export requests."""

    format: str = Field(default="csv", description="Export format (csv, json, xlsx)")
    filters: dict[str, Any] | None = Field(None, description="Export filters")
    include_completed: bool = Field(default=True, description="Include completed tasks")


# JSON Request Body Schemas for URI Parameter Conversion
class TaskCompleteRequest(BaseModel):
    """Schema for completing a task via JSON request body."""

    task_id: int = Field(..., description="Task ID to complete")
    actual_hours: float | None = Field(None, ge=0, description="Actual hours spent")


class TaskGetRequest(BaseModel):
    """Schema for getting a task via JSON request body."""

    task_id: int = Field(..., description="Task ID to retrieve")


class TaskUpdateRequest(BaseModel):
    """Schema for updating a task via JSON request body."""

    task_id: int = Field(..., description="Task ID to update")
    updates: dict[str, Any] = Field(..., description="Updates to apply")


class TaskDeleteRequest(BaseModel):
    """Schema for deleting a task via JSON request body."""

    task_id: int = Field(..., description="Task ID to delete")
    date_range: dict[str, datetime] | None = Field(None, description="Date range for export")


class TaskResponse(TaskBase):
    """Schema for task response data."""

    id: int
    status: TaskStatus
    completed_at: datetime | None = None
    actual_hours: float = 0.0
    is_recurring: bool
    recurrence_pattern: dict[str, Any] | None = None
    created_by_id: int
    assigned_to_id: int | None = None
    category_id: int | None = None
    template_id: int | None = None
    parent_task_id: int | None = None
    created_at: datetime
    updated_at: datetime

    # Related data
    assigned_to: dict | None = None  # Will be populated by service layer
    category: dict | None = None  # Will be populated by service layer
    template: dict | None = None  # Will be populated by service layer
    tags: list[dict] = []  # Will be populated by service layer
    subtasks: list["TaskResponse"] = []
    dependencies: list[dict] = []  # Will be populated by service layer
    media_attachments: list[dict] = []  # Will be populated by service layer

    class Config:
        from_attributes = True


class TaskList(BaseModel):
    """Schema for task list response."""

    tasks: list[TaskResponse]
    total: int
    page: int
    size: int
    pages: int


class TaskTemplateBase(BaseModel):
    """Base task template schema."""

    name: str = Field(..., min_length=1, max_length=255, description="Template name")
    description: str | None = Field(None, description="Template description")
    title_pattern: str = Field(..., min_length=1, max_length=255, description="Title pattern")
    description_template: str | None = Field(None, description="Description template")
    estimated_hours: float = Field(default=0.0, ge=0)
    points: int = Field(default=0, ge=0)
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM)
    is_public: bool = Field(default=False, description="Whether template is public")


class TaskTemplateCreate(TaskTemplateBase):
    """Schema for creating a task template."""

    category_id: int | None = Field(None, description="Default category ID")
    tags: list[str] | None = Field(None, description="Default tag names")


class TaskTemplateUpdate(BaseModel):
    """Schema for updating a task template."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    title_pattern: str | None = Field(None, min_length=1, max_length=255)
    description_template: str | None = None
    estimated_hours: float | None = Field(None, ge=0)
    points: int | None = Field(None, ge=0)
    priority: TaskPriority | None = None
    category_id: int | None = None
    tags: list[str] | None = None
    is_public: bool | None = None


class TaskTemplateResponse(TaskTemplateBase):
    """Schema for task template response."""

    id: int
    category_id: int | None = None
    tags: list[str] | None = None
    created_by_id: int
    created_at: datetime
    updated_at: datetime

    # Related data
    category: dict | None = None  # Will be populated by service layer

    class Config:
        from_attributes = True


class TaskCategoryBase(BaseModel):
    """Base task category schema."""

    name: str = Field(..., min_length=1, max_length=100, description="Category name")
    description: str | None = Field(None, description="Category description")
    color: str = Field(default="#3B82F6", description="Category color (hex)")
    icon: str | None = Field(None, max_length=50, description="Category icon")


class TaskCategoryCreate(TaskCategoryBase):
    """Schema for creating a task category."""

    parent_id: int | None = Field(None, description="Parent category ID")


class TaskCategoryUpdate(BaseModel):
    """Schema for updating a task category."""

    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    color: str | None = None
    icon: str | None = Field(None, max_length=50)
    parent_id: int | None = None


class TaskCategoryResponse(TaskCategoryBase):
    """Schema for task category response."""

    id: int
    parent_id: int | None = None
    created_by_id: int
    created_at: datetime
    updated_at: datetime

    # Related data
    subcategories: list[dict] = []  # Will be populated by service layer

    class Config:
        from_attributes = True


class TaskTagBase(BaseModel):
    """Base task tag schema."""

    name: str = Field(..., min_length=1, max_length=50, description="Tag name")
    color: str = Field(default="#6B7280", description="Tag color (hex)")


class TaskTagCreate(TaskTagBase):
    """Schema for creating a task tag."""


class TaskTagResponse(TaskTagBase):
    """Schema for task tag response."""

    id: int
    created_by_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TaskDependencyBase(BaseModel):
    """Base task dependency schema."""

    depends_on_task_id: int = Field(..., description="Task ID this depends on")
    dependency_type: str = Field(default="finish_to_start", description="Dependency type")


class TaskDependencyCreate(TaskDependencyBase):
    """Schema for creating a task dependency."""


class TaskDependencyResponse(TaskDependencyBase):
    """Schema for task dependency response."""

    id: int
    task_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Task List Schemas
class TaskListBase(BaseModel):
    """Base schema for task list data."""

    name: str
    description: str | None = None
    color: str = "#3B82F6"
    is_public: bool = False
    is_archived: bool = False


class TaskListCreate(TaskListBase):
    """Schema for creating a new task list."""

    pass


class TaskListUpdate(BaseModel):
    """Schema for updating a task list."""

    name: str | None = None
    description: str | None = None
    color: str | None = None
    is_public: bool | None = None
    is_archived: bool | None = None


class TaskListResponse(TaskListBase):
    """Schema for task list response."""

    id: int
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    task_count: int = 0
    completed_task_count: int = 0

    class Config:
        from_attributes = True


class TaskListWithTasks(TaskListResponse):
    """Schema for task list with associated tasks."""

    tasks: list[TaskResponse] = []


class TaskListAssociationCreate(BaseModel):
    """Schema for adding a task to a list."""

    task_id: int
    position: int | None = None


class TaskListAssociationUpdate(BaseModel):
    """Schema for updating task position in list."""

    position: int


class TaskListAssociationResponse(BaseModel):
    """Schema for task list association response."""

    id: int
    task_id: int
    list_id: int
    position: int
    added_at: datetime

    class Config:
        from_attributes = True


class TaskListBulkUpdate(BaseModel):
    """Schema for bulk updating task positions in a list."""

    task_positions: list[dict[str, int]]  # [{"task_id": 1, "position": 0}, ...]


class TaskListStats(BaseModel):
    """Schema for task list statistics."""

    total_lists: int
    total_tasks: int
    completed_tasks: int
    completion_rate: float
    most_active_list: str | None = None
    recent_activity: list[dict[str, Any]] = []


# Template Operation Request Schemas
class CreateFromTemplateRequest(BaseModel):
    """Schema for creating a task from a template."""

    template_id: int = Field(..., description="Template ID to use")
    title: str | None = Field(None, description="Override template title")
    description: str | None = Field(None, description="Override template description")
    assigned_to_id: int | None = Field(None, description="User ID to assign task to")
    due_date: datetime | None = Field(None, description="Override template due date")
    priority: TaskPriority | None = Field(None, description="Override template priority")
    estimated_hours: float | None = Field(None, description="Override template estimated hours")
    points: int | None = Field(None, description="Override template points")


class GetTemplateRequest(BaseModel):
    """Schema for getting a template."""

    template_id: int = Field(..., description="Template ID to retrieve")


class UpdateTemplateRequest(BaseModel):
    """Schema for updating a template."""

    template_id: int = Field(..., description="Template ID to update")
    updates: TaskTemplateUpdate = Field(..., description="Updates to apply")


class DeleteTemplateRequest(BaseModel):
    """Schema for deleting a template."""

    template_id: int = Field(..., description="Template ID to delete")


# List Operation Request Schemas
class GetListTasksRequest(BaseModel):
    """Schema for getting tasks in a list."""

    list_id: int = Field(..., description="List ID to get tasks from")
    include_completed: bool = Field(default=True, description="Include completed tasks")
    limit: int = Field(default=50, ge=1, le=1000, description="Maximum number of tasks to return")
    offset: int = Field(default=0, ge=0, description="Number of tasks to skip")
