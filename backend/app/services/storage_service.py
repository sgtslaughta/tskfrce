"""
Storage service for TaaskMaaster.

This module contains MinIO storage operations for file management.
"""

import io
import os
from datetime import timedelta
from typing import Any, BinaryIO, Dict, Optional

from minio import Minio
from minio.error import S3Error

from app.core.logging import get_logger

logger = get_logger(__name__)


class MinIOStorageService:
    """Service for MinIO storage operations."""

    def __init__(self):
        """Initialize MinIO client."""
        self.client = Minio(
            os.getenv("MINIO_ENDPOINT", "minio:9000"),
            access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
            secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin123"),
            secure=os.getenv("MINIO_SECURE", "false").lower() == "true",
        )
        self.bucket_name = os.getenv("MINIO_BUCKET_NAME", "taaskmaaster-media")
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self) -> None:
        """Ensure the bucket exists, create if it doesn't."""
        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
                logger.info(f"Created MinIO bucket: {self.bucket_name}")
            else:
                logger.info(f"MinIO bucket exists: {self.bucket_name}")
        except S3Error as e:
            logger.error(f"Error ensuring bucket exists: {e}")
            raise

    def upload_file(
        self,
        file_data: BinaryIO,
        object_name: str,
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None,
    ) -> str:
        """
        Upload file to MinIO.

        Args:
            file_data: File data as binary stream
            object_name: Object name/key in MinIO
            content_type: MIME type of the file
            metadata: Additional metadata for the object

        Returns:
            Object name/key
        """
        try:
            # Get file size
            file_data.seek(0, 2)  # Seek to end
            file_size = file_data.tell()
            file_data.seek(0)  # Reset to beginning

            # Upload to MinIO
            self.client.put_object(
                bucket_name=self.bucket_name,
                object_name=object_name,
                data=file_data,
                length=file_size,
                content_type=content_type,
                metadata=metadata,
            )

            logger.info(
                f"Uploaded file to MinIO: {object_name} ({file_size} bytes)"
            )
            return object_name

        except S3Error as e:
            logger.error(f"Error uploading file to MinIO: {e}")
            raise

    def upload_file_from_bytes(
        self,
        file_data: bytes,
        object_name: str,
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None,
    ) -> str:
        """
        Upload file from bytes to MinIO.

        Args:
            file_data: File data as bytes
            object_name: Object name/key in MinIO
            content_type: MIME type of the file
            metadata: Additional metadata for the object

        Returns:
            Object name/key
        """
        file_stream = io.BytesIO(file_data)
        return self.upload_file(
            file_stream, object_name, content_type, metadata
        )

    def download_file(self, object_name: str) -> bytes:
        """
        Download file from MinIO.

        Args:
            object_name: Object name/key in MinIO

        Returns:
            File data as bytes
        """
        try:
            response = self.client.get_object(self.bucket_name, object_name)
            file_data = response.read()
            response.close()
            response.release_conn()

            logger.info(
                f"Downloaded file from MinIO: {object_name} "
                f"({len(file_data)} bytes)"
            )
            return file_data

        except S3Error as e:
            logger.error(f"Error downloading file from MinIO: {e}")
            raise

    def delete_file(self, object_name: str) -> bool:
        """
        Delete file from MinIO.

        Args:
            object_name: Object name/key in MinIO

        Returns:
            True if successful, False otherwise
        """
        try:
            self.client.remove_object(self.bucket_name, object_name)
            logger.info(f"Deleted file from MinIO: {object_name}")
            return True

        except S3Error as e:
            logger.error(f"Error deleting file from MinIO: {e}")
            return False

    def get_presigned_url(
        self, object_name: str, method: str = "GET", expires: int = 3600
    ) -> str:
        """
        Generate presigned URL for file access.

        Args:
            object_name: Object name/key in MinIO
            method: HTTP method (GET, PUT, POST)
            expires: URL expiration time in seconds

        Returns:
            Presigned URL
        """
        try:
            url = self.client.presigned_url(
                method=method,
                bucket_name=self.bucket_name,
                object_name=object_name,
                expires=timedelta(seconds=expires),
            )

            logger.info(
                f"Generated presigned URL for {object_name} "
                f"(expires in {expires}s)"
            )
            return url

        except S3Error as e:
            logger.error(f"Error generating presigned URL: {e}")
            raise

    def get_upload_url(
        self,
        object_name: str,
        content_type: Optional[str] = None,
        expires: int = 3600,
    ) -> str:
        """
        Generate presigned URL for file upload.

        Args:
            object_name: Object name/key in MinIO
            content_type: MIME type of the file
            expires: URL expiration time in seconds

        Returns:
            Presigned upload URL
        """
        try:
            url = self.client.presigned_put_object(
                bucket_name=self.bucket_name,
                object_name=object_name,
                expires=timedelta(seconds=expires),
            )

            logger.info(
                f"Generated upload URL for {object_name} "
                f"(expires in {expires}s)"
            )
            return url

        except S3Error as e:
            logger.error(f"Error generating upload URL: {e}")
            raise

    def file_exists(self, object_name: str) -> bool:
        """
        Check if file exists in MinIO.

        Args:
            object_name: Object name/key in MinIO

        Returns:
            True if file exists, False otherwise
        """
        try:
            self.client.stat_object(self.bucket_name, object_name)
            return True
        except S3Error:
            return False

    def get_file_info(self, object_name: str) -> Optional[Dict[str, Any]]:
        """
        Get file information from MinIO.

        Args:
            object_name: Object name/key in MinIO

        Returns:
            File information dictionary or None
        """
        try:
            stat = self.client.stat_object(self.bucket_name, object_name)
            return {
                "size": stat.size,
                "content_type": stat.content_type,
                "last_modified": stat.last_modified,
                "etag": stat.etag,
                "metadata": stat.metadata,
            }
        except S3Error as e:
            logger.error(f"Error getting file info: {e}")
            return None

    def get_storage_statistics(self) -> Dict[str, Any]:
        """
        Get storage statistics.

        Returns:
            Storage statistics dictionary
        """
        try:
            objects = list(
                self.client.list_objects(self.bucket_name, recursive=True)
            )

            total_files = len(objects)
            total_size = sum(obj.size for obj in objects)

            return {
                "total_files": total_files,
                "total_size_bytes": total_size,
                "total_size_mb": total_size / (1024 * 1024),
                "bucket_name": self.bucket_name,
            }

        except S3Error as e:
            logger.error(f"Error getting storage statistics: {e}")
            return {
                "total_files": 0,
                "total_size_bytes": 0,
                "total_size_mb": 0,
                "bucket_name": self.bucket_name,
                "error": str(e),
            }
