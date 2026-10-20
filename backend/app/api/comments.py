"""
Comment API endpoints for TaaskMaaster.

This module contains FastAPI routes for comment-related operations.
"""

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.rate_limiting import CommentRateLimit, BulkOperationRateLimit
from app.core.logging import get_logger
from app.schemas.comment import (
    CommentCreate,
    CommentListResponse,
    CommentResponse,
    CommentUpdate,
    TaskStatusHistoryListResponse,
)
from app.utils.pagination import PaginationParams
from app.services.comment_service import CommentService

logger = get_logger(__name__)

router = APIRouter()


def get_user_data_from_header(x_user_data: Optional[str] = Header(None)) -> dict:
    """
    Extract user data from X-User-Data header.
    
    Args:
        x_user_data: JSON string containing user data
        
    Returns:
        Dictionary with user data
        
    Raises:
        HTTPException: If header is missing or invalid
    """
    if not x_user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-User-Data header is required"
        )
    
    try:
        user_data = json.loads(x_user_data)
        if 'user_id' not in user_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_id is required in X-User-Data header"
            )
        return user_data
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON in X-User-Data header"
        )


@router.post("/", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    comment_data: CommentCreate,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None),
    _rate_limit: bool = Depends(CommentRateLimit)
):
    """
    Create a new task comment.
    
    **Headers:**
    - X-User-Data: JSON containing user information
      ```json
      {
        "user_id": 123,
        "username": "john_doe",
        "role": "user"
      }
      ```
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
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
        
        logger.info(f"Created comment {comment.id} for task {comment_data.task_id} by user {user_id}")
        return comment
        
    except ValueError as e:
        logger.warning(f"Failed to create comment: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error creating comment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/task/{task_id}", response_model=CommentListResponse)
async def get_task_comments(
    task_id: int,
    skip: int = 0,
    limit: int = 100,
    include_system: bool = True,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get comments for a specific task.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Query Parameters:**
    - skip: Number of comments to skip (pagination)
    - limit: Maximum number of comments to return
    - include_system: Whether to include system-generated comments
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
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
        
        return CommentListResponse(
            comments=comments,
            total=total,
            skip=skip,
            limit=limit
        )
        
    except ValueError as e:
        logger.warning(f"Failed to get task comments: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error getting task comments: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/{comment_id}", response_model=CommentResponse)
async def get_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get a specific comment by ID.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        comment_service = CommentService(db)
        comment = comment_service.get_comment_by_id(comment_id, user_id)
        
        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Comment {comment_id} not found"
            )
        
        return comment
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error getting comment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.put("/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: int,
    comment_update: CommentUpdate,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Update a comment (only by the comment author).
    
    **Headers:**
    - X-User-Data: JSON containing user information
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        comment_service = CommentService(db)
        comment = comment_service.update_task_comment(
            comment_id=comment_id,
            user_id=user_id,
            content=comment_update.content,
            content_type=comment_update.content_type,
            edit_reason=getattr(comment_update, 'edit_reason', None),
        )
        
        logger.info(f"Updated comment {comment_id} by user {user_id}")
        return comment
        
    except ValueError as e:
        logger.warning(f"Failed to update comment: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error updating comment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Delete a comment (only by the comment author or task owner).
    
    **Headers:**
    - X-User-Data: JSON containing user information
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        comment_service = CommentService(db)
        success = comment_service.delete_task_comment(comment_id, user_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Comment {comment_id} not found"
            )
        
        logger.info(f"Deleted comment {comment_id} by user {user_id}")
        
    except ValueError as e:
        logger.warning(f"Failed to delete comment: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error deleting comment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/{comment_id}/media/{media_id}", status_code=status.HTTP_201_CREATED)
async def add_comment_media(
    comment_id: int,
    media_id: int,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Add media attachment to a comment.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error adding comment media: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.delete("/{comment_id}/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_comment_media(
    comment_id: int,
    media_id: int,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Remove media attachment from a comment.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
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
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error removing comment media: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/{comment_id}/history")
async def get_comment_edit_history(
    comment_id: int,
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum number of records"),
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get edit history for a comment.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
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
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        comment_service = CommentService(db)
        history = comment_service.get_comment_edit_history(
            comment_id=comment_id,
            user_id=user_id,
            skip=skip,
            limit=limit
        )
        
        return {
            "comment_id": comment_id,
            "history": history,
            "total": len(history)
        }
        
    except ValueError as e:
        logger.warning(f"Failed to get comment edit history: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error getting comment edit history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


# Bulk Operations
@router.post("/bulk/delete")
async def bulk_delete_comments(
    comment_ids: List[int],
    deletion_reason: Optional[str] = None,
    soft_delete: bool = True,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None),
    _rate_limit: bool = Depends(BulkOperationRateLimit)
):
    """
    Bulk delete multiple comments.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
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
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        comment_service = CommentService(db)
        results = comment_service.bulk_delete_comments(
            comment_ids=comment_ids,
            user_id=user_id,
            deletion_reason=deletion_reason,
            soft_delete=soft_delete
        )
        
        logger.info(f"Bulk delete: {results['success_count']}/{results['total_requested']} comments deleted by user {user_id}")
        return results
        
    except Exception as e:
        logger.error(f"Unexpected error in bulk delete: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/bulk/update")
async def bulk_update_comments(
    updates: List[dict],
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None),
    _rate_limit: bool = Depends(BulkOperationRateLimit)
):
    """
    Bulk update multiple comments.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
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
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        comment_service = CommentService(db)
        results = comment_service.bulk_update_comments(
            updates=updates,
            user_id=user_id
        )
        
        logger.info(f"Bulk update: {results['success_count']}/{results['total_requested']} comments updated by user {user_id}")
        return results
        
    except Exception as e:
        logger.error(f"Unexpected error in bulk update: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/bulk/create")
async def bulk_create_comments(
    comments_data: List[dict],
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None),
    _rate_limit: bool = Depends(BulkOperationRateLimit)
):
    """
    Bulk create multiple comments.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
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
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        comment_service = CommentService(db)
        results = comment_service.bulk_create_comments(
            comments_data=comments_data,
            user_id=user_id
        )
        
        logger.info(f"Bulk create: {results['success_count']}/{results['total_requested']} comments created by user {user_id}")
        return results
        
    except Exception as e:
        logger.error(f"Unexpected error in bulk create: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
