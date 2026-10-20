"""
Comment schemas for TaaskMaaster API.

This module contains Pydantic models for comment-related API operations.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.media import MediaAttachmentResponse
from app.schemas.user import UserResponse


class CommentBase(BaseModel):
    """Base comment schema."""
    
    content: str = Field(..., min_length=1, max_length=10000, description="Comment content")
    content_type: str = Field(default="markdown", description="Content format (markdown, text, html)")
    parent_comment_id: Optional[int] = Field(None, description="Parent comment ID for replies")


class CommentCreate(CommentBase):
    """Schema for creating a comment."""
    
    task_id: int = Field(..., description="Task ID to comment on")
    media_attachment_ids: Optional[List[int]] = Field(default=None, description="List of media attachment IDs")


class CommentUpdate(BaseModel):
    """Schema for updating a comment."""
    
    content: str = Field(..., min_length=1, max_length=10000, description="Updated comment content")
    content_type: str = Field(default="markdown", description="Content format (markdown, text, html)")


class CommentResponse(BaseModel):
    """Schema for comment response."""
    
    id: int
    task_id: int
    user_id: int
    content: str
    content_type: str = Field(default="markdown", description="Content format (markdown, text, html)")
    parent_comment_id: Optional[int] = None
    is_system_generated: bool
    created_at: datetime
    updated_at: datetime
    
    # Relationships
    user: Optional[UserResponse] = None
    media_attachments: Optional[List[MediaAttachmentResponse]] = None
    replies: Optional[List["CommentResponse"]] = None
    
    class Config:
        from_attributes = True


class CommentListResponse(BaseModel):
    """Schema for paginated comment list response."""
    
    comments: List[CommentResponse]
    total: int
    skip: int
    limit: int


# Update forward reference
CommentResponse.model_rebuild()


class TaskStatusHistoryResponse(BaseModel):
    """Schema for task status history response."""
    
    id: int
    task_id: int
    user_id: int
    previous_status: Optional[str]
    new_status: str
    comment: Optional[str]
    created_at: datetime
    
    # Relationships
    user: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True


class TaskStatusHistoryListResponse(BaseModel):
    """Schema for paginated status history list response."""
    
    history: List[TaskStatusHistoryResponse]
    total: int
    skip: int
    limit: int
