"""
Goals API router for TaaskMaaster.

This module contains API endpoints for goal tracking and progress monitoring.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.models.goal import GoalStatus, GoalType
from app.schemas.goal import (
    GoalCreate,
    GoalList,
    GoalProgressCreate,
    GoalProgressList,
    GoalProgressResponse,
    GoalResponse,
    GoalUpdate,
)
from app.services.goal_service import GoalService

router = APIRouter(prefix="/api/v1/goals", tags=["goals"])


@router.post(
    "/", response_model=GoalResponse, status_code=status.HTTP_201_CREATED
)
async def create_goal(
    goal_data: GoalCreate,
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """
    Create a new goal.

    Supports different goal types: task_count, points, streak, time_spent,
    custom.
    """
    goal_service = GoalService(db)
    goal = goal_service.create_goal(goal_data, current_user_id)
    return goal


@router.get("/", response_model=GoalList)
async def get_goals(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    status: Optional[GoalStatus] = Query(
        None, description="Filter by goal status"
    ),
    goal_type: Optional[GoalType] = Query(
        None, description="Filter by goal type"
    ),
    is_completed: Optional[bool] = Query(
        None, description="Filter by completion status"
    ),
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """
    Get goals with filtering and pagination.

    Supports filtering by status, type, and completion status.
    """
    goal_service = GoalService(db)
    goals, total = goal_service.get_goals(
        user_id=current_user_id,
        skip=skip,
        limit=limit,
        status=status,
        goal_type=goal_type,
        is_completed=is_completed,
    )

    pages = (total + limit - 1) // limit
    page = (skip // limit) + 1

    return GoalList(
        goals=goals, total=total, page=page, size=limit, pages=pages
    )


@router.get("/progress", response_model=GoalProgressList)
async def get_all_goal_progress(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Get all goal progress entries."""
    GoalService(db)
    # For now, return empty list - in a real app, you would get all progress entries
    return GoalProgressList(
        progress_entries=[], total=0, page=1, size=limit, pages=0
    )


@router.get("/statistics", response_model=dict)
async def get_goal_statistics(
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Get goal statistics."""
    GoalService(db)
    # For now, return empty statistics - in a real app, you would calculate statistics
    return {
        "total_goals": 0,
        "completed_goals": 0,
        "active_goals": 0,
        "completion_rate": 0.0,
    }


@router.get("/recurring", response_model=GoalList)
async def get_recurring_goals(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Get recurring goals."""
    GoalService(db)
    # For now, return empty list - in a real app, you would filter for recurring goals
    return GoalList(goals=[], total=0, page=1, size=limit, pages=0)


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(
    goal_id: int,
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Get a specific goal by ID."""
    goal_service = GoalService(db)
    goal = goal_service.get_goal(goal_id, current_user_id)

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    return goal


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: int,
    goal_data: GoalUpdate,
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Update a goal."""
    goal_service = GoalService(db)
    goal = goal_service.update_goal(goal_id, goal_data, current_user_id)

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    return goal


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Delete a goal."""
    goal_service = GoalService(db)
    success = goal_service.delete_goal(goal_id, current_user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )


# Goal Progress
@router.post(
    "/{goal_id}/progress",
    response_model=GoalProgressResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_goal_progress(
    goal_id: int,
    progress_data: GoalProgressCreate,
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Add progress to a goal."""
    goal_service = GoalService(db)
    progress = goal_service.add_progress(
        goal_id, progress_data, current_user_id
    )

    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    return progress


@router.get("/{goal_id}/progress", response_model=GoalProgressList)
async def get_goal_progress(
    goal_id: int,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Get progress entries for a goal."""
    goal_service = GoalService(db)
    progress_entries, total = goal_service.get_progress(
        goal_id, current_user_id, skip, limit
    )

    pages = (total + limit - 1) // limit
    page = (skip // limit) + 1

    return GoalProgressList(
        progress_entries=progress_entries,
        total=total,
        page=page,
        size=limit,
        pages=pages,
    )


# Goal Statistics
@router.get("/statistics")
async def get_goal_statistics(
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Get goal statistics for the user."""
    goal_service = GoalService(db)
    statistics = goal_service.get_goal_statistics(current_user_id)
    return statistics


# Goal Progress Updates
@router.post("/update-progress/tasks", status_code=status.HTTP_200_OK)
async def update_goal_progress_from_tasks(
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Update goal progress based on completed tasks."""
    goal_service = GoalService(db)
    updated_count = goal_service.update_goal_progress_from_tasks(
        current_user_id
    )

    return {
        "message": f"Updated {updated_count} task count goals",
        "updated_count": updated_count,
    }


@router.post("/update-progress/points", status_code=status.HTTP_200_OK)
async def update_goal_progress_from_points(
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Update goal progress based on points earned."""
    goal_service = GoalService(db)
    updated_count = goal_service.update_goal_progress_from_points(
        current_user_id
    )

    return {
        "message": f"Updated {updated_count} points goals",
        "updated_count": updated_count,
    }


# Recurring Goals
@router.post("/recurring/create", status_code=status.HTTP_200_OK)
async def create_recurring_goals(db: Session = Depends(get_db_session)):
    """Create recurring goal instances based on patterns."""
    goal_service = GoalService(db)
    created_count = goal_service.create_recurring_goals()

    return {
        "message": f"Created {created_count} recurring goal instances",
        "created_count": created_count,
    }
