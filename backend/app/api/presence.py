"""
Presence API endpoints for TaaskMaaster.

This module contains FastAPI routes for user presence and activity tracking.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.core.logging import get_logger
from app.models.user import User
from app.services.presence_service import ActivityType, PresenceService, PresenceStatus

logger = get_logger(__name__)

router = APIRouter()


@router.post("/status")
async def update_presence_status(
    status: PresenceStatus,
    custom_message: str | None = None,
    activity_type: ActivityType | None = None,
    context_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Update user's presence status.

    **Request Body:**
    ```json
    {
      "status": "online",
      "custom_message": "Working on project tasks",
      "activity_type": "viewing_task",
      "context_id": 123
    }
    ```

    **Response:**
    ```json
    {
      "user_id": 456,
      "status": "online",
      "custom_message": "Working on project tasks",
      "last_seen": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
    ```
    """
    user_id = current_user.id

    try:
        presence_service = PresenceService(db)
        user_status = await presence_service.update_user_presence(
            user_id=user_id,
            status=status,
            custom_message=custom_message,
            activity_type=activity_type,
            context_id=context_id,
        )

        return {
            "user_id": user_status.user_id,
            "status": user_status.status,
            "custom_message": user_status.custom_message,
            "last_seen": user_status.last_seen,
            "updated_at": user_status.updated_at,
        }

    except Exception as e:
        logger.error(f"Error updating presence status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.post("/activity")
async def set_user_activity(
    activity_type: ActivityType,
    context_id: int | None = None,
    metadata: dict | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Set user's current activity.

    **Request Body:**
    ```json
    {
      "activity_type": "viewing_task",
      "context_id": 123,
      "metadata": {"section": "comments"}
    }
    ```
    """
    user_id = current_user.id

    try:
        presence_service = PresenceService(db)
        await presence_service.set_user_activity(
            user_id=user_id, activity_type=activity_type, context_id=context_id, metadata=metadata
        )

        return {"message": "Activity updated successfully"}

    except Exception as e:
        logger.error(f"Error setting user activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.delete("/activity")
async def clear_user_activity(
    activity_type: ActivityType | None = None,
    context_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Clear user's current activity.

    **Query Parameters:**
    - activity_type: Optional specific activity type to clear
    - context_id: Optional context ID
    """
    user_id = current_user.id

    try:
        presence_service = PresenceService(db)
        await presence_service.clear_user_activity(
            user_id=user_id, activity_type=activity_type, context_id=context_id
        )

        return {"message": "Activity cleared successfully"}

    except Exception as e:
        logger.error(f"Error clearing user activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.get("/status/{user_id}")
async def get_user_presence(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get a user's current presence information.

    **Response:**
    ```json
    {
      "user_id": 123,
      "status": "online",
      "custom_message": "In a meeting",
      "last_seen": "2024-01-15T10:30:00Z",
      "activity_type": "viewing_task",
      "context_id": 456,
      "user": {
        "id": 123,
        "username": "john_doe",
        "first_name": "John",
        "last_name": "Doe"
      }
    }
    ```
    """

    try:
        presence_service = PresenceService(db)
        presence = await presence_service.get_user_presence(user_id)

        if not presence:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Presence information for user {user_id} not found",
            )

        return presence

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user presence: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.get("/online")
async def get_online_users(
    limit: int = Query(default=50, le=100, description="Maximum number of users"),
    include_activity: bool = Query(default=False, description="Include activity information"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get list of currently online users.

    **Query Parameters:**
    - limit: Maximum number of users to return
    - include_activity: Whether to include activity information

    **Response:**
    ```json
    {
      "online_users": [
        {
          "user_id": 123,
          "status": "online",
          "custom_message": "Working on tasks",
          "last_seen": "2024-01-15T10:30:00Z",
          "user": {
            "id": 123,
            "username": "john_doe",
            "first_name": "John",
            "last_name": "Doe"
          },
          "activity_type": "viewing_task",
          "context_id": 456
        }
      ],
      "total": 15
    }
    ```
    """

    try:
        presence_service = PresenceService(db)
        online_users = await presence_service.get_online_users(
            limit=limit, include_activity=include_activity
        )

        return {"online_users": online_users, "total": len(online_users)}

    except Exception as e:
        logger.error(f"Error getting online users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.get("/task/{task_id}/viewers")
async def get_task_viewers(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get users currently viewing a specific task.

    **Response:**
    ```json
    {
      "task_id": 123,
      "viewers": [
        {
          "user_id": 456,
          "status": "online",
          "user": {
            "id": 456,
            "username": "jane_doe",
            "first_name": "Jane",
            "last_name": "Doe"
          },
          "activity_type": "viewing_task",
          "context_id": 123
        }
      ],
      "total": 1
    }
    ```
    """

    try:
        presence_service = PresenceService(db)
        viewers = await presence_service.get_task_viewers(task_id)

        return {"task_id": task_id, "viewers": viewers, "total": len(viewers)}

    except Exception as e:
        logger.error(f"Error getting task viewers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.get("/typing/{context}")
async def get_typing_users(
    context: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get users currently typing in a specific context.

    **Path Parameters:**
    - context: Context identifier (e.g., "task_123", "direct_456")

    **Response:**
    ```json
    {
      "context": "task_123",
      "typing_users": [
        {
          "user_id": 456,
          "user": {
            "id": 456,
            "username": "jane_doe",
            "first_name": "Jane",
            "last_name": "Doe"
          }
        }
      ],
      "total": 1
    }
    ```
    """

    try:
        presence_service = PresenceService(db)
        typing_users = await presence_service.get_typing_users(context)

        return {"context": context, "typing_users": typing_users, "total": len(typing_users)}

    except Exception as e:
        logger.error(f"Error getting typing users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.post("/cleanup")
async def cleanup_stale_presence(
    max_age_minutes: int = Query(default=30, description="Maximum age in minutes"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Clean up stale presence data (admin only).

    **Query Parameters:**
    - max_age_minutes: Maximum age in minutes before considering presence stale

    **Response:**
    ```json
    {
      "cleaned_up": 5,
      "message": "Cleaned up 5 stale presence records"
    }
    ```
    """
    # TODO: Add admin role check

    try:
        presence_service = PresenceService(db)
        cleaned_up = await presence_service.cleanup_stale_presence(max_age_minutes)

        return {
            "cleaned_up": cleaned_up,
            "message": f"Cleaned up {cleaned_up} stale presence records",
        }

    except Exception as e:
        logger.error(f"Error cleaning up stale presence: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )
