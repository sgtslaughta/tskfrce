"""
Messaging schemas for TaaskMaaster API.

This module contains Pydantic models for messaging-related API operations.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.media import MediaAttachmentResponse
from app.schemas.user import UserResponse


class DirectMessageBase(BaseModel):
    """Base direct message schema."""
    
    content: str = Field(..., min_length=1, max_length=5000, description="Message content")
    content_type: str = Field(default="text", description="Content format (text, markdown)")
    thread_id: Optional[str] = Field(None, description="Thread ID for conversation grouping")


class DirectMessageCreate(DirectMessageBase):
    """Schema for creating a direct message."""
    
    to_user_id: int = Field(..., description="Recipient user ID")
    media_attachment_ids: Optional[List[int]] = Field(default=None, description="List of media attachment IDs")


class DirectMessageResponse(DirectMessageBase):
    """Schema for direct message response."""
    
    id: int
    from_user_id: int
    to_user_id: int
    is_read: bool
    created_at: datetime
    updated_at: datetime
    
    # Relationships
    from_user: Optional[UserResponse] = None
    to_user: Optional[UserResponse] = None
    media_attachments: Optional[List[MediaAttachmentResponse]] = None
    
    class Config:
        from_attributes = True


class DirectMessageListResponse(BaseModel):
    """Schema for paginated direct message list response."""
    
    messages: List[DirectMessageResponse]
    total: int
    skip: int
    limit: int


class TaskChatMessageBase(BaseModel):
    """Base task chat message schema."""
    
    content: str = Field(..., min_length=1, max_length=5000, description="Message content")
    content_type: str = Field(default="text", description="Content format (text, markdown)")
    parent_message_id: Optional[int] = Field(None, description="Parent message ID for replies")


class TaskChatMessageCreate(TaskChatMessageBase):
    """Schema for creating a task chat message."""
    
    task_id: int = Field(..., description="Task ID")
    media_attachment_ids: Optional[List[int]] = Field(default=None, description="List of media attachment IDs")


class TaskChatMessageResponse(TaskChatMessageBase):
    """Schema for task chat message response."""
    
    id: int
    task_id: int
    from_user_id: int
    created_at: datetime
    updated_at: datetime
    
    # Relationships
    from_user: Optional[UserResponse] = None
    media_attachments: Optional[List[MediaAttachmentResponse]] = None
    
    class Config:
        from_attributes = True


class TaskChatMessageListResponse(BaseModel):
    """Schema for paginated task chat message list response."""
    
    messages: List[TaskChatMessageResponse]
    total: int
    skip: int
    limit: int


class ConversationResponse(BaseModel):
    """Schema for conversation response."""
    
    other_user: Optional[UserResponse]
    latest_message: DirectMessageResponse
    unread_count: int


class ConversationListResponse(BaseModel):
    """Schema for conversation list response."""
    
    conversations: List[ConversationResponse]
    total: int


class MessageReadRequest(BaseModel):
    """Schema for marking messages as read."""
    
    message_ids: List[int] = Field(..., description="List of message IDs to mark as read")


class MessageHistoryRequest(BaseModel):
    """Schema for message history request."""
    
    other_user_id: Optional[int] = Field(None, description="Other user ID for direct messages")
    task_id: Optional[int] = Field(None, description="Task ID for task chat messages")
    before_timestamp: Optional[datetime] = Field(None, description="Get messages before this timestamp")
    limit: int = Field(default=50, le=100, description="Maximum number of messages")


class UserStatusBase(BaseModel):
    """Base user status schema."""
    
    status: str = Field(..., description="User status (online, away, busy, offline)")
    custom_message: Optional[str] = Field(None, max_length=255, description="Custom status message")


class UserStatusUpdate(UserStatusBase):
    """Schema for updating user status."""
    pass


class UserStatusResponse(UserStatusBase):
    """Schema for user status response."""
    
    id: int
    user_id: int
    last_seen: datetime
    updated_at: datetime
    
    # Relationships
    user: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True


class OnlineUsersResponse(BaseModel):
    """Schema for online users response."""
    
    online_users: List[UserStatusResponse]
    total: int


class TypingIndicatorRequest(BaseModel):
    """Schema for typing indicator request."""
    
    context_type: str = Field(..., description="Context type (task_chat, direct_message)")
    context_id: int = Field(..., description="Context ID (task_id or user_id)")
    is_typing: bool = Field(..., description="Whether user is typing")


class WebSocketMessage(BaseModel):
    """Schema for WebSocket messages."""
    
    type: str = Field(..., description="Message type")
    timestamp: datetime = Field(..., description="Message timestamp")
    data: dict = Field(..., description="Message data")


class NotificationMessage(WebSocketMessage):
    """Schema for notification messages."""
    
    notification_type: str = Field(..., description="Notification type")
    title: Optional[str] = Field(None, description="Notification title")
    message: str = Field(..., description="Notification message")
    action_url: Optional[str] = Field(None, description="Action URL")


class MessagingWebSocketMessage(WebSocketMessage):
    """Schema for messaging WebSocket messages."""
    
    message_type: str = Field(..., description="Message type (direct_message, task_chat_message, etc.)")
    sender: UserResponse = Field(..., description="Message sender")
    content: Optional[str] = Field(None, description="Message content")
    context: Optional[dict] = Field(None, description="Message context")
