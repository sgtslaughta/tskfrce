"""
Notification service for TaaskMaaster.

This module contains business logic for managing notifications and
real-time WebSocket broadcasting for various system events.
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.task_comment import TaskComment
from app.models.direct_message import DirectMessage
from app.models.comment import TaskChatMessage
from app.models.task import Task
from app.models.user import User
from app.services.websocket_service import websocket_manager
from app.services.notification_persistence_service import NotificationPersistenceService

logger = get_logger(__name__)


class NotificationType(str, Enum):
    """Notification types for different system events."""
    
    # Task-related notifications
    TASK_COMMENT = "task_comment"
    TASK_STATUS_CHANGED = "task_status_changed"
    TASK_APPROVAL_REQUEST = "task_approval_request"
    TASK_APPROVED = "task_approved"
    TASK_REJECTED = "task_rejected"
    TASK_ASSIGNED = "task_assigned"
    TASK_REASSIGNED = "task_reassigned"
    TASK_CREATED = "task_created"
    TASK_UPDATED = "task_updated"
    TASK_DELETED = "task_deleted"
    TASK_DUE_SOON = "task_due_soon"
    TASK_OVERDUE = "task_overdue"
    TASK_COMPLETED = "task_completed"
    
    # User interaction notifications
    USER_MENTIONED = "user_mentioned"
    
    # Media notifications
    MEDIA_ATTACHED = "media_attached"
    
    # Messaging notifications
    DIRECT_MESSAGE = "direct_message"
    TASK_CHAT_MESSAGE = "task_chat_message"
    
    # System notifications
    SYSTEM_ANNOUNCEMENT = "system_announcement"


class NotificationService:
    """Service for managing notifications and real-time broadcasting."""

    def __init__(self, db: Session):
        """Initialize notification service with database session."""
        self.db = db
        self.persistence_service = NotificationPersistenceService(db)

    async def _send_notification(
        self,
        recipients: List[int],
        notification_type: str,
        title: str,
        message: str,
        action_url: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Send notification via both WebSocket (real-time) and database (persistence).
        
        Args:
            recipients: List of user IDs to notify
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            action_url: Optional URL for notification action
            data: Optional additional data
        """
        try:
            # Create the notification payload for WebSocket
            websocket_notification = {
                "type": notification_type,
                "timestamp": datetime.utcnow().isoformat(),
                "notification_type": notification_type,
                "title": title,
                "message": message,
                "action_url": action_url,
                "data": data,
            }
            
            # Send via WebSocket for real-time delivery
            await websocket_manager.broadcast_notifications(recipients, websocket_notification)
            
            # Store in database for offline users
            for user_id in recipients:
                try:
                    self.persistence_service.create_notification(
                        user_id=user_id,
                        notification_type=notification_type,
                        title=title,
                        message=message,
                        action_url=action_url,
                        data=data
                    )
                except Exception as e:
                    logger.error(f"Failed to store notification for user {user_id}: {e}")
                    # Continue with other users even if one fails
                    
            logger.info(f"Sent {notification_type} notification to {len(recipients)} users (WebSocket + DB)")
            
        except Exception as e:
            logger.error(f"Error in _send_notification: {e}")
            raise

    async def notify_task_comment(
        self,
        comment: TaskComment,
        mentioned_users: Optional[List[str]] = None
    ) -> None:
        """
        Send notification for new task comment.

        Args:
            comment: The comment that was created
            mentioned_users: List of usernames mentioned in the comment
        """
        try:
            # Get task and user info
            task = self.db.query(Task).filter(Task.id == comment.task_id).first()
            user = self.db.query(User).filter(User.id == comment.user_id).first()
            
            if not task or not user:
                logger.warning(f"Missing task or user for comment notification: task_id={comment.task_id}, user_id={comment.user_id}")
                return

            # Get task participants (excluding the commenter)
            from app.services.task_service import TaskService
            task_service = TaskService(self.db)
            participants = task_service.get_task_participants(comment.task_id)
            recipients = [p for p in participants if p != comment.user_id]

            # Send notification via both WebSocket and database
            await self._send_notification(
                recipients=recipients,
                notification_type=NotificationType.TASK_COMMENT,
                title=f"New comment on {task.title}",
                message=f"{user.username} commented on task: {comment.content[:100]}{'...' if len(comment.content) > 100 else ''}",
                action_url=f"/tasks/{task.id}",
                data={
                    "task_id": task.id,
                    "task_title": task.title,
                    "comment_id": comment.id,
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "full_name": user.full_name,
                    },
                    "comment_content": comment.content,
                    "is_system_generated": comment.is_system_generated,
                }
            )

            # Handle mentions separately
            if mentioned_users:
                await self._notify_mentioned_users(
                    mentioned_users, comment, task, user
                )

        except Exception as e:
            logger.error(f"Error sending task comment notification: {e}")

    async def notify_task_status_changed(
        self,
        task: Task,
        previous_status: str,
        new_status: str,
        changed_by_user_id: int,
        comment: Optional[str] = None
    ) -> None:
        """
        Send notification for task status change.

        Args:
            task: The task that changed status
            previous_status: Previous status value
            new_status: New status value
            changed_by_user_id: User who made the change
            comment: Optional comment about the change
        """
        try:
            # Get user info
            user = self.db.query(User).filter(User.id == changed_by_user_id).first()
            if not user:
                logger.warning(f"User not found for status change notification: {changed_by_user_id}")
                return

            # Get task participants (excluding the user who made the change)
            from app.services.task_service import TaskService
            task_service = TaskService(self.db)
            participants = task_service.get_task_participants(task.id)
            recipients = [p for p in participants if p != changed_by_user_id]

            # Send notification via both WebSocket and database
            await self._send_notification(
                recipients=recipients,
                notification_type=NotificationType.TASK_STATUS_CHANGED,
                title=f"Task status changed: {task.title}",
                message=f"{user.username} changed task status from {previous_status} to {new_status}",
                action_url=f"/tasks/{task.id}",
                data={
                    "task_id": task.id,
                    "task_title": task.title,
                    "previous_status": previous_status,
                    "new_status": new_status,
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "full_name": user.full_name,
                    },
                    "comment": comment,
                }
            )

        except Exception as e:
            logger.error(f"Error sending task status change notification: {e}")

    async def notify_task_approval_request(
        self,
        task: Task,
        submitted_by_user_id: int
    ) -> None:
        """
        Send notification for task approval request.

        Args:
            task: The task submitted for approval
            submitted_by_user_id: User who submitted the task
        """
        try:
            # Get user info
            user = self.db.query(User).filter(User.id == submitted_by_user_id).first()
            if not user:
                logger.warning(f"User not found for approval request notification: {submitted_by_user_id}")
                return

            # Notify task creator (the approver)
            recipients = [task.created_by_id] if task.created_by_id != submitted_by_user_id else []

            if not recipients:
                return

            # Send notification via both WebSocket and database
            await self._send_notification(
                recipients=recipients,
                notification_type=NotificationType.TASK_APPROVAL_REQUEST,
                title=f"Task approval requested: {task.title}",
                message=f"{user.username} submitted task '{task.title}' for your approval",
                action_url=f"/tasks/{task.id}",
                data={
                    "task_id": task.id,
                    "task_title": task.title,
                    "submitted_by": {
                        "id": user.id,
                        "username": user.username,
                        "full_name": user.full_name,
                    },
                    "requires_action": True,
                }
            )

        except Exception as e:
            logger.error(f"Error sending approval request notification: {e}")

    async def notify_task_approved(
        self,
        task: Task,
        approved_by_user_id: int,
        comment: Optional[str] = None
    ) -> None:
        """
        Send notification for task approval.

        Args:
            task: The approved task
            approved_by_user_id: User who approved the task
            comment: Optional approval comment
        """
        try:
            # Get user info
            user = self.db.query(User).filter(User.id == approved_by_user_id).first()
            if not user:
                logger.warning(f"User not found for approval notification: {approved_by_user_id}")
                return

            # Notify assigned user (if different from approver)
            recipients = [task.assigned_to_id] if task.assigned_to_id and task.assigned_to_id != approved_by_user_id else []

            if not recipients:
                return

            # Create notification message
            notification = {
                "type": NotificationType.TASK_APPROVED,
                "timestamp": datetime.utcnow().isoformat(),
                "notification_type": "task_approved",
                "title": f"Task approved: {task.title}",
                "message": f"Your task '{task.title}' has been approved by {user.username}",
                "action_url": f"/tasks/{task.id}",
                "data": {
                    "task_id": task.id,
                    "task_title": task.title,
                    "approved_by": {
                        "id": user.id,
                        "username": user.username,
                        "full_name": user.full_name,
                    },
                    "comment": comment,
                }
            }

            # Send to assigned user
            await websocket_manager.broadcast_notifications(recipients, notification)

            logger.info(f"Sent approval notification for task {task.id} to assigned user")

        except Exception as e:
            logger.error(f"Error sending approval notification: {e}")

    async def notify_task_rejected(
        self,
        task: Task,
        rejected_by_user_id: int,
        reason: str
    ) -> None:
        """
        Send notification for task rejection.

        Args:
            task: The rejected task
            rejected_by_user_id: User who rejected the task
            reason: Rejection reason
        """
        try:
            # Get user info
            user = self.db.query(User).filter(User.id == rejected_by_user_id).first()
            if not user:
                logger.warning(f"User not found for rejection notification: {rejected_by_user_id}")
                return

            # Notify assigned user (if different from rejector)
            recipients = [task.assigned_to_id] if task.assigned_to_id and task.assigned_to_id != rejected_by_user_id else []

            if not recipients:
                return

            # Create notification message
            notification = {
                "type": NotificationType.TASK_REJECTED,
                "timestamp": datetime.utcnow().isoformat(),
                "notification_type": "task_rejected",
                "title": f"Task rejected: {task.title}",
                "message": f"Your task '{task.title}' was rejected by {user.username}",
                "action_url": f"/tasks/{task.id}",
                "data": {
                    "task_id": task.id,
                    "task_title": task.title,
                    "rejected_by": {
                        "id": user.id,
                        "username": user.username,
                        "full_name": user.full_name,
                    },
                    "reason": reason,
                    "requires_action": True,
                }
            }

            # Send to assigned user
            await websocket_manager.broadcast_notifications(recipients, notification)

            logger.info(f"Sent rejection notification for task {task.id} to assigned user")

        except Exception as e:
            logger.error(f"Error sending rejection notification: {e}")

    async def notify_direct_message(
        self,
        message: DirectMessage
    ) -> None:
        """
        Send notification for new direct message.

        Args:
            message: The direct message that was sent
        """
        try:
            # Get sender info
            sender = self.db.query(User).filter(User.id == message.from_user_id).first()
            if not sender:
                logger.warning(f"Sender not found for direct message notification: {message.from_user_id}")
                return

            # Create notification message
            notification = {
                "type": NotificationType.DIRECT_MESSAGE,
                "timestamp": datetime.utcnow().isoformat(),
                "message_type": "direct_message",
                "sender": {
                    "id": sender.id,
                    "username": sender.username,
                    "full_name": sender.full_name,
                },
                "content": message.content,
                "data": {
                    "message_id": message.id,
                    "from_user_id": message.from_user_id,
                    "to_user_id": message.to_user_id,
                    "content": message.content,
                    "content_type": message.content_type,
                    "thread_id": message.thread_id,
                    "created_at": message.created_at.isoformat(),
                }
            }

            # Send to recipient
            await websocket_manager.send_message(message.to_user_id, notification)

            logger.info(f"Sent direct message notification {message.id} to user {message.to_user_id}")

        except Exception as e:
            logger.error(f"Error sending direct message notification: {e}")

    async def notify_task_chat_message(
        self,
        message: TaskChatMessage
    ) -> None:
        """
        Send notification for new task chat message.

        Args:
            message: The task chat message that was sent
        """
        try:
            # Get sender info
            sender = self.db.query(User).filter(User.id == message.from_user_id).first()
            if not sender:
                logger.warning(f"Sender not found for task chat message notification: {message.from_user_id}")
                return

            # Get task participants (excluding the sender)
            from app.services.task_service import TaskService
            task_service = TaskService(self.db)
            participants = task_service.get_task_participants(message.task_id)
            recipients = [p for p in participants if p != message.from_user_id]

            # Create notification message
            notification = {
                "type": NotificationType.TASK_CHAT_MESSAGE,
                "timestamp": datetime.utcnow().isoformat(),
                "message_type": "task_chat_message",
                "sender": {
                    "id": sender.id,
                    "username": sender.username,
                    "full_name": sender.full_name,
                },
                "content": message.content,
                "context": {
                    "task_id": message.task_id,
                },
                "data": {
                    "message_id": message.id,
                    "task_id": message.task_id,
                    "from_user_id": message.from_user_id,
                    "content": message.content,
                    "content_type": message.content_type,
                    "parent_message_id": message.parent_message_id,
                    "created_at": message.created_at.isoformat(),
                }
            }

            # Send to task participants
            await websocket_manager.broadcast_messages(recipients, notification)

            logger.info(f"Sent task chat message notification {message.id} to {len(recipients)} users")

        except Exception as e:
            logger.error(f"Error sending task chat message notification: {e}")

    async def _notify_mentioned_users(
        self,
        mentioned_users: List[str],
        comment: TaskComment,
        task: Task,
        mentioning_user: User
    ) -> None:
        """
        Send notifications to users mentioned in a comment.

        Args:
            mentioned_users: List of usernames mentioned
            comment: The comment containing mentions
            task: The task the comment is on
            mentioning_user: User who made the mention
        """
        try:
            # Get user IDs for mentioned usernames
            mentioned_user_objects = self.db.query(User).filter(
                User.username.in_(mentioned_users)
            ).all()

            for mentioned_user in mentioned_user_objects:
                # Don't notify if user mentioned themselves
                if mentioned_user.id == mentioning_user.id:
                    continue

                # Create mention notification
                notification = {
                    "type": NotificationType.USER_MENTIONED,
                    "timestamp": datetime.utcnow().isoformat(),
                    "notification_type": "user_mentioned",
                    "title": f"You were mentioned in {task.title}",
                    "message": f"{mentioning_user.username} mentioned you in a comment: {comment.content[:100]}{'...' if len(comment.content) > 100 else ''}",
                    "action_url": f"/tasks/{task.id}",
                    "data": {
                        "task_id": task.id,
                        "task_title": task.title,
                        "comment_id": comment.id,
                        "mentioned_by": {
                            "id": mentioning_user.id,
                            "username": mentioning_user.username,
                            "full_name": mentioning_user.full_name,
                        },
                        "comment_content": comment.content,
                    }
                }

                # Send to mentioned user
                await websocket_manager.send_notification(mentioned_user.id, notification)

            logger.info(f"Sent mention notifications to {len(mentioned_user_objects)} users")

        except Exception as e:
            logger.error(f"Error sending mention notifications: {e}")

    async def notify_media_attached(
        self,
        attachment_id: int,
        attached_by_user_id: int,
        context_type: str,  # "comment" or "message"
        context_id: int,
        task_id: Optional[int] = None
    ) -> None:
        """
        Send notification for media attachment.

        Args:
            attachment_id: Media attachment ID
            attached_by_user_id: User who attached the media
            context_type: Type of context (comment, message)
            context_id: ID of the comment or message
            task_id: Task ID if applicable
        """
        try:
            # Get user info
            user = self.db.query(User).filter(User.id == attached_by_user_id).first()
            if not user:
                logger.warning(f"User not found for media attachment notification: {attached_by_user_id}")
                return

            # Determine recipients based on context
            recipients = []
            if context_type == "comment" and task_id:
                from app.services.task_service import TaskService
                task_service = TaskService(self.db)
                participants = task_service.get_task_participants(task_id)
                recipients = [p for p in participants if p != attached_by_user_id]

            # Create notification message
            notification = {
                "type": NotificationType.MEDIA_ATTACHED,
                "timestamp": datetime.utcnow().isoformat(),
                "notification_type": "media_attached",
                "title": "Media attachment added",
                "message": f"{user.username} added a media attachment",
                "action_url": f"/tasks/{task_id}" if task_id else None,
                "data": {
                    "attachment_id": attachment_id,
                    "context_type": context_type,
                    "context_id": context_id,
                    "task_id": task_id,
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "full_name": user.full_name,
                    },
                }
            }

            # Send to recipients
            if recipients:
                await websocket_manager.broadcast_notifications(recipients, notification)

            logger.info(f"Sent media attachment notification to {len(recipients)} users")

        except Exception as e:
            logger.error(f"Error sending media attachment notification: {e}")

    async def notify_user_mentioned(
        self,
        mentioned_user: User,
        mentioning_user: User,
        task: Task,
        comment: TaskComment
    ) -> None:
        """
        Send notification for user mention in task comment.

        Args:
            mentioned_user: User who was mentioned
            mentioning_user: User who made the mention
            task: Task where the mention occurred
            comment: Comment containing the mention
        """
        try:
            # Create mention notification
            notification = {
                "type": NotificationType.USER_MENTIONED,
                "timestamp": datetime.utcnow().isoformat(),
                "notification_type": "user_mentioned",
                "title": f"You were mentioned in {task.title}",
                "message": f"{mentioning_user.username} mentioned you in a comment: {comment.content[:100]}{'...' if len(comment.content) > 100 else ''}",
                "action_url": f"/tasks/{task.id}",
                "data": {
                    "task_id": task.id,
                    "task_title": task.title,
                    "comment_id": comment.id,
                    "mentioned_by": {
                        "id": mentioning_user.id,
                        "username": mentioning_user.username,
                        "full_name": mentioning_user.full_name,
                    },
                    "comment_content": comment.content,
                    "mention_context": "task_comment",
                }
            }

            # Send to mentioned user
            await websocket_manager.send_notification(mentioned_user.id, notification)

            logger.info(f"Sent mention notification to user {mentioned_user.id} from comment {comment.id}")

        except Exception as e:
            logger.error(f"Error sending mention notification: {e}")

    async def notify_user_mentioned_in_message(
        self,
        mentioned_user: User,
        mentioning_user: User,
        message: DirectMessage
    ) -> None:
        """
        Send notification for user mention in direct message.

        Args:
            mentioned_user: User who was mentioned
            mentioning_user: User who made the mention
            message: Direct message containing the mention
        """
        try:
            # Create mention notification
            notification = {
                "type": NotificationType.USER_MENTIONED,
                "timestamp": datetime.utcnow().isoformat(),
                "notification_type": "user_mentioned",
                "title": f"You were mentioned by {mentioning_user.username}",
                "message": f"{mentioning_user.username} mentioned you in a message: {message.content[:100]}{'...' if len(message.content) > 100 else ''}",
                "action_url": f"/messages/{mentioning_user.id}",
                "data": {
                    "message_id": message.id,
                    "mentioned_by": {
                        "id": mentioning_user.id,
                        "username": mentioning_user.username,
                        "full_name": mentioning_user.full_name,
                    },
                    "message_content": message.content,
                    "mention_context": "direct_message",
                }
            }

            # Send to mentioned user
            await websocket_manager.send_notification(mentioned_user.id, notification)

            logger.info(f"Sent mention notification to user {mentioned_user.id} from message {message.id}")

        except Exception as e:
            logger.error(f"Error sending message mention notification: {e}")

    async def notify_user_mentioned_in_task_chat(
        self,
        mentioned_user: User,
        mentioning_user: User,
        task: Task,
        message: TaskChatMessage
    ) -> None:
        """
        Send notification for user mention in task chat message.

        Args:
            mentioned_user: User who was mentioned
            mentioning_user: User who made the mention
            task: Task where the mention occurred
            message: Task chat message containing the mention
        """
        try:
            # Create mention notification
            notification = {
                "type": NotificationType.USER_MENTIONED,
                "timestamp": datetime.utcnow().isoformat(),
                "notification_type": "user_mentioned",
                "title": f"You were mentioned in {task.title}",
                "message": f"{mentioning_user.username} mentioned you in task chat: {message.content[:100]}{'...' if len(message.content) > 100 else ''}",
                "action_url": f"/tasks/{task.id}",
                "data": {
                    "task_id": task.id,
                    "task_title": task.title,
                    "message_id": message.id,
                    "mentioned_by": {
                        "id": mentioning_user.id,
                        "username": mentioning_user.username,
                        "full_name": mentioning_user.full_name,
                    },
                    "message_content": message.content,
                    "mention_context": "task_chat",
                }
            }

            # Send to mentioned user
            await websocket_manager.send_notification(mentioned_user.id, notification)

            logger.info(f"Sent mention notification to user {mentioned_user.id} from task chat {message.id}")

        except Exception as e:
            logger.error(f"Error sending task chat mention notification: {e}")

    async def notify_task_assigned(
        self,
        task: Task,
        assigned_to_user_id: int,
        assigned_by_user_id: int
    ) -> None:
        """
        Send notification for task assignment.

        Args:
            task: The task that was assigned
            assigned_to_user_id: User who received the assignment
            assigned_by_user_id: User who made the assignment
        """
        try:
            # Get user info
            assigned_by_user = self.db.query(User).filter(User.id == assigned_by_user_id).first()
            if not assigned_by_user:
                logger.warning(f"User not found for task assignment notification: {assigned_by_user_id}")
                return

            # Don't notify if user assigned task to themselves
            if assigned_to_user_id == assigned_by_user_id:
                return

            # Send notification via both WebSocket and database
            await self._send_notification(
                recipients=[assigned_to_user_id],
                notification_type=NotificationType.TASK_ASSIGNED,
                title=f"New task assigned: {task.title}",
                message=f"{assigned_by_user.username} assigned you the task '{task.title}'",
                action_url=f"/tasks/{task.id}",
                data={
                    "task_id": task.id,
                    "task_title": task.title,
                    "task_priority": task.priority.value if task.priority else None,
                    "task_due_date": task.due_date.isoformat() if task.due_date else None,
                    "assigned_by": {
                        "id": assigned_by_user.id,
                        "username": assigned_by_user.username,
                        "full_name": assigned_by_user.full_name,
                    },
                    "requires_action": True,
                }
            )

        except Exception as e:
            logger.error(f"Error sending task assignment notification: {e}")

    async def notify_task_reassigned(
        self,
        task: Task,
        old_assigned_to_id: int,
        new_assigned_to_id: int,
        reassigned_by_user_id: int
    ) -> None:
        """
        Send notification for task reassignment.

        Args:
            task: The task that was reassigned
            old_assigned_to_id: Previous assignee
            new_assigned_to_id: New assignee
            reassigned_by_user_id: User who made the reassignment
        """
        try:
            # Get user info
            reassigned_by_user = self.db.query(User).filter(User.id == reassigned_by_user_id).first()
            if not reassigned_by_user:
                logger.warning(f"User not found for task reassignment notification: {reassigned_by_user_id}")
                return

            # Notify old assignee (if different from reassigner)
            if old_assigned_to_id and old_assigned_to_id != reassigned_by_user_id:
                await self._send_notification(
                    recipients=[old_assigned_to_id],
                    notification_type=NotificationType.TASK_REASSIGNED,
                    title=f"Task reassigned: {task.title}",
                    message=f"{reassigned_by_user.username} reassigned task '{task.title}' to someone else",
                    action_url=f"/tasks/{task.id}",
                    data={
                        "task_id": task.id,
                        "task_title": task.title,
                        "reassigned_by": {
                            "id": reassigned_by_user.id,
                            "username": reassigned_by_user.username,
                            "full_name": reassigned_by_user.full_name,
                        },
                        "context": "removed_assignment",
                    }
                )

            # Notify new assignee (if different from reassigner)
            if new_assigned_to_id and new_assigned_to_id != reassigned_by_user_id:
                await self._send_notification(
                    recipients=[new_assigned_to_id],
                    notification_type=NotificationType.TASK_ASSIGNED,
                    title=f"New task assigned: {task.title}",
                    message=f"{reassigned_by_user.username} assigned you the task '{task.title}'",
                    action_url=f"/tasks/{task.id}",
                    data={
                        "task_id": task.id,
                        "task_title": task.title,
                        "task_priority": task.priority.value if task.priority else None,
                        "task_due_date": task.due_date.isoformat() if task.due_date else None,
                        "assigned_by": {
                            "id": reassigned_by_user.id,
                            "username": reassigned_by_user.username,
                            "full_name": reassigned_by_user.full_name,
                        },
                        "context": "reassignment",
                        "requires_action": True,
                    }
                )

        except Exception as e:
            logger.error(f"Error sending task reassignment notification: {e}")

    async def notify_task_created(
        self,
        task: Task,
        created_by_user_id: int
    ) -> None:
        """
        Send notification for task creation (to assignee if different from creator).

        Args:
            task: The task that was created
            created_by_user_id: User who created the task
        """
        try:
            # Only notify if task is assigned to someone other than the creator
            if not task.assigned_to_id or task.assigned_to_id == created_by_user_id:
                return

            # Get creator info
            creator = self.db.query(User).filter(User.id == created_by_user_id).first()
            if not creator:
                logger.warning(f"Creator not found for task creation notification: {created_by_user_id}")
                return

            # Send notification via both WebSocket and database
            await self._send_notification(
                recipients=[task.assigned_to_id],
                notification_type=NotificationType.TASK_CREATED,
                title=f"New task created: {task.title}",
                message=f"{creator.username} created and assigned you a new task '{task.title}'",
                action_url=f"/tasks/{task.id}",
                data={
                    "task_id": task.id,
                    "task_title": task.title,
                    "task_priority": task.priority.value if task.priority else None,
                    "task_due_date": task.due_date.isoformat() if task.due_date else None,
                    "created_by": {
                        "id": creator.id,
                        "username": creator.username,
                        "full_name": creator.full_name,
                    },
                    "requires_action": True,
                }
            )

        except Exception as e:
            logger.error(f"Error sending task creation notification: {e}")

    async def notify_task_updated(
        self,
        task: Task,
        updated_by_user_id: int,
        changed_fields: List[str]
    ) -> None:
        """
        Send notification for task updates (to relevant participants).

        Args:
            task: The updated task
            updated_by_user_id: User who made the update
            changed_fields: List of fields that were changed
        """
        try:
            # Get updater info
            updater = self.db.query(User).filter(User.id == updated_by_user_id).first()
            if not updater:
                logger.warning(f"Updater not found for task update notification: {updated_by_user_id}")
                return

            # Get task participants (excluding the updater)
            from app.services.task_service import TaskService
            task_service = TaskService(self.db)
            participants = task_service.get_task_participants(task.id)
            recipients = [p for p in participants if p != updated_by_user_id]

            if not recipients:
                return

            # Create human-readable change summary
            field_names = {
                'title': 'title',
                'description': 'description',
                'priority': 'priority',
                'due_date': 'due date',
                'estimated_hours': 'estimated hours',
                'points': 'points',
            }
            
            changed_display = [field_names.get(field, field) for field in changed_fields if field in field_names]
            change_summary = ', '.join(changed_display) if changed_display else 'task details'

            # Send notification via both WebSocket and database
            await self._send_notification(
                recipients=recipients,
                notification_type=NotificationType.TASK_UPDATED,
                title=f"Task updated: {task.title}",
                message=f"{updater.username} updated {change_summary} for task '{task.title}'",
                action_url=f"/tasks/{task.id}",
                data={
                    "task_id": task.id,
                    "task_title": task.title,
                    "updated_by": {
                        "id": updater.id,
                        "username": updater.username,
                        "full_name": updater.full_name,
                    },
                    "changed_fields": changed_fields,
                    "change_summary": change_summary,
                }
            )

        except Exception as e:
            logger.error(f"Error sending task update notification: {e}")

    async def notify_task_completed(
        self,
        task: Task,
        completed_by_user_id: int
    ) -> None:
        """
        Send notification for task completion.

        Args:
            task: The completed task
            completed_by_user_id: User who completed the task
        """
        try:
            # Get completer info
            completer = self.db.query(User).filter(User.id == completed_by_user_id).first()
            if not completer:
                logger.warning(f"Completer not found for task completion notification: {completed_by_user_id}")
                return

            # Get task participants (excluding the completer)
            from app.services.task_service import TaskService
            task_service = TaskService(self.db)
            participants = task_service.get_task_participants(task.id)
            recipients = [p for p in participants if p != completed_by_user_id]

            if not recipients:
                return

            # Send notification via both WebSocket and database
            await self._send_notification(
                recipients=recipients,
                notification_type=NotificationType.TASK_COMPLETED,
                title=f"Task completed: {task.title}",
                message=f"{completer.username} completed task '{task.title}'",
                action_url=f"/tasks/{task.id}",
                data={
                    "task_id": task.id,
                    "task_title": task.title,
                    "completed_by": {
                        "id": completer.id,
                        "username": completer.username,
                        "full_name": completer.full_name,
                    },
                    "completed_at": task.completed_at.isoformat() if task.completed_at else None,
                }
            )

        except Exception as e:
            logger.error(f"Error sending task completion notification: {e}")

    async def notify_task_deleted(
        self,
        task_title: str,
        task_id: int,
        deleted_by_user_id: int,
        participants: List[int]
    ) -> None:
        """
        Send notification for task deletion.

        Args:
            task_title: Title of the deleted task
            task_id: ID of the deleted task
            deleted_by_user_id: User who deleted the task
            participants: List of user IDs who were involved with the task
        """
        try:
            # Get deleter info
            deleter = self.db.query(User).filter(User.id == deleted_by_user_id).first()
            if not deleter:
                logger.warning(f"Deleter not found for task deletion notification: {deleted_by_user_id}")
                return

            # Notify participants (excluding the deleter)
            recipients = [p for p in participants if p != deleted_by_user_id]

            if not recipients:
                return

            # Send notification via both WebSocket and database
            await self._send_notification(
                recipients=recipients,
                notification_type=NotificationType.TASK_DELETED,
                title=f"Task deleted: {task_title}",
                message=f"{deleter.username} deleted task '{task_title}'",
                action_url=None,  # No action URL since task is deleted
                data={
                    "task_id": task_id,
                    "task_title": task_title,
                    "deleted_by": {
                        "id": deleter.id,
                        "username": deleter.username,
                        "full_name": deleter.full_name,
                    },
                    "deleted_at": datetime.utcnow().isoformat(),
                }
            )

        except Exception as e:
            logger.error(f"Error sending task deletion notification: {e}")
