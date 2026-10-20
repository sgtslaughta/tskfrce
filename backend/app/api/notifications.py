"""
Notification API endpoints for TaaskMaaster.

This module contains FastAPI routes for notification-related operations.
"""

import random

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db, require_parent
from app.core.logging import get_logger
from app.models.user import User
from app.schemas.notification import (
    NotificationDeleteRequest,
    NotificationDeleteResponse,
    NotificationGetRequest,
    NotificationListResponse,
    NotificationMarkReadRequest,
    NotificationMarkReadResponse,
    NotificationStatsResponse,
)
from app.services.notification_persistence_service import NotificationPersistenceService
from app.services.notification_service import NotificationService

logger = get_logger(__name__)

router = APIRouter()


@router.post("/", response_model=NotificationListResponse)
async def get_notifications(
    request_data: NotificationGetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get notifications for the current user.

    **Request Body:**
    ```json
    {
        "skip": 0,
        "limit": 50,
        "unread_only": false,
        "notification_types": ["task_comment", "task_assigned"]
    }
    ```
    """
    user_id = current_user.id

    try:
        notification_service = NotificationPersistenceService(db)
        result = notification_service.get_user_notifications(
            user_id=user_id,
            skip=request_data.skip,
            limit=request_data.limit,
            unread_only=request_data.unread_only,
            notification_types=request_data.notification_types,
        )

        logger.info(f"Retrieved {len(result['notifications'])} notifications for user {user_id}")
        return result

    except Exception as e:
        logger.error(f"Error retrieving notifications for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.post("/mark-read", response_model=NotificationMarkReadResponse)
async def mark_notifications_read(
    request_data: NotificationMarkReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Mark notifications as read.

    **Request Body:**
    ```json
    {
        "notification_ids": [1, 2, 3]
    }
    ```
    """
    user_id = current_user.id

    try:
        notification_service = NotificationPersistenceService(db)
        marked_count = notification_service.mark_notifications_read(
            user_id=user_id, notification_ids=request_data.notification_ids
        )

        logger.info(f"Marked {marked_count} notifications as read for user {user_id}")
        return {"marked_read": marked_count, "success": True}

    except ValueError as e:
        logger.warning(f"Invalid request to mark notifications read: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error marking notifications read for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.post("/delete", response_model=NotificationDeleteResponse)
async def delete_notifications(
    request_data: NotificationDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Delete notifications.

    **Request Body:**
    ```json
    {
        "notification_ids": [1, 2, 3]
    }
    ```
    """
    user_id = current_user.id

    try:
        notification_service = NotificationPersistenceService(db)
        deleted_count = notification_service.delete_notifications(
            user_id=user_id, notification_ids=request_data.notification_ids
        )

        logger.info(f"Deleted {deleted_count} notifications for user {user_id}")
        return {"deleted": deleted_count, "success": True}

    except ValueError as e:
        logger.warning(f"Invalid request to delete notifications: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting notifications for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.get("/stats", response_model=NotificationStatsResponse)
async def get_notification_stats(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)
):
    """
    Get notification statistics for the current user.

    """
    user_id = current_user.id

    try:
        notification_service = NotificationPersistenceService(db)
        stats = notification_service.get_notification_stats(user_id)

        logger.info(f"Retrieved notification stats for user {user_id}")
        return stats

    except Exception as e:
        logger.error(f"Error retrieving notification stats for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.post("/mark-all-read", response_model=NotificationMarkReadResponse)
async def mark_all_notifications_read(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)
):
    """
    Mark all notifications as read for the current user.

    """
    user_id = current_user.id

    try:
        notification_service = NotificationPersistenceService(db)
        marked_count = notification_service.mark_all_notifications_read(user_id)

        logger.info(f"Marked all {marked_count} notifications as read for user {user_id}")
        return {"marked_read": marked_count, "success": True}

    except Exception as e:
        logger.error(f"Error marking all notifications read for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.post("/demo")
async def generate_demo_notifications(
    db: Session = Depends(get_db), current_user: User = Depends(require_parent)
):
    """
    Generate demo notifications for testing purposes.

    """
    user_id = current_user.id

    try:
        notification_service = NotificationService(db)

        # Demo notification templates
        demo_notifications = [
            {
                "title": "🎉 Task Completed Successfully!",
                "message": "Great job! Your task 'Build awesome notification system' has been completed.",
                "type": "task_completed",
                "priority": "high",
                "action_url": "/tasks/42",
            },
            {
                "title": "📝 New Comment Added",
                "message": "John Doe commented on your task: 'This looks fantastic! Great work on the implementation.'",
                "type": "task_comment",
                "priority": "medium",
                "action_url": "/tasks/17",
            },
            {
                "title": "⏰ Task Due Soon",
                "message": "Your task 'Review notification system' is due in 2 hours.",
                "type": "task_due_soon",
                "priority": "urgent",
                "action_url": "/tasks/23",
            },
            {
                "title": "👤 You were mentioned",
                "message": "Alice mentioned you in a comment: '@user great work on the dashboard improvements!'",
                "type": "user_mentioned",
                "priority": "medium",
                "action_url": "/tasks/15",
            },
            {
                "title": "🚀 New Task Assigned",
                "message": "A new task 'Implement user preferences' has been assigned to you.",
                "type": "task_assigned",
                "priority": "medium",
                "action_url": "/tasks/56",
            },
        ]

        # Generate 3 random demo notifications
        selected_demos = random.sample(demo_notifications, min(3, len(demo_notifications)))
        created_count = 0

        for demo in selected_demos:
            # Send notification (this will both store in DB and send via WebSocket)
            await notification_service._send_notification(
                recipients=[user_id],
                notification_type=demo["type"],
                title=demo["title"],
                message=demo["message"],
                action_url=demo["action_url"],
                data={"priority": demo["priority"]},
            )
            created_count += 1

        logger.info(f"Generated {created_count} demo notifications for user {user_id}")
        return {
            "created": created_count,
            "message": f"Successfully generated {created_count} demo notifications",
            "success": True,
        }

    except Exception as e:
        logger.error(f"Error generating demo notifications for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate demo notifications",
        )
