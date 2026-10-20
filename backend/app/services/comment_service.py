"""
Comment service for TaaskMaaster.

This module contains business logic for task comments, direct messages,
task chat messages, and related functionality.
"""

from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import and_, desc, or_
from sqlalchemy.orm import Session, joinedload

from app.core.logging import get_logger
from app.models.task_comment import TaskComment, CommentMediaAttachment
from app.models.direct_message import DirectMessage
from app.models.comment import (
    MessageReadReceipt,
    TaskChatMessage,
    TaskStatusHistory,
    UserStatus,
)
from app.models.media import MediaAttachment
from app.models.task import Task
from app.models.user import User
from app.services.mention_service import MentionService
from app.services.notification_service import NotificationService
from app.services.permission_service import PermissionService, Permission
from app.utils.content_validator import ContentValidator
from app.utils.pagination import QueryOptimizer, PaginationParams, FilterCriteria, SortCriteria

logger = get_logger(__name__)


class CommentService:
    """Service for managing task comments and related functionality."""

    def __init__(self, db: Session):
        """Initialize comment service with database session."""
        self.db = db
        self.content_validator = ContentValidator()
        self.mention_service = MentionService(db)
        self.notification_service = NotificationService(db)
        self.permission_service = PermissionService(db)
        self.query_optimizer = QueryOptimizer(db)

    # Task Comment methods
    def create_task_comment(
        self,
        task_id: int,
        user_id: int,
        content: str,
        content_type: str = "markdown",
        parent_comment_id: Optional[int] = None,
        is_system_comment: bool = False,
        media_attachment_ids: Optional[List[int]] = None,
    ) -> TaskComment:
        """
        Create a new task comment.

        Args:
            task_id: ID of the task to comment on
            user_id: ID of the user creating the comment
            content: Comment content
            content_type: Content format (markdown, html, text)
            parent_comment_id: Parent comment ID for replies
            is_system_comment: Whether this is a system-generated comment
            media_attachment_ids: List of media attachment IDs

        Returns:
            Created TaskComment instance

        Raises:
            ValueError: If task doesn't exist or user lacks permission
        """
        # Verify task exists and user has access
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise ValueError(f"Task {task_id} not found")
        
        # Check permission for commenting on task
        if not self.permission_service.has_permission(
            user_id, Permission.COMMENT_CREATE, task_id, "task"
        ):
            raise ValueError("You don't have permission to comment on this task")

        # Validate and sanitize content
        is_valid, validation_errors = ContentValidator.validate_content(content, content_type)
        if not is_valid:
            raise ValueError(f"Invalid content: {'; '.join(validation_errors)}")

        sanitized_content = ContentValidator.sanitize_content(content, content_type)

        # Extract mentions from content
        mentioned_users = ContentValidator.extract_mentions(sanitized_content)

        # Create comment (content_type is used for validation but not stored)
        comment = TaskComment(
            task_id=task_id,
            user_id=user_id,
            content=sanitized_content,
            parent_comment_id=parent_comment_id,
            is_system_generated=is_system_comment,
        )

        self.db.add(comment)
        self.db.flush()  # Get the comment ID

        # Add media attachments if provided
        if media_attachment_ids:
            for media_id in media_attachment_ids:
                # Verify media attachment exists
                media = self.db.query(MediaAttachment).filter(
                    MediaAttachment.id == media_id
                ).first()
                if media:
                    attachment = CommentMediaAttachment(
                        comment_id=comment.id,
                        media_attachment_id=media_id
                    )
                    self.db.add(attachment)

        self.db.commit()
        self.db.refresh(comment)

        # Process mentions and send notifications (async, don't wait for completion)
        if not is_system_comment:
            try:
                import asyncio
                
                # Extract and process mentions
                mentioned_usernames = self.mention_service.extract_mentions(content)
                mentioned_users = []
                
                if mentioned_usernames:
                    # Process mentions and send notifications
                    async def process_mentions():
                        nonlocal mentioned_users
                        mentioned_users = await self.mention_service.process_comment_mentions(
                            comment, mentioned_usernames
                        )
                        # Also send regular comment notification
                        await self.notification_service.notify_task_comment(comment, mentioned_users)
                    
                    # Create a new event loop if one doesn't exist
                    try:
                        loop = asyncio.get_event_loop()
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    
                    # Schedule processing (fire and forget)
                    asyncio.create_task(process_mentions())
                else:
                    # No mentions, just send regular notification
                    async def send_notification():
                        await self.notification_service.notify_task_comment(comment, [])
                    
                    try:
                        loop = asyncio.get_event_loop()
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    
                    asyncio.create_task(send_notification())
                    
            except Exception as e:
                logger.warning(f"Failed to process mentions or send notifications: {e}")

        logger.info(
            f"Created task comment {comment.id} for task {task_id} by user {user_id}"
        )
        return comment

    def update_task_comment(
        self,
        comment_id: int,
        user_id: int,
        content: str,
        content_type: str = "markdown",
        edit_reason: Optional[str] = None
    ) -> TaskComment:
        """
        Update an existing task comment.

        Args:
            comment_id: ID of the comment to update
            user_id: ID of the user updating the comment
            content: New comment content
            content_type: Content format (markdown, html, text)
            edit_reason: Optional reason for the edit

        Returns:
            Updated TaskComment instance

        Raises:
            ValueError: If comment doesn't exist or user lacks permission
        """
        # Get existing comment
        comment = self.db.query(TaskComment).filter(
            TaskComment.id == comment_id
        ).first()
        
        if not comment:
            raise ValueError(f"Comment {comment_id} not found")
        
        # Check permissions using permission service
        if not self.permission_service.can_user_edit_comment(user_id, comment_id):
            raise ValueError("You don't have permission to edit this comment")
        
        # Validate and sanitize content
        validated_content = self.content_validator.validate_and_sanitize(
            content, content_type
        )
        
        # Store original content for audit trail
        original_content = comment.content
        
        # Update comment
        comment.content = validated_content
        comment.content_type = content_type
        comment.is_edited = True
        comment.edited_at = datetime.utcnow()
        comment.edit_reason = edit_reason

        self.db.commit()
        self.db.refresh(comment)

        # Create audit trail entry
        self._create_comment_audit_trail(
            comment_id=comment.id,
            user_id=user_id,
            action="updated",
            original_content=original_content,
            new_content=validated_content,
            edit_reason=edit_reason
        )

        logger.info(f"Updated task comment {comment_id} by user {user_id}")
        return comment

    def delete_task_comment(
        self,
        comment_id: int,
        user_id: int,
        deletion_reason: Optional[str] = None,
        soft_delete: bool = True
    ) -> bool:
        """
        Delete a task comment.

        Args:
            comment_id: ID of the comment to delete
            user_id: ID of the user deleting the comment
            deletion_reason: Optional reason for deletion
            soft_delete: Whether to soft delete (mark as deleted) or hard delete

        Returns:
            True if deletion was successful

        Raises:
            ValueError: If comment doesn't exist or user lacks permission
        """
        # Get existing comment
        comment = self.db.query(TaskComment).filter(
            TaskComment.id == comment_id
        ).first()
        
        if not comment:
            raise ValueError(f"Comment {comment_id} not found")
        
        # Check permissions using permission service
        if not self.permission_service.can_user_delete_comment(user_id, comment_id):
            raise ValueError("You don't have permission to delete this comment")
        
        # Store original content for audit trail
        original_content = comment.content

        if soft_delete:
            # Soft delete - mark as deleted but keep in database
            comment.is_deleted = True
            comment.deleted_at = datetime.utcnow()
            comment.deletion_reason = deletion_reason
            comment.content = "[This comment has been deleted]"
            
            self.db.commit()
            
            # Create audit trail entry
            self._create_comment_audit_trail(
                comment_id=comment.id,
                user_id=user_id,
                action="soft_deleted",
                original_content=original_content,
                deletion_reason=deletion_reason
            )
            
            logger.info(f"Soft deleted task comment {comment_id} by user {user_id}")
        else:
            # Hard delete - remove from database
            # First create audit trail entry before deletion
            self._create_comment_audit_trail(
                comment_id=comment.id,
                user_id=user_id,
                action="hard_deleted",
                original_content=original_content,
                deletion_reason=deletion_reason
            )
            
            # Delete media attachments
            self.db.query(CommentMediaAttachment).filter(
                CommentMediaAttachment.comment_id == comment_id
            ).delete()
            
            # Delete the comment
            self.db.delete(comment)
            self.db.commit()
            
            logger.info(f"Hard deleted task comment {comment_id} by user {user_id}")

        return True

    def get_comment_edit_history(
        self,
        comment_id: int,
        user_id: int,
        skip: int = 0,
        limit: int = 20
    ) -> List[dict]:
        """
        Get edit history for a comment.

        Args:
            comment_id: ID of the comment
            user_id: ID of the requesting user
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of edit history records

        Raises:
            ValueError: If comment doesn't exist or user lacks access
        """
        # Verify comment exists and user has access
        comment = self.db.query(TaskComment).filter(
            TaskComment.id == comment_id
        ).first()
        
        if not comment:
            raise ValueError(f"Comment {comment_id} not found")
        
        # Check if user has access to the task
        task = self.db.query(Task).filter(Task.id == comment.task_id).first()
        if not task:
            raise ValueError(f"Task {comment.task_id} not found")
        
        # TODO: Add proper access control check
        # For now, allow access if user is task creator, assignee, or comment author
        if not (task.created_by_id == user_id or 
                task.assigned_to_id == user_id or 
                comment.user_id == user_id):
            raise ValueError("You don't have access to this comment's edit history")

        # Get audit trail records
        from app.models.comment import CommentAuditTrail
        
        audit_records = (
            self.db.query(CommentAuditTrail)
            .filter(CommentAuditTrail.comment_id == comment_id)
            .order_by(CommentAuditTrail.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        history = []
        for record in audit_records:
            history.append({
                'id': record.id,
                'action': record.action,
                'user_id': record.user_id,
                'created_at': record.created_at,
                'original_content': record.original_content,
                'new_content': record.new_content,
                'edit_reason': record.edit_reason,
                'deletion_reason': record.deletion_reason,
            })

        return history

    def _create_comment_audit_trail(
        self,
        comment_id: int,
        user_id: int,
        action: str,
        original_content: Optional[str] = None,
        new_content: Optional[str] = None,
        edit_reason: Optional[str] = None,
        deletion_reason: Optional[str] = None
    ) -> None:
        """
        Create an audit trail entry for comment changes.

        Args:
            comment_id: ID of the comment
            user_id: ID of the user performing the action
            action: Action performed (created, updated, soft_deleted, hard_deleted)
            original_content: Original content before change
            new_content: New content after change
            edit_reason: Reason for edit
            deletion_reason: Reason for deletion
        """
        from app.models.comment import CommentAuditTrail
        
        audit_entry = CommentAuditTrail(
            comment_id=comment_id,
            user_id=user_id,
            action=action,
            original_content=original_content,
            new_content=new_content,
            edit_reason=edit_reason,
            deletion_reason=deletion_reason,
        )
        
        self.db.add(audit_entry)
        self.db.commit()

    # Bulk Operations
    def bulk_delete_comments(
        self,
        comment_ids: List[int],
        user_id: int,
        deletion_reason: Optional[str] = None,
        soft_delete: bool = True
    ) -> dict:
        """
        Bulk delete multiple comments.

        Args:
            comment_ids: List of comment IDs to delete
            user_id: ID of the user performing the deletion
            deletion_reason: Optional reason for deletion
            soft_delete: Whether to soft delete or hard delete

        Returns:
            Dictionary with success/failure counts and details
        """
        results = {
            'total_requested': len(comment_ids),
            'successful': [],
            'failed': [],
            'success_count': 0,
            'failure_count': 0
        }

        # Pre-validate permissions for all comments
        permission_result = self.permission_service.validate_bulk_operation_permissions(
            user_id, "delete", comment_ids, "comment"
        )
        
        # Process allowed deletions
        for comment_id in permission_result["allowed"]:
            try:
                success = self.delete_task_comment(
                    comment_id=comment_id,
                    user_id=user_id,
                    deletion_reason=deletion_reason,
                    soft_delete=soft_delete
                )
                if success:
                    results['successful'].append({
                        'comment_id': comment_id,
                        'message': 'Successfully deleted'
                    })
                    results['success_count'] += 1
                else:
                    results['failed'].append({
                        'comment_id': comment_id,
                        'error': 'Deletion failed'
                    })
                    results['failure_count'] += 1
            except Exception as e:
                results['failed'].append({
                    'comment_id': comment_id,
                    'error': str(e)
                })
                results['failure_count'] += 1
        
        # Add denied comments to failed list
        for comment_id in permission_result["denied"]:
            results['failed'].append({
                'comment_id': comment_id,
                'error': 'Permission denied'
            })
            results['failure_count'] += 1

        logger.info(f"Bulk delete: {results['success_count']}/{results['total_requested']} comments deleted by user {user_id}")
        return results

    def bulk_update_comments(
        self,
        updates: List[dict],
        user_id: int
    ) -> dict:
        """
        Bulk update multiple comments.

        Args:
            updates: List of update dictionaries with comment_id, content, etc.
            user_id: ID of the user performing the updates

        Returns:
            Dictionary with success/failure counts and details
        """
        results = {
            'total_requested': len(updates),
            'successful': [],
            'failed': [],
            'success_count': 0,
            'failure_count': 0
        }

        for update in updates:
            comment_id = update.get('comment_id')
            if not comment_id:
                results['failed'].append({
                    'comment_id': None,
                    'error': 'Missing comment_id'
                })
                results['failure_count'] += 1
                continue

            try:
                comment = self.update_task_comment(
                    comment_id=comment_id,
                    user_id=user_id,
                    content=update.get('content', ''),
                    content_type=update.get('content_type', 'markdown'),
                    edit_reason=update.get('edit_reason')
                )
                results['successful'].append({
                    'comment_id': comment_id,
                    'message': 'Successfully updated',
                    'comment': comment
                })
                results['success_count'] += 1
            except Exception as e:
                results['failed'].append({
                    'comment_id': comment_id,
                    'error': str(e)
                })
                results['failure_count'] += 1

        logger.info(f"Bulk update: {results['success_count']}/{results['total_requested']} comments updated by user {user_id}")
        return results

    def bulk_mark_messages_read(
        self,
        message_ids: List[int],
        user_id: int
    ) -> dict:
        """
        Bulk mark multiple messages as read.

        Args:
            message_ids: List of message IDs to mark as read
            user_id: ID of the user marking messages as read

        Returns:
            Dictionary with success/failure counts and details
        """
        results = {
            'total_requested': len(message_ids),
            'successful': [],
            'failed': [],
            'success_count': 0,
            'failure_count': 0
        }

        for message_id in message_ids:
            try:
                # Check if message exists and user has access
                message = self.db.query(DirectMessage).filter(
                    DirectMessage.id == message_id,
                    or_(
                        DirectMessage.from_user_id == user_id,
                        DirectMessage.to_user_id == user_id
                    )
                ).first()

                if not message:
                    results['failed'].append({
                        'message_id': message_id,
                        'error': 'Message not found or no access'
                    })
                    results['failure_count'] += 1
                    continue

                # Check if already marked as read
                existing_receipt = self.db.query(MessageReadReceipt).filter(
                    MessageReadReceipt.message_id == message_id,
                    MessageReadReceipt.user_id == user_id
                ).first()

                if not existing_receipt:
                    # Create read receipt
                    receipt = MessageReadReceipt(
                        message_id=message_id,
                        user_id=user_id,
                        read_at=datetime.utcnow()
                    )
                    self.db.add(receipt)

                results['successful'].append({
                    'message_id': message_id,
                    'message': 'Successfully marked as read'
                })
                results['success_count'] += 1

            except Exception as e:
                results['failed'].append({
                    'message_id': message_id,
                    'error': str(e)
                })
                results['failure_count'] += 1

        # Commit all read receipts at once
        try:
            self.db.commit()
        except Exception as e:
            logger.error(f"Failed to commit bulk read receipts: {e}")
            self.db.rollback()
            # Mark all as failed
            for i in range(results['success_count']):
                if i < len(results['successful']):
                    failed_item = results['successful'][i]
                    failed_item['error'] = 'Database commit failed'
                    results['failed'].append(failed_item)
            results['successful'] = []
            results['failure_count'] = results['total_requested']
            results['success_count'] = 0

        logger.info(f"Bulk mark read: {results['success_count']}/{results['total_requested']} messages marked as read by user {user_id}")
        return results

    def bulk_create_comments(
        self,
        comments_data: List[dict],
        user_id: int
    ) -> dict:
        """
        Bulk create multiple comments.

        Args:
            comments_data: List of comment data dictionaries
            user_id: ID of the user creating comments

        Returns:
            Dictionary with success/failure counts and details
        """
        results = {
            'total_requested': len(comments_data),
            'successful': [],
            'failed': [],
            'success_count': 0,
            'failure_count': 0
        }

        for comment_data in comments_data:
            task_id = comment_data.get('task_id')
            if not task_id:
                results['failed'].append({
                    'task_id': None,
                    'error': 'Missing task_id'
                })
                results['failure_count'] += 1
                continue

            try:
                comment = self.create_task_comment(
                    task_id=task_id,
                    user_id=user_id,
                    content=comment_data.get('content', ''),
                    content_type=comment_data.get('content_type', 'markdown'),
                    parent_comment_id=comment_data.get('parent_comment_id'),
                    is_system_comment=comment_data.get('is_system_comment', False),
                    media_attachment_ids=comment_data.get('media_attachment_ids')
                )
                results['successful'].append({
                    'task_id': task_id,
                    'comment_id': comment.id,
                    'message': 'Successfully created',
                    'comment': comment
                })
                results['success_count'] += 1
            except Exception as e:
                results['failed'].append({
                    'task_id': task_id,
                    'error': str(e)
                })
                results['failure_count'] += 1

        logger.info(f"Bulk create: {results['success_count']}/{results['total_requested']} comments created by user {user_id}")
        return results

    def get_task_comments(
        self,
        task_id: int,
        user_id: int,
        pagination_params: Optional[PaginationParams] = None,
        filters: Optional[List[FilterCriteria]] = None,
        sorts: Optional[List[SortCriteria]] = None,
        include_system: bool = True,
        include_deleted: bool = False
    ):
        """
        Get comments for a task with advanced filtering and pagination.

        Args:
            task_id: Task ID
            user_id: User ID for permission checking
            pagination_params: Pagination parameters
            filters: Filter criteria
            sorts: Sort criteria
            include_system: Whether to include system comments
            include_deleted: Whether to include soft-deleted comments

        Returns:
            Pagination result with comments
        """
        # Verify user has access to task
        if not self.permission_service.has_permission(
            user_id, Permission.TASK_VIEW, task_id, "task"
        ):
            raise ValueError("You don't have permission to view comments for this task")

        # Build base query
        query = self.db.query(TaskComment).filter(TaskComment.task_id == task_id)

        # Apply basic filters
        if not include_system:
            query = query.filter(TaskComment.is_system_generated == False)
        
        # Note: TaskComment model doesn't have is_deleted field - using soft delete pattern would require adding it

        # Apply advanced filters
        if filters:
            query = self.query_optimizer.apply_filters(query, TaskComment, filters)

        # Apply sorting (default to created_at asc if no sorts specified)
        if not sorts:
            sorts = [SortCriteria(field="created_at", order="asc")]
        query = self.query_optimizer.apply_sorting(query, TaskComment, sorts)

        # Add relationships
        query = query.options(
            joinedload(TaskComment.user),
            joinedload(TaskComment.media_attachments).joinedload(
                CommentMediaAttachment.media
            ),
            joinedload(TaskComment.parent_comment),
            joinedload(TaskComment.replies)
        )

        # Apply pagination
        if not pagination_params:
            pagination_params = PaginationParams()

        result = self.query_optimizer.paginate(query, pagination_params)
        
        # Filter comments based on permissions
        visible_comments = self.permission_service.filter_visible_comments(
            user_id, result.items
        )
        
        # Update result with filtered comments
        result.items = visible_comments
        
        return result

    def update_task_comment(
        self,
        comment_id: int,
        user_id: int,
        content: str,
        content_type: str = "markdown",
    ) -> TaskComment:
        """
        Update a task comment.

        Args:
            comment_id: Comment ID
            user_id: User ID (must be comment author)
            content: New content
            content_type: Content format

        Returns:
            Updated TaskComment instance

        Raises:
            ValueError: If comment not found or user lacks permission
        """
        comment = self.db.query(TaskComment).filter(
            TaskComment.id == comment_id
        ).first()

        if not comment:
            raise ValueError(f"Comment {comment_id} not found")

        if comment.user_id != user_id:
            raise ValueError("Only comment author can edit comment")

        comment.content = content
        comment.content_type = content_type
        comment.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(comment)

        logger.info(f"Updated comment {comment_id} by user {user_id}")
        return comment

    def delete_task_comment(
        self,
        comment_id: int,
        user_id: int,
    ) -> bool:
        """
        Delete a task comment.

        Args:
            comment_id: Comment ID
            user_id: User ID (must be comment author or task owner)

        Returns:
            True if deleted successfully

        Raises:
            ValueError: If comment not found or user lacks permission
        """
        comment = (
            self.db.query(TaskComment)
            .options(joinedload(TaskComment.task))
            .filter(TaskComment.id == comment_id)
            .first()
        )

        if not comment:
            raise ValueError(f"Comment {comment_id} not found")

        # Check if user can delete (author or task creator)
        if comment.user_id != user_id and comment.task.created_by_id != user_id:
            raise ValueError("Insufficient permissions to delete comment")

        self.db.delete(comment)
        self.db.commit()

        logger.info(f"Deleted comment {comment_id} by user {user_id}")
        return True

    def get_comment_by_id(
        self,
        comment_id: int,
        user_id: int,
    ) -> Optional[TaskComment]:
        """
        Get a comment by ID.

        Args:
            comment_id: Comment ID
            user_id: User ID for permission checking

        Returns:
            TaskComment instance or None
        """
        comment = (
            self.db.query(TaskComment)
            .options(
                joinedload(TaskComment.user),
                joinedload(TaskComment.task),
                joinedload(TaskComment.media_attachments).joinedload(
                    CommentMediaAttachment.media
                ),
            )
            .filter(TaskComment.id == comment_id)
            .first()
        )

        if not comment:
            return None

        # Verify user has access to the task
        if not self._user_has_task_access(comment.task_id, user_id):
            return None

        return comment

    def add_comment_media_attachment(
        self,
        comment_id: int,
        media_attachment_id: int,
        user_id: int,
    ) -> CommentMediaAttachment:
        """
        Add media attachment to a comment.

        Args:
            comment_id: Comment ID
            media_attachment_id: Media attachment ID
            user_id: User ID (must be comment author)

        Returns:
            Created CommentMediaAttachment instance

        Raises:
            ValueError: If comment not found or user lacks permission
        """
        comment = self.db.query(TaskComment).filter(
            TaskComment.id == comment_id
        ).first()

        if not comment:
            raise ValueError(f"Comment {comment_id} not found")

        if comment.user_id != user_id:
            raise ValueError("Only comment author can add attachments")

        # Verify media attachment exists
        media = self.db.query(MediaAttachment).filter(
            MediaAttachment.id == media_attachment_id
        ).first()
        if not media:
            raise ValueError(f"Media attachment {media_attachment_id} not found")

        # Check if attachment already exists
        existing = self.db.query(CommentMediaAttachment).filter(
            and_(
                CommentMediaAttachment.comment_id == comment_id,
                CommentMediaAttachment.media_attachment_id == media_attachment_id,
            )
        ).first()

        if existing:
            return existing

        attachment = CommentMediaAttachment(
            comment_id=comment_id,
            media_attachment_id=media_attachment_id,
        )

        self.db.add(attachment)
        self.db.commit()
        self.db.refresh(attachment)

        logger.info(
            f"Added media attachment {media_attachment_id} to comment {comment_id}"
        )
        return attachment

    def remove_comment_media_attachment(
        self,
        comment_id: int,
        media_attachment_id: int,
        user_id: int,
    ) -> bool:
        """
        Remove media attachment from a comment.

        Args:
            comment_id: Comment ID
            media_attachment_id: Media attachment ID
            user_id: User ID (must be comment author)

        Returns:
            True if removed successfully

        Raises:
            ValueError: If comment not found or user lacks permission
        """
        comment = self.db.query(TaskComment).filter(
            TaskComment.id == comment_id
        ).first()

        if not comment:
            raise ValueError(f"Comment {comment_id} not found")

        if comment.user_id != user_id:
            raise ValueError("Only comment author can remove attachments")

        attachment = self.db.query(CommentMediaAttachment).filter(
            and_(
                CommentMediaAttachment.comment_id == comment_id,
                CommentMediaAttachment.media_attachment_id == media_attachment_id,
            )
        ).first()

        if attachment:
            self.db.delete(attachment)
            self.db.commit()
            logger.info(
                f"Removed media attachment {media_attachment_id} from comment {comment_id}"
            )

        return True

    def _user_has_task_access(self, task_id: int, user_id: int) -> bool:
        """
        Check if user has access to a task.

        Args:
            task_id: Task ID
            user_id: User ID

        Returns:
            True if user has access
        """
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return False

        # User has access if they are the creator, assignee, or admin
        return (
            task.created_by_id == user_id
            or task.assigned_to_id == user_id
            # TODO: Add admin role check
        )

    def create_system_comment(
        self,
        task_id: int,
        content: str,
        user_id: Optional[int] = None,
    ) -> TaskComment:
        """
        Create a system-generated comment for workflow changes.

        Args:
            task_id: Task ID
            content: System comment content
            user_id: Optional user ID who triggered the change

        Returns:
            Created TaskComment instance
        """
        # Use system user ID if no user provided
        if user_id is None:
            # TODO: Get system user ID or use a default
            user_id = 1  # Temporary - use admin user

        return self.create_task_comment(
            task_id=task_id,
            user_id=user_id,
            content=content,
            content_type="text",
            is_system_comment=True,
        )
