"""
Media service for TaaskMaaster.

This module contains business logic for media attachment and file management.
"""

import os
import re
import uuid
from typing import Any, BinaryIO

from sqlalchemy import and_, desc, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.models.media import MediaAttachment, MediaType
from app.schemas.media import FileUploadRequest, MediaAttachmentCreate
from app.services.local_storage import LocalStorage

logger = get_logger(__name__)


class MediaService:
    """Service for media management operations."""

    def __init__(self, db: Session):
        """Initialize media service with database session."""
        self.db = db
        self.storage = LocalStorage(settings.DATA_DIR / "uploads")

    def create_media_attachment(
        self,
        attachment_data: MediaAttachmentCreate,
        user_id: int,
        file_data: BinaryIO,
        file_size: int,
        mime_type: str,
    ) -> MediaAttachment:
        """
        Create a new media attachment and save it to local disk.

        Args:
            attachment_data: Attachment creation data
            user_id: ID of user uploading the file
            file_data: File data as binary stream
            file_size: Size of file in bytes
            mime_type: MIME type of file

        Returns:
            Created media attachment instance
        """
        # Determine media type from MIME type
        media_type = self._get_media_type_from_mime(mime_type)

        # Generate unique storage key
        raw_ext = os.path.splitext(attachment_data.filename)[1].lower().lstrip(".")
        file_extension = f".{raw_ext}" if re.fullmatch(r"[a-z0-9]{1,8}", raw_ext) else ""
        object_name = f"{user_id}/{uuid.uuid4()}{file_extension}"

        # Save file
        self.storage.save(object_name, file_data.read(), mime_type)

        attachment = MediaAttachment(
            filename=attachment_data.filename,
            file_path=object_name,  # Store storage key
            file_size=file_size,
            mime_type=mime_type,
            media_type=media_type,
            task_id=attachment_data.task_id,
            user_id=user_id,
            description=attachment_data.description,
            metadata_json=attachment_data.metadata_json,
            is_public=attachment_data.is_public,
        )

        self.db.add(attachment)
        self.db.commit()
        self.db.refresh(attachment)

        logger.info(f"Created media attachment {attachment.id} for user {user_id}")
        return attachment

    def get_media_attachment(self, attachment_id: int, user_id: int) -> MediaAttachment | None:
        """
        Get a media attachment by ID.

        Args:
            attachment_id: Attachment ID
            user_id: User ID for access control

        Returns:
            Media attachment instance or None
        """
        return (
            self.db.query(MediaAttachment)
            .filter(
                and_(
                    MediaAttachment.id == attachment_id,
                    or_(
                        MediaAttachment.user_id == user_id,
                        MediaAttachment.is_public,
                    ),
                )
            )
            .first()
        )

    def get_task_attachments(
        self, task_id: int, user_id: int, skip: int = 0, limit: int = 100
    ) -> tuple[list[MediaAttachment], int]:
        """
        Get media attachments for a task.

        Args:
            task_id: Task ID
            user_id: User ID for access control
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            Tuple of (attachments, total_count)
        """
        query = self.db.query(MediaAttachment).filter(
            and_(
                MediaAttachment.task_id == task_id,
                or_(
                    MediaAttachment.user_id == user_id,
                    MediaAttachment.is_public,
                ),
            )
        )

        total = query.count()
        attachments = (
            query.order_by(desc(MediaAttachment.created_at)).offset(skip).limit(limit).all()
        )

        return attachments, total

    def get_user_attachments(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
        media_type: MediaType | None = None,
    ) -> tuple[list[MediaAttachment], int]:
        """
        Get media attachments for a user.

        Args:
            user_id: User ID
            skip: Number of records to skip
            limit: Maximum number of records to return
            media_type: Filter by media type

        Returns:
            Tuple of (attachments, total_count)
        """
        query = self.db.query(MediaAttachment).filter(MediaAttachment.user_id == user_id)

        if media_type:
            query = query.filter(MediaAttachment.media_type == media_type)

        total = query.count()
        attachments = (
            query.order_by(desc(MediaAttachment.created_at)).offset(skip).limit(limit).all()
        )

        return attachments, total

    def _get_media_type_from_mime(self, mime_type: str) -> MediaType:
        """
        Determine media type from MIME type.

        Args:
            mime_type: MIME type string

        Returns:
            MediaType enum value
        """
        if mime_type.startswith("image/"):
            return MediaType.IMAGE
        elif mime_type.startswith("video/"):
            return MediaType.VIDEO
        elif mime_type.startswith("audio/"):
            return MediaType.AUDIO
        elif mime_type.startswith("application/"):
            # Check for document types
            document_types = [
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "text/plain",
                "text/csv",
            ]
            if mime_type in document_types:
                return MediaType.DOCUMENT
            else:
                return MediaType.OTHER
        elif mime_type.startswith("text/"):
            return MediaType.DOCUMENT
        else:
            return MediaType.OTHER

    def get_storage_statistics(self, user_id: int) -> dict[str, Any]:
        """
        Get storage statistics for a user.

        Args:
            user_id: User ID

        Returns:
            Dictionary with storage statistics
        """
        attachments = (
            self.db.query(MediaAttachment).filter(MediaAttachment.user_id == user_id).all()
        )

        total_files = len(attachments)
        total_size = sum(att.file_size for att in attachments)
        total_size_mb = total_size / (1024 * 1024)

        # Count by media type
        type_counts = {}
        for media_type in MediaType:
            count = len([att for att in attachments if att.media_type == media_type])
            if count > 0:
                type_counts[media_type.value] = count

        return {
            "total_files": total_files,
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size_mb, 2),
            "files_by_type": type_counts,
        }

    def validate_file_upload(self, upload_request: FileUploadRequest) -> dict[str, Any]:
        """
        Validate a file upload request.

        Args:
            upload_request: File upload request data

        Returns:
            Dictionary with validation results
        """
        errors = []
        warnings = []

        # Check file size (max 100MB)
        max_size = 100 * 1024 * 1024  # 100MB
        if upload_request.file_size > max_size:
            errors.append(
                f"File size {upload_request.file_size} exceeds maximum allowed size of {max_size}"
            )

        # Check file size (warning for files > 10MB)
        if upload_request.file_size > 10 * 1024 * 1024:  # 10MB
            warnings.append("Large file detected. Upload may take some time.")

        # Validate MIME type
        if not upload_request.mime_type:
            errors.append("MIME type is required")
        else:
            # Check if MIME type is supported
            media_type = self._get_media_type_from_mime(upload_request.mime_type)
            if media_type == MediaType.OTHER:
                warnings.append(f"MIME type '{upload_request.mime_type}' may not be supported")

        # Validate filename
        if not upload_request.filename:
            errors.append("Filename is required")
        elif len(upload_request.filename) > 255:
            errors.append("Filename is too long (max 255 characters)")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }

    def get_download_url(self, attachment_id: int, user_id: int) -> str | None:
        """Return the API path to download an attachment, or None if not accessible."""
        attachment = self.get_media_attachment(attachment_id, user_id)
        if not attachment:
            return None
        return f"/api/v1/media/files/{attachment.file_path}"

    def delete_media_attachment(self, attachment_id: int, user_id: int) -> bool:
        """
        Delete a media attachment and its file from disk.

        Args:
            attachment_id: Attachment ID
            user_id: User ID for access control

        Returns:
            True if successful, False otherwise
        """
        attachment = self.get_media_attachment(attachment_id, user_id)
        if not attachment:
            return False

        try:
            self.storage.delete(attachment.file_path)
            self.db.delete(attachment)
            self.db.commit()
            logger.info(f"Deleted media attachment {attachment_id} for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting media attachment: {e}")
            return False
