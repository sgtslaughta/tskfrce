"""
Presence API endpoints for TaaskMaaster.

This module contains FastAPI routes for user presence and activity tracking.
"""

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.logging import get_logger
from app.services.presence_service import PresenceService, PresenceStatus, ActivityType

logger = get_logger(__name__)

router = APIRouter()


def get_user_data_from_header(x_user_data: Optional[str] = Header(None)) -> dict:
    """
    Extract user data from X-User-Data header.
    
    Args:
        x_user_data: JSON string containing user data
        
    Returns:
        Dictionary with user data
        
    Raises:
        HTTPException: If header is missing or invalid
    """
    if not x_user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-User-Data header is required"
        )
    
    try:
        user_data = json.loads(x_user_data)
        if 'user_id' not in user_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_id is required in X-User-Data header"
            )
        return user_data
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON in X-User-Data header"
        )


@router.post("/status")
async def update_presence_status(
    status: PresenceStatus,
    custom_message: Optional[str] = None,
    activity_type: Optional[ActivityType] = None,
    context_id: Optional[int] = None,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Update user's presence status.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
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
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        presence_service = PresenceService(db)
        user_status = await presence_service.update_user_presence(
            user_id=user_id,
            status=status,
            custom_message=custom_message,
            activity_type=activity_type,
            context_id=context_id
        )
        
        return {
            "user_id": user_status.user_id,
            "status": user_status.status,
            "custom_message": user_status.custom_message,
            "last_seen": user_status.last_seen,
            "updated_at": user_status.updated_at
        }
        
    except Exception as e:
        logger.error(f"Error updating presence status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/activity")
async def set_user_activity(
    activity_type: ActivityType,
    context_id: Optional[int] = None,
    metadata: Optional[dict] = None,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Set user's current activity.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Request Body:**
    ```json
    {
      "activity_type": "viewing_task",
      "context_id": 123,
      "metadata": {"section": "comments"}
    }
    ```
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        presence_service = PresenceService(db)
        await presence_service.set_user_activity(
            user_id=user_id,
            activity_type=activity_type,
            context_id=context_id,
            metadata=metadata
        )
        
        return {"message": "Activity updated successfully"}
        
    except Exception as e:
        logger.error(f"Error setting user activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.delete("/activity")
async def clear_user_activity(
    activity_type: Optional[ActivityType] = None,
    context_id: Optional[int] = None,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Clear user's current activity.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Query Parameters:**
    - activity_type: Optional specific activity type to clear
    - context_id: Optional context ID
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        presence_service = PresenceService(db)
        await presence_service.clear_user_activity(
            user_id=user_id,
            activity_type=activity_type,
            context_id=context_id
        )
        
        return {"message": "Activity cleared successfully"}
        
    except Exception as e:
        logger.error(f"Error clearing user activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/status/{user_id}")
async def get_user_presence(
    user_id: int,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get a user's current presence information.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
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
    user_data = get_user_data_from_header(x_user_data)
    
    try:
        presence_service = PresenceService(db)
        presence = await presence_service.get_user_presence(user_id)
        
        if not presence:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Presence information for user {user_id} not found"
            )
        
        return presence
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user presence: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/online")
async def get_online_users(
    limit: int = Query(default=50, le=100, description="Maximum number of users"),
    include_activity: bool = Query(default=False, description="Include activity information"),
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get list of currently online users.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
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
    user_data = get_user_data_from_header(x_user_data)
    
    try:
        presence_service = PresenceService(db)
        online_users = await presence_service.get_online_users(
            limit=limit,
            include_activity=include_activity
        )
        
        return {
            "online_users": online_users,
            "total": len(online_users)
        }
        
    except Exception as e:
        logger.error(f"Error getting online users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/task/{task_id}/viewers")
async def get_task_viewers(
    task_id: int,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get users currently viewing a specific task.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
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
    user_data = get_user_data_from_header(x_user_data)
    
    try:
        presence_service = PresenceService(db)
        viewers = await presence_service.get_task_viewers(task_id)
        
        return {
            "task_id": task_id,
            "viewers": viewers,
            "total": len(viewers)
        }
        
    except Exception as e:
        logger.error(f"Error getting task viewers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/typing/{context}")
async def get_typing_users(
    context: str,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get users currently typing in a specific context.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
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
    user_data = get_user_data_from_header(x_user_data)
    
    try:
        presence_service = PresenceService(db)
        typing_users = await presence_service.get_typing_users(context)
        
        return {
            "context": context,
            "typing_users": typing_users,
            "total": len(typing_users)
        }
        
    except Exception as e:
        logger.error(f"Error getting typing users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/cleanup")
async def cleanup_stale_presence(
    max_age_minutes: int = Query(default=30, description="Maximum age in minutes"),
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Clean up stale presence data (admin only).
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
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
    user_data = get_user_data_from_header(x_user_data)
    # TODO: Add admin role check
    
    try:
        presence_service = PresenceService(db)
        cleaned_up = await presence_service.cleanup_stale_presence(max_age_minutes)
        
        return {
            "cleaned_up": cleaned_up,
            "message": f"Cleaned up {cleaned_up} stale presence records"
        }
        
    except Exception as e:
        logger.error(f"Error cleaning up stale presence: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
