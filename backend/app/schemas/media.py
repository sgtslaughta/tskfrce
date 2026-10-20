"""
Media schemas for TaaskMaaster.

This module contains Pydantic schemas for media-related API operations.
"""

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from app.models.media import MediaType


class MediaAttachmentBase(BaseModel):
    """Base media attachment schema."""

    filename: str = Field(..., max_length=255, description="Original filename")
    description: Optional[str] = Field(None, description="File description")
    is_public: bool = Field(
        default=False, description="Whether file is publicly accessible"
    )


class MediaAttachmentCreate(MediaAttachmentBase):
    """Schema for creating a media attachment."""

    task_id: Optional[int] = Field(None, description="Associated task ID")
    metadata_json: Optional[Dict[str, Any]] = Field(
        None, description="Additional metadata"
    )


class MediaAttachmentUpdate(BaseModel):
    """Schema for updating a media attachment."""

    filename: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    is_public: Optional[bool] = None
    metadata_json: Optional[Dict[str, Any]] = None


class MediaAttachmentResponse(MediaAttachmentBase):
    """Schema for media attachment response data."""

    id: int
    file_path: str
    file_size: int
    mime_type: str
    media_type: MediaType
    task_id: Optional[int] = None
    user_id: int
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    # Computed properties
    file_size_mb: float
    is_image: bool
    is_video: bool
    is_audio: bool
    is_document: bool

    class Config:
        from_attributes = True


class MediaAttachmentList(BaseModel):
    """Schema for media attachment list response."""

    attachments: list[MediaAttachmentResponse]
    total: int
    page: int
    size: int
    pages: int


class FileUploadResponse(BaseModel):
    """Schema for file upload response."""

    attachment: MediaAttachmentResponse
    upload_url: Optional[str] = Field(
        None, description="URL for direct upload"
    )
    presigned_url: Optional[str] = Field(
        None, description="Presigned URL for upload"
    )


class FileUploadRequest(BaseModel):
    """Schema for file upload request."""

    filename: str = Field(..., max_length=255, description="Original filename")
    mime_type: str = Field(..., max_length=100, description="MIME type")
    file_size: int = Field(..., gt=0, description="File size in bytes")
    task_id: Optional[int] = Field(None, description="Associated task ID")
    description: Optional[str] = Field(None, description="File description")
    is_public: bool = Field(
        default=False, description="Whether file is publicly accessible"
    )
