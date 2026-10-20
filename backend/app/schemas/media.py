"""
Media schemas for TaaskMaaster.

This module contains Pydantic schemas for media-related API operations.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.media import MediaType


class MediaAttachmentBase(BaseModel):
    """Base media attachment schema."""

    filename: str = Field(..., max_length=255, description="Original filename")
    description: str | None = Field(None, description="File description")
    is_public: bool = Field(default=False, description="Whether file is publicly accessible")


class MediaAttachmentCreate(MediaAttachmentBase):
    """Schema for creating a media attachment."""

    task_id: int | None = Field(None, description="Associated task ID")
    metadata_json: dict[str, Any] | None = Field(None, description="Additional metadata")


class MediaAttachmentUpdate(BaseModel):
    """Schema for updating a media attachment."""

    filename: str | None = Field(None, max_length=255)
    description: str | None = None
    is_public: bool | None = None
    metadata_json: dict[str, Any] | None = None


class MediaAttachmentResponse(MediaAttachmentBase):
    """Schema for media attachment response data."""

    id: int
    file_path: str
    file_size: int
    mime_type: str
    media_type: MediaType
    task_id: int | None = None
    user_id: int
    metadata_json: dict[str, Any] | None = None
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
    upload_url: str | None = Field(None, description="URL for direct upload")
    presigned_url: str | None = Field(None, description="Presigned URL for upload")


class FileUploadRequest(BaseModel):
    """Schema for file upload request."""

    filename: str = Field(..., max_length=255, description="Original filename")
    mime_type: str = Field(..., max_length=100, description="MIME type")
    file_size: int = Field(..., gt=0, description="File size in bytes")
    task_id: int | None = Field(None, description="Associated task ID")
    description: str | None = Field(None, description="File description")
    is_public: bool = Field(default=False, description="Whether file is publicly accessible")
