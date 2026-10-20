"""
Media service for TaaskMaaster.

This module contains business logic for media attachment and file management.
"""

import os
import uuid
from typing import Any, BinaryIO, Dict, List, Optional

from sqlalchemy import and_, desc, or_
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.media import MediaAttachment, MediaType
from app.schemas.media import FileUploadRequest, MediaAttachmentCreate
from app.services.storage_service import MinIOStorageService

logger = get_logger(__name__)


class MediaService:
    """Service for media management operations."""

    def __init__(self, db: Session):
        """Initialize media service with database session."""
        self.db = db
        try:
            self.storage_service = MinIOStorageService()
        except Exception as e:
            # Log the error but don't fail initialization
            logger.warning(f"MinIO storage service initialization failed: {e}")
            self.storage_service = None

    def create_media_attachment(
        self,
        attachment_data: MediaAttachmentCreate,
        user_id: int,
        file_data: BinaryIO,
        file_size: int,
        mime_type: str,
    ) -> MediaAttachment:
        """
        Create a new media attachment and upload to MinIO.

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

        # Generate unique object name for MinIO
        file_extension = os.path.splitext(attachment_data.filename)[1]
        object_name = f"uploads/{user_id}/{uuid.uuid4()}{file_extension}"

        # Upload file to MinIO
        if self.storage_service:
            try:
                self.storage_service.upload_file(
                    file_data=file_data,
                    object_name=object_name,
                    content_type=mime_type,
                    metadata={
                        "user_id": str(user_id),
                        "filename": attachment_data.filename,
                        "task_id": (
                            str(attachment_data.task_id)
                            if attachment_data.task_id
                            else ""
                        ),
                        "is_public": str(attachment_data.is_public),
                    },
                )
            except Exception as e:
                logger.error(f"Failed to upload file to MinIO: {e}")
                raise
        else:
            logger.warning(
                "MinIO storage service not available - "
                "file not uploaded to storage"
            )

        attachment = MediaAttachment(
            filename=attachment_data.filename,
            file_path=object_name,  # Store MinIO object key
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

        logger.info(
            f"Created media attachment {attachment.id} for user {user_id}"
        )
        return attachment

    def get_media_attachment(
        self, attachment_id: int, user_id: int
    ) -> Optional[MediaAttachment]:
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
    ) -> tuple[List[MediaAttachment], int]:
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
            query.order_by(desc(MediaAttachment.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

        return attachments, total

    def get_user_attachments(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
        media_type: Optional[MediaType] = None,
    ) -> tuple[List[MediaAttachment], int]:
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
        query = self.db.query(MediaAttachment).filter(
            MediaAttachment.user_id == user_id
        )

        if media_type:
            query = query.filter(MediaAttachment.media_type == media_type)

        total = query.count()
        attachments = (
            query.order_by(desc(MediaAttachment.created_at))
            .offset(skip)
            .limit(limit)
            .all()
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

    def get_storage_statistics(self, user_id: int) -> Dict[str, Any]:
        """
        Get storage statistics for a user.

        Args:
            user_id: User ID

        Returns:
            Dictionary with storage statistics
        """
        attachments = (
            self.db.query(MediaAttachment)
            .filter(MediaAttachment.user_id == user_id)
            .all()
        )

        total_files = len(attachments)
        total_size = sum(att.file_size for att in attachments)
        total_size_mb = total_size / (1024 * 1024)

        # Count by media type
        type_counts = {}
        for media_type in MediaType:
            count = len(
                [att for att in attachments if att.media_type == media_type]
            )
            if count > 0:
                type_counts[media_type.value] = count

        return {
            "total_files": total_files,
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size_mb, 2),
            "files_by_type": type_counts,
        }

    def validate_file_upload(
        self, upload_request: FileUploadRequest
    ) -> Dict[str, Any]:
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
                f"File size {upload_request.file_size} exceeds "
                f"maximum allowed size of {max_size}"
            )

        # Check file size (warning for files > 10MB)
        if upload_request.file_size > 10 * 1024 * 1024:  # 10MB
            warnings.append("Large file detected. Upload may take some time.")

        # Validate MIME type
        if not upload_request.mime_type:
            errors.append("MIME type is required")
        else:
            # Check if MIME type is supported
            media_type = self._get_media_type_from_mime(
                upload_request.mime_type
            )
            if media_type == MediaType.OTHER:
                warnings.append(
                    f"MIME type '{upload_request.mime_type}' "
                    f"may not be supported"
                )

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

    def get_download_url(
        self, attachment_id: int, user_id: int, expires: int = 3600
    ) -> Optional[str]:
        """
        Generate a presigned download URL for a media attachment.

        Args:
            attachment_id: Attachment ID
            user_id: User ID for access control
            expires: URL expiration time in seconds

        Returns:
            Presigned download URL or None if not found/accessible
        """
        if not self.storage_service:
            logger.warning("MinIO storage service not available")
            return None

        attachment = self.get_media_attachment(attachment_id, user_id)
        if not attachment:
            return None

        try:
            return self.storage_service.get_presigned_url(
                object_name=attachment.file_path, method="GET", expires=expires
            )
        except Exception as e:
            logger.error(f"Error generating download URL: {e}")
            return None

    def get_upload_url(
        self, filename: str, mime_type: str, user_id: int, expires: int = 3600
    ) -> Optional[str]:
        """
        Generate a presigned upload URL for direct file upload to MinIO.

        Args:
            filename: Original filename
            mime_type: MIME type of the file
            user_id: User ID
            expires: URL expiration time in seconds

        Returns:
            Presigned upload URL
        """
        if not self.storage_service:
            logger.warning("MinIO storage service not available")
            return None

        try:
            # Generate unique object name
            file_extension = os.path.splitext(filename)[1]
            object_name = f"uploads/{user_id}/{uuid.uuid4()}{file_extension}"

            return self.storage_service.get_upload_url(
                object_name=object_name,
                content_type=mime_type,
                expires=expires,
            )
        except Exception as e:
            logger.error(f"Error generating upload URL: {e}")
            return None

    def delete_media_attachment(
        self, attachment_id: int, user_id: int
    ) -> bool:
        """
        Delete a media attachment and its file from MinIO.

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
            # Delete from MinIO if available
            if self.storage_service:
                if self.storage_service.delete_file(attachment.file_path):
                    # Delete from database
                    self.db.delete(attachment)
                    self.db.commit()
                    logger.info(
                        f"Deleted media attachment {attachment_id} "
                        f"for user {user_id}"
                    )
                    return True
                else:
                    logger.error(
                        f"Failed to delete file from MinIO: "
                        f"{attachment.file_path}"
                    )
                    return False
            else:
                # MinIO not available, just delete from database
                self.db.delete(attachment)
                self.db.commit()
                logger.info(
                    f"Deleted media attachment {attachment_id} "
                    f"from database (MinIO not available)"
                )
                return True
        except Exception as e:
            logger.error(f"Error deleting media attachment: {e}")
            return False

    def get_minio_statistics(self) -> Dict[str, Any]:
        """
        Get MinIO storage statistics.

        Returns:
            MinIO storage statistics dictionary
        """
        if not self.storage_service:
            return {
                "total_files": 0,
                "total_size_bytes": 0,
                "total_size_mb": 0.0,
                "bucket_name": "unknown",
                "error": "MinIO storage service not available",
            }

        try:
            return self.storage_service.get_storage_statistics()
        except Exception as e:
            logger.error(f"Error getting MinIO statistics: {e}")
            return {
                "total_files": 0,
                "total_size_bytes": 0,
                "total_size_mb": 0.0,
                "bucket_name": "unknown",
                "error": str(e),
            }
