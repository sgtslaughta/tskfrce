"""
Media models for TaaskMaaster.

This module contains models for media attachments and file management.
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.core.database import Base


class MediaType(str, Enum):
    """Media types."""

    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    ARCHIVE = "archive"
    OTHER = "other"


class MediaAttachment(Base):
    """
    Media attachment model for tasks and other entities.

    Attributes:
        id: Primary key
        filename: Original filename
        file_path: Storage path
        file_size: File size in bytes
        mime_type: MIME type
        media_type: Media type category
        task_id: Associated task
        user_id: User who uploaded the file
        description: File description
        metadata: Additional metadata (JSON)
        is_public: Whether file is publicly accessible
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "media_attachments"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    media_type = Column(SQLEnum(MediaType), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    description = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)  # Additional file metadata
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    task = relationship("Task", back_populates="media_attachments")
    user = relationship("User")
    comment_attachments = relationship("CommentMediaAttachment", back_populates="media")
    direct_message_attachments = relationship("DirectMessageMedia", back_populates="media_attachment")
    task_chat_attachments = relationship("TaskChatMessageMedia", back_populates="media_attachment")

    @property
    def file_size_mb(self) -> float:
        """Get file size in megabytes."""
        return self.file_size / (1024 * 1024)

    @property
    def is_image(self) -> bool:
        """Check if file is an image."""
        return self.media_type == MediaType.IMAGE

    @property
    def is_video(self) -> bool:
        """Check if file is a video."""
        return self.media_type == MediaType.VIDEO

    @property
    def is_audio(self) -> bool:
        """Check if file is an audio file."""
        return self.media_type == MediaType.AUDIO

    @property
    def is_document(self) -> bool:
        """Check if file is a document."""
        return self.media_type == MediaType.DOCUMENT

    def __repr__(self) -> str:
        """String representation of MediaAttachment."""
        return (
            f"<MediaAttachment(id={self.id}, filename='{self.filename}', "
            f"type='{self.media_type}')>"
        )
