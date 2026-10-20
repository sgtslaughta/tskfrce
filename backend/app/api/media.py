"""
Media API router for TaaskMaaster.

This module contains API endpoints for media attachment and file management.
"""

import io
import os

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.core.config import settings
from app.core.database import get_db_session
from app.models.media import MediaAttachment, MediaType
from app.models.user import User, UserRole
from app.schemas.media import (
    FileUploadRequest,
    MediaAttachmentCreate,
    MediaAttachmentList,
    MediaAttachmentResponse,
)
from app.services.media_service import MediaService
from app.services.permission_service import Permission, PermissionService

router = APIRouter(prefix="/api/v1/media", tags=["media"])


@router.get("/attachments", response_model=MediaAttachmentList)
async def get_user_attachments(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    media_type: MediaType | None = Query(None, description="Filter by media type"),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Get media attachments for the current user."""
    media_service = MediaService(db)
    attachments, total = media_service.get_user_attachments(
        user_id=current_user.id, skip=skip, limit=limit, media_type=media_type
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
    current_user: User = Depends(get_current_active_user),
):
    """Get a specific media attachment by ID."""
    media_service = MediaService(db)
    attachment = media_service.get_media_attachment(attachment_id, current_user.id)

    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media attachment not found",
        )

    return attachment


@router.get("/tasks/{task_id}/attachments", response_model=MediaAttachmentList)
async def get_task_attachments(
    task_id: int,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Get media attachments for a specific task."""
    media_service = MediaService(db)
    attachments, total = media_service.get_task_attachments(
        task_id=task_id, user_id=current_user.id, skip=skip, limit=limit
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
    current_user: User = Depends(get_current_active_user),
):
    """Delete a media attachment."""
    media_service = MediaService(db)
    success = media_service.delete_media_attachment(attachment_id, current_user.id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media attachment not found",
        )


@router.post("/upload/validate", status_code=status.HTTP_200_OK)
async def validate_file_upload(
    upload_request: FileUploadRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Validate a file upload request."""
    media_service = MediaService(db)
    validation_result = media_service.validate_file_upload(upload_request)
    return validation_result


@router.get("/statistics")
async def get_storage_statistics(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Get storage statistics for the current user."""
    media_service = MediaService(db)
    statistics = media_service.get_storage_statistics(current_user.id)
    return statistics


@router.get("/attachments/{attachment_id}/download-url")
async def get_download_url(
    attachment_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Get the download URL for a media attachment."""
    media_service = MediaService(db)
    download_url = media_service.get_download_url(attachment_id, current_user.id)

    if not download_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found or access denied",
        )

    return {"download_url": download_url, "attachment_id": attachment_id}


INLINE_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                ".gif": "image/gif", ".webp": "image/webp"}  # fmt: skip


def _can_see(db: Session, user: User, att: MediaAttachment) -> bool:
    """Owner, public, parent, or someone who can see the attachment's task."""
    if att.user_id == user.id or att.is_public or user.role == UserRole.PARENT:
        return True
    return att.task_id is not None and PermissionService(db).has_permission(
        user.id, Permission.TASK_VIEW, att.task_id, "task"
    )


@router.get("/files/{key:path}")
async def get_file(
    key: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Serve an uploaded file (images inline, everything else as a download)."""
    not_found = HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="File not found. Check the link or upload it again.",
    )
    att = db.query(MediaAttachment).filter(MediaAttachment.file_path == key).first()
    if att is None or not _can_see(db, current_user, att):
        raise not_found
    try:
        path = MediaService(db).storage.open(key)
    except (ValueError, FileNotFoundError):
        raise not_found from None
    inline = INLINE_TYPES.get(path.suffix.lower())
    return FileResponse(
        path,
        filename=path.name,
        media_type=inline or "application/octet-stream",
        content_disposition_type="inline" if inline else "attachment",
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.post("/upload", response_model=MediaAttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    task_id: int | None = Form(None),
    description: str | None = Form(None),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Upload a file (multipart form) and attach it to the current user."""
    if task_id is not None and not (
        current_user.role == UserRole.PARENT
        or PermissionService(db).has_permission(
            current_user.id, Permission.TASK_VIEW, task_id, "task"
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found. Check the task and try again.",
        )
    media_service = MediaService(db)
    max_size = settings.MAX_UPLOAD_SIZE
    too_big = HTTPException(
        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        detail=f"File is too large. The limit is {max_size // (1024 * 1024) or 1} MB; choose a smaller file.",
    )
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > max_size + 1024 * 1024:
        raise too_big
    chunks, total = [], 0
    while chunk := await file.read(64 * 1024):
        total += len(chunk)
        if total > max_size:
            raise too_big
        chunks.append(chunk)
    data = b"".join(chunks)
    mime_type = file.content_type or "application/octet-stream"
    filename = file.filename or "upload"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS or ext in (".svg", ".html", ".htm"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This file type is not allowed. Upload an image, document, audio, video or archive.",
        )

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
        current_user.id,
        io.BytesIO(data),
        len(data),
        mime_type,
    )
