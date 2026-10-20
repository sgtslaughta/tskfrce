"""
Tasks API router for TaaskMaaster.

This module contains API endpoints for advanced task management features.
All endpoints require authentication using JWT Bearer token and use JSON request bodies
for consistency and flexibility.

Authentication:
- All endpoints require a valid JWT Bearer token
- Token must be passed in the Authorization header
- User must be active to access endpoints

Request Format:
- All endpoints use JSON request bodies for input
- No URI parameters are used for better maintainability
- Response models are used for consistent output

Example:
```
POST /api/v1/tasks/complete
Authorization: Bearer <token>
Content-Type: application/json

{
    "task_id": 123,
    "actual_hours": 2.5
}
```

Available Endpoints:
- POST /tasks/ - Create new task
- POST /tasks/get - Get task by ID
- POST /tasks/update - Update task
- POST /tasks/delete - Delete task
- POST /tasks/complete - Complete task
- POST /tasks/bulk-update - Update multiple tasks
- POST /tasks/export - Export tasks
- GET /tasks/reward-types - Get available reward types
- GET /tasks/ - List tasks with filtering
- POST /tasks/templates/create-from-template - Create task from template
- GET /tasks/templates - List templates
- POST /tasks/templates - Create template
- GET /tasks/categories - List categories
- POST /tasks/categories - Create category
- GET /tasks/tags - List tags
- POST /tasks/tags - Create tag
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.auth import get_current_active_user
from app.db.session import get_db_session
from app.models.task import TaskPriority, TaskStatus, RewardType
from app.models.user import User
from app.schemas.task import (
    TaskCategoryCreate,
    TaskCategoryResponse,
    TaskCreate,
    TaskList,
    TaskResponse,
    TaskTagCreate,
    TaskTagResponse,
    TaskTemplateCreate,
    TaskTemplateResponse,
    TaskUpdate,
    TaskBulkUpdate,
    TaskExportRequest,
    TaskCompleteRequest,
    TaskGetRequest,
    TaskUpdateRequest,
    TaskDeleteRequest,
    CreateFromTemplateRequest,
    GetTemplateRequest,
    UpdateTemplateRequest,
    DeleteTemplateRequest,
    GetListTasksRequest,
)
from app.services.task_service import TaskService

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


@router.post(
    "/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED
)
async def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new task with advanced features.

    Supports templates, categories, tags, dependencies, and recurring tasks.
    Requires authentication with an active user account.

    Request Body:
    - title: Task title (required)
    - description: Task description (optional)
    - priority: Task priority (default: medium)
    - due_date: Due date (optional)
    - estimated_hours: Estimated hours (default: 0)
    - points: Points for completion (default: 0)
    - reward_type: Type of reward (default: points)
    - reward_value: Value of reward (default: 0)
    - assigned_to_id: User to assign to (optional)
    - category_id: Category ID (optional)
    - template_id: Template ID (optional)
    - parent_task_id: Parent task ID for subtasks (optional)
    - is_recurring: Whether task repeats (default: false)
    - tag_names: List of tag names (optional)
    """
    task_service = TaskService(db)
    task = await task_service.create_task(task_data, current_user.id)
    return task_service.to_task_response(task)


@router.post("/bulk-update", response_model=List[TaskResponse])
async def bulk_update_tasks(
    bulk_update_data: TaskBulkUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """
    Bulk update multiple tasks.

    Allows updating multiple tasks with the same changes.
    """
    task_service = TaskService(db)
    updated_tasks = task_service.bulk_update_tasks(bulk_update_data, current_user.id)
    return [task_service.to_task_response(task) for task in updated_tasks]


@router.post("/export")
async def export_tasks(
    export_request: TaskExportRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """
    Export tasks in various formats.

    Supports CSV and JSON export with filtering options.
    """
    task_service = TaskService(db)
    try:
        exported_data = task_service.export_tasks(export_request, current_user.id)
        
        if export_request.format.lower() == 'csv':
            return PlainTextResponse(
                content=exported_data,
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=tasks_export.csv"}
            )
        elif export_request.format.lower() == 'json':
            return PlainTextResponse(
                content=exported_data,
                media_type="application/json",
                headers={"Content-Disposition": "attachment; filename=tasks_export.json"}
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported export format: {export_request.format}"
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reward-types")
async def get_reward_types():
    """
    Get available reward types.

    Returns the list of supported reward types for task creation.
    """
    return {
        "reward_types": [
            {"value": RewardType.POINTS, "label": "Points", "description": "Gamification points"},
            {"value": RewardType.MONETARY, "label": "Money", "description": "Monetary rewards"},
            {"value": RewardType.TIME, "label": "Time", "description": "Time-based rewards"},
            {"value": RewardType.CUSTOM, "label": "Custom", "description": "Custom rewards"},
        ]
    }


@router.get("/", response_model=TaskList)
async def get_tasks(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    status: Optional[TaskStatus] = Query(
        None, description="Filter by task status"
    ),
    priority: Optional[TaskPriority] = Query(
        None, description="Filter by task priority"
    ),
    category_id: Optional[int] = Query(
        None, description="Filter by category ID"
    ),
    assigned_to_id: Optional[int] = Query(
        None, description="Filter by assigned user ID"
    ),
    reward_type: Optional[RewardType] = Query(
        None, description="Filter by reward type"
    ),
    search: Optional[str] = Query(
        None, description="Search in title and description"
    ),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get tasks with filtering and pagination.

    Supports filtering by status, priority, category, assigned user, reward type,
    and text search. Requires authentication with an active user account.

    Query Parameters:
    - skip: Number of records to skip (default: 0)
    - limit: Maximum number of records to return (default: 100, max: 1000)
    - status: Filter by task status (optional)
    - priority: Filter by task priority (optional)
    - category_id: Filter by category ID (optional)
    - assigned_to_id: Filter by assigned user ID (optional)
    - reward_type: Filter by reward type (optional)
    - search: Search in title and description (optional)

    Returns:
    - tasks: List of tasks matching filters
    - total: Total number of matching tasks
    - page: Current page number
    - size: Page size
    - pages: Total number of pages
    """
    task_service = TaskService(db)
    tasks, total = task_service.get_tasks(
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        status=status,
        priority=priority,
        category_id=category_id,
        assigned_to_id=assigned_to_id,
        reward_type=reward_type,
        search=search,
    )

    # Convert Task model instances to TaskResponse dictionaries
    task_responses = [task_service.to_task_response(task) for task in tasks]

    pages = (total + limit - 1) // limit
    page = (skip // limit) + 1

    return TaskList(
        tasks=task_responses, total=total, page=page, size=limit, pages=pages
    )


# Task Templates
@router.post(
    "/templates",
    response_model=TaskTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_task_template(
    template_data: TaskTemplateCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new task template."""
    task_service = TaskService(db)
    template = task_service.create_task_template(
        template_data, current_user.id
    )
    return template


@router.get("/templates", response_model=List[TaskTemplateResponse])
async def get_task_templates(
    include_public: bool = Query(True, description="Include public templates"),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """Get task templates available to the user."""
    task_service = TaskService(db)
    templates = task_service.get_task_templates(
        current_user.id, include_public
    )
    return templates


@router.post(
    "/templates/create-from-template",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_task_from_template(
    request: CreateFromTemplateRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """Create a task from a template using JSON request body."""
    task_service = TaskService(db)
    task = await task_service.create_task_from_template(
        request.template_id,
        current_user.id,
        title=request.title,
        description=request.description,
        assigned_to_id=request.assigned_to_id,
        due_date=request.due_date,
        priority=request.priority,
        estimated_hours=request.estimated_hours,
        points=request.points
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    return task_service.to_task_response(task)


# Task Categories
@router.post(
    "/categories",
    response_model=TaskCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_task_category(
    category_data: TaskCategoryCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new task category."""
    task_service = TaskService(db)
    category = task_service.create_category(category_data, current_user.id)
    return category


@router.get("/categories", response_model=List[TaskCategoryResponse])
async def get_task_categories(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """Get task categories for the user."""
    task_service = TaskService(db)
    categories = task_service.get_categories(current_user.id)
    return categories


# Task Tags
@router.post(
    "/tags",
    response_model=TaskTagResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_task_tag(
    tag_data: TaskTagCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new task tag."""
    task_service = TaskService(db)
    tag = task_service.create_tag(tag_data, current_user.id)
    return tag


@router.get("/tags", response_model=List[TaskTagResponse])
async def get_task_tags(db: Session = Depends(get_db_session)):
    """Get all task tags."""
    task_service = TaskService(db)
    tags = task_service.get_tags()
    return tags


# JSON Request Body Endpoints (New API Design)


@router.post("/complete", response_model=TaskResponse)
async def complete_task_json(
    request: TaskCompleteRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """
    Mark a task as completed using JSON request body.
    Requires authentication with an active user account.

    Request Body:
    - task_id: ID of task to complete (required)
    - actual_hours: Actual hours spent on task (optional)

    Returns:
    - Updated task details with completed status
    """
    task_service = TaskService(db)
    task = await task_service.complete_task(request.task_id, current_user.id, request.actual_hours)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )

    return task_service.to_task_response(task)


@router.post("/delete", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_json(
    request: TaskDeleteRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a task using JSON request body."""
    task_service = TaskService(db)
    success = await task_service.delete_task(request.task_id, current_user.id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )


@router.post("/get", response_model=TaskResponse)
async def get_task_json(
    request: TaskGetRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific task by ID using JSON request body."""
    task_service = TaskService(db)
    task = task_service.get_task(request.task_id, current_user.id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )

    return task_service.to_task_response(task)


@router.post("/update", response_model=TaskResponse)
async def update_task_json(
    request: TaskUpdateRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """Update a task using JSON request body."""
    task_service = TaskService(db)
    try:
        task = await task_service.update_task(request.task_id, request.updates, current_user.id)

        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
            )

        return task_service.to_task_response(task)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Recurring Tasks
@router.get("/recurring", response_model=List[TaskResponse])
async def get_recurring_tasks(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """Get recurring tasks."""
    TaskService(db)
    # For now, return empty list - in a real app, you would filter for recurring tasks
    return []


@router.post("/recurring/create", status_code=status.HTTP_200_OK)
async def create_recurring_tasks(db: Session = Depends(get_db_session)):
    """Create recurring task instances based on patterns."""
    task_service = TaskService(db)
    created_count = task_service.create_recurring_tasks()

    return {
        "message": f"Created {created_count} recurring task instances",
        "created_count": created_count,
    }



