"""
Comment API endpoints for TaaskMaaster.

This module contains FastAPI routes for comment-related operations.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.core.logging import get_logger
from app.models.user import User
from app.schemas.comment import (
    CommentCreate,
    CommentListResponse,
    CommentResponse,
    CommentUpdate,
)
from app.services.comment_service import CommentService
from app.utils.pagination import PaginationParams

logger = get_logger(__name__)

router = APIRouter()

MAX_BULK = 50


@router.post("/", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    comment_data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new task comment.

    """
    user_id = current_user.id

    try:
        comment_service = CommentService(db)
        comment = comment_service.create_task_comment(
            task_id=comment_data.task_id,
            user_id=user_id,
            content=comment_data.content,
            content_type=comment_data.content_type,
            parent_comment_id=comment_data.parent_comment_id,
            media_attachment_ids=comment_data.media_attachment_ids,
        )

        logger.info(
            f"Created comment {comment.id} for task {comment_data.task_id} by user {user_id}"
        )
        return comment

    except ValueError as e:
        logger.warning(f"Failed to create comment: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error creating comment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.get("/task/{task_id}", response_model=CommentListResponse)
async def get_task_comments(
    task_id: int,
    skip: int = 0,
    limit: int = 100,
    include_system: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get comments for a specific task.

    **Query Parameters:**
    - skip: Number of comments to skip (pagination)
    - limit: Maximum number of comments to return
    - include_system: Whether to include system-generated comments
    """
    user_id = current_user.id

    try:
        comment_service = CommentService(db)

        # Create pagination parameters
        pagination_params = PaginationParams(skip=skip, limit=limit)

        # Call the service method with correct parameters
        result = comment_service.get_task_comments(
            task_id=task_id,
            user_id=user_id,
            pagination_params=pagination_params,
            include_system=include_system,
        )

        # Extract comments and total from the result
        comments = result.items
        total = result.total

        return CommentListResponse(comments=comments, total=total, skip=skip, limit=limit)

    except ValueError as e:
        logger.warning(f"Failed to get task comments: {e}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error getting task comments: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.get("/{comment_id}", response_model=CommentResponse)
async def get_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get a specific comment by ID.

    """
    user_id = current_user.id

    try:
        comment_service = CommentService(db)
        comment = comment_service.get_comment_by_id(comment_id, user_id)

        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Comment {comment_id} not found"
            )

        return comment

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error getting comment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.put("/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: int,
    comment_update: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Update a comment (only by the comment author).

    """
    user_id = current_user.id

    try:
        comment_service = CommentService(db)
        comment = comment_service.update_task_comment(
            comment_id=comment_id,
            user_id=user_id,
            content=comment_update.content,
            content_type=comment_update.content_type,
            edit_reason=getattr(comment_update, "edit_reason", None),
        )

        logger.info(f"Updated comment {comment_id} by user {user_id}")
        return comment

    except ValueError as e:
        logger.warning(f"Failed to update comment: {e}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error updating comment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Delete a comment (only by the comment author or task owner).

    """
    user_id = current_user.id

    try:
        comment_service = CommentService(db)
        success = comment_service.delete_task_comment(comment_id, user_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Comment {comment_id} not found"
            )

        logger.info(f"Deleted comment {comment_id} by user {user_id}")

    except ValueError as e:
        logger.warning(f"Failed to delete comment: {e}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error deleting comment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.post("/{comment_id}/media/{media_id}", status_code=status.HTTP_201_CREATED)
async def add_comment_media(
    comment_id: int,
    media_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Add media attachment to a comment.

    """
    user_id = current_user.id

    try:
        comment_service = CommentService(db)
        attachment = comment_service.add_comment_media_attachment(
            comment_id=comment_id,
            media_attachment_id=media_id,
            user_id=user_id,
        )

        logger.info(f"Added media {media_id} to comment {comment_id} by user {user_id}")
        return {"message": "Media attachment added successfully"}

    except ValueError as e:
        logger.warning(f"Failed to add comment media: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error adding comment media: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.delete("/{comment_id}/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_comment_media(
    comment_id: int,
    media_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Remove media attachment from a comment.

    """
    user_id = current_user.id

    try:
        comment_service = CommentService(db)
        success = comment_service.remove_comment_media_attachment(
            comment_id=comment_id,
            media_attachment_id=media_id,
            user_id=user_id,
        )

        logger.info(f"Removed media {media_id} from comment {comment_id} by user {user_id}")

    except ValueError as e:
        logger.warning(f"Failed to remove comment media: {e}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error removing comment media: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.get("/{comment_id}/history")
async def get_comment_edit_history(
    comment_id: int,
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum number of records"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get edit history for a comment.

    **Response:**
    ```json
    {
      "comment_id": 123,
      "history": [
        {
          "id": 456,
          "action": "updated",
          "user_id": 789,
          "created_at": "2024-01-15T10:30:00Z",
          "original_content": "Original content",
          "new_content": "Updated content",
          "edit_reason": "Fixed typo"
        }
      ],
      "total": 5
    }
    ```
    """
    user_id = current_user.id

    try:
        comment_service = CommentService(db)
        history = comment_service.get_comment_edit_history(
            comment_id=comment_id, user_id=user_id, skip=skip, limit=limit
        )

        return {"comment_id": comment_id, "history": history, "total": len(history)}

    except ValueError as e:
        logger.warning(f"Failed to get comment edit history: {e}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error getting comment edit history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


# Bulk Operations
@router.post("/bulk/delete")
async def bulk_delete_comments(
    comment_ids: list[int],
    deletion_reason: str | None = None,
    soft_delete: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Bulk delete multiple comments.

    **Request Body:**
    ```json
    {
      "comment_ids": [123, 456, 789],
      "deletion_reason": "Spam cleanup",
      "soft_delete": true
    }
    ```

    **Response:**
    ```json
    {
      "total_requested": 3,
      "success_count": 2,
      "failure_count": 1,
      "successful": [
        {"comment_id": 123, "message": "Successfully deleted"},
        {"comment_id": 456, "message": "Successfully deleted"}
      ],
      "failed": [
        {"comment_id": 789, "error": "You can only delete your own comments"}
      ]
    }
    ```
    """
    user_id = current_user.id

    try:
        comment_service = CommentService(db)
        results = comment_service.bulk_delete_comments(
            comment_ids=comment_ids,
            user_id=user_id,
            deletion_reason=deletion_reason,
            soft_delete=soft_delete,
        )

        logger.info(
            f"Bulk delete: {results['success_count']}/{results['total_requested']} comments deleted by user {user_id}"
        )
        return results

    except Exception as e:
        logger.error(f"Unexpected error in bulk delete: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.post("/bulk/update")
async def bulk_update_comments(
    updates: list[dict],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Bulk update multiple comments.

    **Request Body:**
    ```json
    {
      "updates": [
        {
          "comment_id": 123,
          "content": "Updated content",
          "content_type": "markdown",
          "edit_reason": "Fixed typo"
        },
        {
          "comment_id": 456,
          "content": "Another update",
          "edit_reason": "Added more details"
        }
      ]
    }
    ```

    **Response:**
    ```json
    {
      "total_requested": 2,
      "success_count": 1,
      "failure_count": 1,
      "successful": [
        {"comment_id": 123, "message": "Successfully updated"}
      ],
      "failed": [
        {"comment_id": 456, "error": "You can only edit your own comments"}
      ]
    }
    ```
    """
    user_id = current_user.id

    try:
        comment_service = CommentService(db)
        results = comment_service.bulk_update_comments(updates=updates, user_id=user_id)

        logger.info(
            f"Bulk update: {results['success_count']}/{results['total_requested']} comments updated by user {user_id}"
        )
        return results

    except Exception as e:
        logger.error(f"Unexpected error in bulk update: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.post("/bulk/create")
async def bulk_create_comments(
    comments_data: list[dict],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Bulk create multiple comments.

    **Request Body:**
    ```json
    {
      "comments_data": [
        {
          "task_id": 123,
          "content": "First comment",
          "content_type": "markdown"
        },
        {
          "task_id": 456,
          "content": "Second comment",
          "parent_comment_id": 789
        }
      ]
    }
    ```

    **Response:**
    ```json
    {
      "total_requested": 2,
      "success_count": 2,
      "failure_count": 0,
      "successful": [
        {"task_id": 123, "comment_id": 1001, "message": "Successfully created"},
        {"task_id": 456, "comment_id": 1002, "message": "Successfully created"}
      ],
      "failed": []
    }
    ```
    """
    if len(comments_data) > MAX_BULK:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many comments at once. Send at most {MAX_BULK}.",
        )
    user_id = current_user.id

    try:
        comment_service = CommentService(db)
        results = comment_service.bulk_create_comments(comments_data=comments_data, user_id=user_id)

        logger.info(
            f"Bulk create: {results['success_count']}/{results['total_requested']} comments created by user {user_id}"
        )
        return results

    except Exception as e:
        logger.error(f"Unexpected error in bulk create: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )
