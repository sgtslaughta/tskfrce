"""
Media API router for TaaskMaaster.

This module contains API endpoints for media attachment and file management.
"""

import io

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.models.media import MediaType
from app.schemas.media import (
    FileUploadRequest,
    MediaAttachmentCreate,
    MediaAttachmentList,
    MediaAttachmentResponse,
)
from app.services.media_service import MediaService

router = APIRouter(prefix="/api/v1/media", tags=["media"])


@router.get("/attachments", response_model=MediaAttachmentList)
async def get_user_attachments(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    media_type: MediaType | None = Query(None, description="Filter by media type"),
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Get media attachments for the current user."""
    media_service = MediaService(db)
    attachments, total = media_service.get_user_attachments(
        user_id=current_user_id, skip=skip, limit=limit, media_type=media_type
    )

    pages = (total + limit - 1) // limit
    page = (skip // limit) + 1

    return MediaAttachmentList(
        attachments=attachments,
        total=total,
        page=page,
        size=limit,
        pages=pages,
    )


@router.get("/attachments/{attachment_id}", response_model=MediaAttachmentResponse)
async def get_media_attachment(
    attachment_id: int,
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Get a specific media attachment by ID."""
    media_service = MediaService(db)
    attachment = media_service.get_media_attachment(attachment_id, current_user_id)

    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media attachment not found",
        )

    return attachment


@router.get("/upload/validate")
async def validate_file_upload(
    filename: str = Query("test.jpg", description="File name"),
    file_size: int = Query(1024, ge=1, description="File size in bytes"),
    mime_type: str = Query("image/jpeg", description="MIME type"),
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Validate a file upload request."""
    media_service = MediaService(db)

    # Create a mock upload request for validation
    from app.schemas.media import FileUploadRequest

    upload_request = FileUploadRequest(filename=filename, file_size=file_size, mime_type=mime_type)

    validation_result = media_service.validate_file_upload(upload_request)
    return validation_result


@router.get("/tasks/{task_id}/attachments", response_model=MediaAttachmentList)
async def get_task_attachments(
    task_id: int,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Get media attachments for a specific task."""
    media_service = MediaService(db)
    attachments, total = media_service.get_task_attachments(
        task_id=task_id, user_id=current_user_id, skip=skip, limit=limit
    )

    pages = (total + limit - 1) // limit
    page = (skip // limit) + 1

    return MediaAttachmentList(
        attachments=attachments,
        total=total,
        page=page,
        size=limit,
        pages=pages,
    )


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media_attachment(
    attachment_id: int,
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Delete a media attachment."""
    media_service = MediaService(db)
    success = media_service.delete_media_attachment(attachment_id, current_user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media attachment not found",
        )


@router.post("/upload/validate", status_code=status.HTTP_200_OK)
async def validate_file_upload(  # noqa: F811 - legacy duplicate def
    upload_request: FileUploadRequest, db: Session = Depends(get_db_session)
):
    """Validate a file upload request."""
    media_service = MediaService(db)
    validation_result = media_service.validate_file_upload(upload_request)
    return validation_result


@router.get("/statistics")
async def get_storage_statistics(
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Get storage statistics for the current user."""
    media_service = MediaService(db)
    statistics = media_service.get_storage_statistics(current_user_id)
    return statistics


@router.get("/attachments/{attachment_id}/download-url")
async def get_download_url(
    attachment_id: int,
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Get the download URL for a media attachment."""
    media_service = MediaService(db)
    download_url = media_service.get_download_url(attachment_id, current_user_id)

    if not download_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found or access denied",
        )

    return {"download_url": download_url, "attachment_id": attachment_id}


@router.get("/files/{key:path}")
async def get_file(key: str, db: Session = Depends(get_db_session)):
    """Serve an uploaded file."""
    try:
        path = MediaService(db).storage.open(key)
    except (ValueError, FileNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found. Check the link or upload it again.",
        )
    return FileResponse(path)


@router.post("/upload", response_model=MediaAttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    task_id: int | None = Form(None),
    description: str | None = Form(None),
    db: Session = Depends(get_db_session),
    # TODO: Add authentication dependency
    current_user_id: int = 1,  # Temporary for development
):
    """Upload a file (multipart form) and attach it to the current user."""
    media_service = MediaService(db)
    data = await file.read()
    mime_type = file.content_type or "application/octet-stream"
    filename = file.filename or "upload"

    validation = media_service.validate_file_upload(
        FileUploadRequest(filename=filename, mime_type=mime_type, file_size=max(len(data), 1))
    )
    if not validation["valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Invalid upload", "errors": validation["errors"]},
        )

    return media_service.create_media_attachment(
        MediaAttachmentCreate(filename=filename, task_id=task_id, description=description),
        current_user_id,
        io.BytesIO(data),
        len(data),
        mime_type,
    )
