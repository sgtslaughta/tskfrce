"""
Notification schemas for TaaskMaaster.

This module contains Pydantic schemas for notification-related API operations.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class NotificationBase(BaseModel):
    """Base notification schema with common fields."""

    type: str = Field(..., description="Notification type")
    title: str = Field(..., max_length=255, description="Notification title")
    message: str = Field(..., description="Notification message")
    action_url: Optional[str] = Field(None, max_length=500, description="URL for notification action")
    data: Optional[Dict[str, Any]] = Field(None, description="Additional notification data")


class NotificationCreate(NotificationBase):
    """Schema for creating a new notification."""

    user_id: int = Field(..., description="User ID to send notification to")


class NotificationResponse(NotificationBase):
    """Schema for notification response."""

    id: int = Field(..., description="Notification ID")
    user_id: int = Field(..., description="User ID")
    is_read: bool = Field(..., description="Whether notification has been read")
    created_at: datetime = Field(..., description="Creation timestamp")
    read_at: Optional[datetime] = Field(None, description="Read timestamp")

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    """Schema for notification list response."""

    notifications: List[NotificationResponse] = Field(..., description="List of notifications")
    total: int = Field(..., description="Total number of notifications")
    unread_count: int = Field(..., description="Number of unread notifications")
    has_more: bool = Field(..., description="Whether there are more notifications")


class NotificationMarkReadRequest(BaseModel):
    """Schema for marking notifications as read."""

    notification_ids: List[int] = Field(..., description="List of notification IDs to mark as read")


class NotificationMarkReadResponse(BaseModel):
    """Schema for mark read response."""

    marked_read: int = Field(..., description="Number of notifications marked as read")
    success: bool = Field(..., description="Whether operation was successful")


class NotificationGetRequest(BaseModel):
    """Schema for getting notifications."""

    skip: int = Field(default=0, ge=0, description="Number of notifications to skip")
    limit: int = Field(default=50, ge=1, le=100, description="Maximum number of notifications to return")
    unread_only: bool = Field(default=False, description="Only return unread notifications")
    notification_types: Optional[List[str]] = Field(None, description="Filter by notification types")


class NotificationDeleteRequest(BaseModel):
    """Schema for deleting notifications."""

    notification_ids: List[int] = Field(..., description="List of notification IDs to delete")


class NotificationDeleteResponse(BaseModel):
    """Schema for delete response."""

    deleted: int = Field(..., description="Number of notifications deleted")
    success: bool = Field(..., description="Whether operation was successful")


class NotificationStatsResponse(BaseModel):
    """Schema for notification statistics."""

    total_notifications: int = Field(..., description="Total number of notifications")
    unread_count: int = Field(..., description="Number of unread notifications")
    read_count: int = Field(..., description="Number of read notifications")
    types: Dict[str, int] = Field(..., description="Count of notifications by type")
