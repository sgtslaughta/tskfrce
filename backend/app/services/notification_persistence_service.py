"""
Notification persistence service for TaaskMaaster.

This module contains business logic for storing and retrieving notifications
from the database.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any

from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.notification import Notification
from app.models.user import User

logger = get_logger(__name__)


class NotificationPersistenceService:
    """Service for managing notification persistence."""

    def __init__(self, db: Session):
        """Initialize notification persistence service with database session."""
        self.db = db

    def create_notification(
        self,
        user_id: int,
        notification_type: str,
        title: str,
        message: str,
        action_url: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None
    ) -> Notification:
        """
        Create and store a new notification in the database.

        Args:
            user_id: User ID to send notification to
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            action_url: Optional URL for notification action
            data: Optional additional data

        Returns:
            Created notification

        Raises:
            ValueError: If user doesn't exist or invalid data
        """
        try:
            # Verify user exists
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError(f"User with ID {user_id} not found")

            # Create notification
            notification = Notification(
                user_id=user_id,
                type=notification_type,
                title=title,
                message=message,
                action_url=action_url,
                data=data,
                is_read=False,
                created_at=datetime.utcnow()
            )

            self.db.add(notification)
            self.db.commit()
            self.db.refresh(notification)

            logger.info(f"Created notification {notification.id} for user {user_id}")
            return notification

        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating notification for user {user_id}: {e}")
            raise

    def get_user_notifications(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 50,
        unread_only: bool = False,
        notification_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Get notifications for a user with filtering and pagination.

        Args:
            user_id: User ID
            skip: Number of notifications to skip
            limit: Maximum number of notifications to return
            unread_only: Only return unread notifications
            notification_types: Filter by notification types

        Returns:
            Dictionary with notifications, total count, and metadata
        """
        try:
            # Build query
            query = self.db.query(Notification).filter(Notification.user_id == user_id)

            # Apply filters
            if unread_only:
                query = query.filter(Notification.is_read == False)

            if notification_types:
                query = query.filter(Notification.type.in_(notification_types))

            # Get total count before pagination
            total_count = query.count()

            # Get unread count
            unread_query = self.db.query(Notification).filter(
                and_(
                    Notification.user_id == user_id,
                    Notification.is_read == False
                )
            )
            if notification_types:
                unread_query = unread_query.filter(Notification.type.in_(notification_types))
            unread_count = unread_query.count()

            # Apply pagination and ordering
            notifications = (
                query
                .order_by(desc(Notification.created_at))
                .offset(skip)
                .limit(limit)
                .all()
            )

            # Check if there are more notifications
            has_more = (skip + len(notifications)) < total_count

            # Convert to response format
            notification_responses = []
            for notification in notifications:
                notification_responses.append({
                    "id": notification.id,
                    "user_id": notification.user_id,
                    "type": notification.type,
                    "title": notification.title,
                    "message": notification.message,
                    "action_url": notification.action_url,
                    "data": notification.data,
                    "is_read": notification.is_read,
                    "created_at": notification.created_at,
                    "read_at": notification.read_at,
                })

            return {
                "notifications": notification_responses,
                "total": total_count,
                "unread_count": unread_count,
                "has_more": has_more
            }

        except Exception as e:
            logger.error(f"Error retrieving notifications for user {user_id}: {e}")
            raise

    def mark_notifications_read(
        self,
        user_id: int,
        notification_ids: List[int]
    ) -> int:
        """
        Mark specific notifications as read.

        Args:
            user_id: User ID (for security)
            notification_ids: List of notification IDs to mark as read

        Returns:
            Number of notifications marked as read

        Raises:
            ValueError: If no notifications found or unauthorized access
        """
        try:
            if not notification_ids:
                return 0

            # Update notifications (only for the specified user)
            updated_count = (
                self.db.query(Notification)
                .filter(
                    and_(
                        Notification.id.in_(notification_ids),
                        Notification.user_id == user_id,
                        Notification.is_read == False
                    )
                )
                .update(
                    {
                        "is_read": True,
                        "read_at": datetime.utcnow()
                    },
                    synchronize_session=False
                )
            )

            self.db.commit()

            logger.info(f"Marked {updated_count} notifications as read for user {user_id}")
            return updated_count

        except Exception as e:
            self.db.rollback()
            logger.error(f"Error marking notifications read for user {user_id}: {e}")
            raise

    def mark_all_notifications_read(self, user_id: int) -> int:
        """
        Mark all notifications as read for a user.

        Args:
            user_id: User ID

        Returns:
            Number of notifications marked as read
        """
        try:
            updated_count = (
                self.db.query(Notification)
                .filter(
                    and_(
                        Notification.user_id == user_id,
                        Notification.is_read == False
                    )
                )
                .update(
                    {
                        "is_read": True,
                        "read_at": datetime.utcnow()
                    },
                    synchronize_session=False
                )
            )

            self.db.commit()

            logger.info(f"Marked all {updated_count} notifications as read for user {user_id}")
            return updated_count

        except Exception as e:
            self.db.rollback()
            logger.error(f"Error marking all notifications read for user {user_id}: {e}")
            raise

    def delete_notifications(
        self,
        user_id: int,
        notification_ids: List[int]
    ) -> int:
        """
        Delete specific notifications.

        Args:
            user_id: User ID (for security)
            notification_ids: List of notification IDs to delete

        Returns:
            Number of notifications deleted

        Raises:
            ValueError: If no notifications found or unauthorized access
        """
        try:
            if not notification_ids:
                return 0

            # Delete notifications (only for the specified user)
            deleted_count = (
                self.db.query(Notification)
                .filter(
                    and_(
                        Notification.id.in_(notification_ids),
                        Notification.user_id == user_id
                    )
                )
                .delete(synchronize_session=False)
            )

            self.db.commit()

            logger.info(f"Deleted {deleted_count} notifications for user {user_id}")
            return deleted_count

        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting notifications for user {user_id}: {e}")
            raise

    def get_notification_stats(self, user_id: int) -> Dict[str, Any]:
        """
        Get notification statistics for a user.

        Args:
            user_id: User ID

        Returns:
            Dictionary with notification statistics
        """
        try:
            # Get total count
            total_count = (
                self.db.query(Notification)
                .filter(Notification.user_id == user_id)
                .count()
            )

            # Get unread count
            unread_count = (
                self.db.query(Notification)
                .filter(
                    and_(
                        Notification.user_id == user_id,
                        Notification.is_read == False
                    )
                )
                .count()
            )

            # Get read count
            read_count = total_count - unread_count

            # Get counts by type
            type_counts = (
                self.db.query(Notification.type, func.count(Notification.id))
                .filter(Notification.user_id == user_id)
                .group_by(Notification.type)
                .all()
            )

            types_dict = {type_name: count for type_name, count in type_counts}

            return {
                "total_notifications": total_count,
                "unread_count": unread_count,
                "read_count": read_count,
                "types": types_dict
            }

        except Exception as e:
            logger.error(f"Error retrieving notification stats for user {user_id}: {e}")
            raise

    def cleanup_old_notifications(
        self,
        user_id: int,
        days_old: int = 30
    ) -> int:
        """
        Clean up old notifications for a user.

        Args:
            user_id: User ID
            days_old: Delete notifications older than this many days

        Returns:
            Number of notifications deleted
        """
        try:
            cutoff_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            cutoff_date = cutoff_date.replace(day=cutoff_date.day - days_old)

            deleted_count = (
                self.db.query(Notification)
                .filter(
                    and_(
                        Notification.user_id == user_id,
                        Notification.created_at < cutoff_date,
                        Notification.is_read == True  # Only delete read notifications
                    )
                )
                .delete(synchronize_session=False)
            )

            self.db.commit()

            logger.info(f"Cleaned up {deleted_count} old notifications for user {user_id}")
            return deleted_count

        except Exception as e:
            self.db.rollback()
            logger.error(f"Error cleaning up notifications for user {user_id}: {e}")
            raise
