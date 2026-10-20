"""
Messaging service for TaaskMaaster.

This module contains business logic for direct messages, task chat messages,
and real-time messaging functionality.
"""

from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import and_, desc, or_
from sqlalchemy.orm import Session, joinedload

from app.core.logging import get_logger
from app.models.direct_message import DirectMessage
from app.models.comment import (
    DirectMessageMedia,
    MessageReadReceipt,
    TaskChatMessage,
    TaskChatMessageMedia,
    UserStatus,
)
from app.models.media import MediaAttachment
from app.models.task import Task
from app.models.user import User
from app.utils.content_validator import ContentValidator

logger = get_logger(__name__)


class MessagingService:
    """Service for managing direct messages and task chat messages."""

    def __init__(self, db: Session):
        """Initialize messaging service with database session."""
        self.db = db

    # Direct Message methods
    def send_direct_message(
        self,
        from_user_id: int,
        to_user_id: int,
        content: str,
        content_type: str = "text",
        thread_id: Optional[str] = None,
        media_attachment_ids: Optional[List[int]] = None,
    ) -> DirectMessage:
        """
        Send a direct message between two users.

        Args:
            from_user_id: ID of the user sending the message
            to_user_id: ID of the user receiving the message
            content: Message content
            content_type: Content format (text, markdown)
            thread_id: Optional thread ID for conversation grouping
            media_attachment_ids: List of media attachment IDs

        Returns:
            Created DirectMessage instance

        Raises:
            ValueError: If users don't exist
        """
        # Verify users exist
        from_user = self.db.query(User).filter(User.id == from_user_id).first()
        to_user = self.db.query(User).filter(User.id == to_user_id).first()

        if not from_user:
            raise ValueError(f"From user {from_user_id} not found")
        if not to_user:
            raise ValueError(f"To user {to_user_id} not found")

        # Validate and sanitize content
        is_valid, validation_errors = ContentValidator.validate_content(content, content_type)
        if not is_valid:
            raise ValueError(f"Invalid content: {'; '.join(validation_errors)}")

        sanitized_content = ContentValidator.sanitize_content(content, content_type)

        # Create message
        message = DirectMessage(
            from_user_id=from_user_id,
            to_user_id=to_user_id,
            content=sanitized_content,
            content_type=content_type,
            thread_id=thread_id,
        )

        self.db.add(message)
        self.db.flush()  # Get the message ID

        # Add media attachments if provided
        if media_attachment_ids:
            for media_id in media_attachment_ids:
                # Verify media attachment exists
                media = self.db.query(MediaAttachment).filter(
                    MediaAttachment.id == media_id
                ).first()
                if media:
                    attachment = DirectMessageMedia(
                        message_id=message.id,
                        media_attachment_id=media_id
                    )
                    self.db.add(attachment)

        self.db.commit()
        self.db.refresh(message)

        # Send notification (async, don't wait for completion)
        try:
            import asyncio
            from app.services.notification_service import NotificationService
            
            notification_service = NotificationService(self.db)
            
            # Create a new event loop if one doesn't exist
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            # Send direct message notification
            asyncio.create_task(
                notification_service.notify_direct_message(message)
            )
        except Exception as e:
            logger.warning(f"Failed to send direct message notification: {e}")

        logger.info(
            f"Direct message {message.id} sent from user {from_user_id} to user {to_user_id}"
        )
        return message

    def get_direct_messages(
        self,
        user_id: int,
        other_user_id: int,
        skip: int = 0,
        limit: int = 50,
        before_timestamp: Optional[datetime] = None,
    ) -> Tuple[List[DirectMessage], int]:
        """
        Get direct messages between two users.

        Args:
            user_id: Current user ID
            other_user_id: Other user ID
            skip: Number of records to skip
            limit: Maximum number of records to return
            before_timestamp: Get messages before this timestamp

        Returns:
            Tuple of (messages list, total count)
        """
        # Build query for messages between the two users
        query = self.db.query(DirectMessage).filter(
            or_(
                and_(
                    DirectMessage.from_user_id == user_id,
                    DirectMessage.to_user_id == other_user_id,
                ),
                and_(
                    DirectMessage.from_user_id == other_user_id,
                    DirectMessage.to_user_id == user_id,
                ),
            )
        )

        if before_timestamp:
            query = query.filter(DirectMessage.created_at < before_timestamp)

        # Get total count
        total = query.count()

        # Get messages with relationships
        messages = (
            query.options(
                joinedload(DirectMessage.from_user),
                joinedload(DirectMessage.to_user),
                joinedload(DirectMessage.media_attachments).joinedload(
                    DirectMessageMedia.media_attachment
                ),
            )
            .order_by(DirectMessage.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return messages, total

    def get_user_conversations(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20,
    ) -> List[dict]:
        """
        Get list of conversations for a user with latest message info.

        Args:
            user_id: User ID
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of conversation dictionaries
        """
        # Get unique conversation partners with their latest messages
        # This is a complex query, so we'll do it in parts
        
        # Get all users this user has messaged with
        sent_to = (
            self.db.query(DirectMessage.to_user_id.label('other_user_id'))
            .filter(DirectMessage.from_user_id == user_id)
            .distinct()
        )
        
        received_from = (
            self.db.query(DirectMessage.from_user_id.label('other_user_id'))
            .filter(DirectMessage.to_user_id == user_id)
            .distinct()
        )
        
        # Union the results
        conversation_partners = sent_to.union(received_from).all()
        
        conversations = []
        for partner in conversation_partners:
            other_user_id = partner.other_user_id
            
            # Get latest message between these users
            latest_message = (
                self.db.query(DirectMessage)
                .filter(
                    or_(
                        and_(
                            DirectMessage.from_user_id == user_id,
                            DirectMessage.to_user_id == other_user_id,
                        ),
                        and_(
                            DirectMessage.from_user_id == other_user_id,
                            DirectMessage.to_user_id == user_id,
                        ),
                    )
                )
                .order_by(DirectMessage.created_at.desc())
                .first()
            )
            
            if latest_message:
                # Get other user info
                other_user = self.db.query(User).filter(User.id == other_user_id).first()
                
                # Count unread messages
                unread_count = (
                    self.db.query(DirectMessage)
                    .filter(
                        DirectMessage.from_user_id == other_user_id,
                        DirectMessage.to_user_id == user_id,
                        DirectMessage.is_read == False,
                    )
                    .count()
                )
                
                conversations.append({
                    'other_user': {
                        'id': other_user.id,
                        'username': other_user.username,
                        'email': other_user.email,
                    } if other_user else None,
                    'latest_message': {
                        'id': latest_message.id,
                        'content': latest_message.content,
                        'from_user_id': latest_message.from_user_id,
                        'created_at': latest_message.created_at,
                    },
                    'unread_count': unread_count,
                })
        
        # Sort by latest message timestamp
        conversations.sort(
            key=lambda x: x['latest_message']['created_at'],
            reverse=True
        )
        
        return conversations[skip:skip + limit]

    def mark_direct_message_as_read(
        self,
        message_id: int,
        user_id: int,
    ) -> bool:
        """
        Mark a direct message as read.

        Args:
            message_id: Message ID
            user_id: User ID (must be the recipient)

        Returns:
            True if marked as read

        Raises:
            ValueError: If message not found or user not recipient
        """
        message = self.db.query(DirectMessage).filter(
            DirectMessage.id == message_id
        ).first()

        if not message:
            raise ValueError(f"Message {message_id} not found")

        if message.to_user_id != user_id:
            raise ValueError("Only message recipient can mark as read")

        # Update message
        message.is_read = True
        message.updated_at = datetime.utcnow()

        # Create read receipt
        receipt = MessageReadReceipt(
            direct_message_id=message_id,
            user_id=user_id,
        )
        self.db.add(receipt)

        self.db.commit()

        logger.info(f"Marked direct message {message_id} as read by user {user_id}")
        return True

    # Task Chat Message methods
    def send_task_chat_message(
        self,
        task_id: int,
        from_user_id: int,
        content: str,
        content_type: str = "text",
        parent_message_id: Optional[int] = None,
        media_attachment_ids: Optional[List[int]] = None,
    ) -> TaskChatMessage:
        """
        Send a message to a task's chat channel.

        Args:
            task_id: Task ID
            from_user_id: ID of the user sending the message
            content: Message content
            content_type: Content format (text, markdown)
            parent_message_id: Parent message ID for replies
            media_attachment_ids: List of media attachment IDs

        Returns:
            Created TaskChatMessage instance

        Raises:
            ValueError: If task doesn't exist or user lacks permission
        """
        # Verify task exists and user has access
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise ValueError(f"Task {task_id} not found")

        # Check if user has access to task
        if not self._user_has_task_access(task_id, from_user_id):
            raise ValueError("Insufficient permissions to send message to task")

        # Validate and sanitize content
        is_valid, validation_errors = ContentValidator.validate_content(content, content_type)
        if not is_valid:
            raise ValueError(f"Invalid content: {'; '.join(validation_errors)}")

        sanitized_content = ContentValidator.sanitize_content(content, content_type)

        # Create message
        message = TaskChatMessage(
            task_id=task_id,
            from_user_id=from_user_id,
            content=sanitized_content,
            content_type=content_type,
            parent_message_id=parent_message_id,
        )

        self.db.add(message)
        self.db.flush()  # Get the message ID

        # Add media attachments if provided
        if media_attachment_ids:
            for media_id in media_attachment_ids:
                # Verify media attachment exists
                media = self.db.query(MediaAttachment).filter(
                    MediaAttachment.id == media_id
                ).first()
                if media:
                    attachment = TaskChatMessageMedia(
                        message_id=message.id,
                        media_attachment_id=media_id
                    )
                    self.db.add(attachment)

        self.db.commit()
        self.db.refresh(message)

        # Send notification (async, don't wait for completion)
        try:
            import asyncio
            from app.services.notification_service import NotificationService
            
            notification_service = NotificationService(self.db)
            
            # Create a new event loop if one doesn't exist
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            # Send task chat message notification
            asyncio.create_task(
                notification_service.notify_task_chat_message(message)
            )
        except Exception as e:
            logger.warning(f"Failed to send task chat message notification: {e}")

        logger.info(
            f"Task chat message {message.id} sent to task {task_id} by user {from_user_id}"
        )
        return message

    def get_task_chat_messages(
        self,
        task_id: int,
        user_id: int,
        skip: int = 0,
        limit: int = 50,
        before_timestamp: Optional[datetime] = None,
    ) -> Tuple[List[TaskChatMessage], int]:
        """
        Get chat messages for a task.

        Args:
            task_id: Task ID
            user_id: User ID for permission checking
            skip: Number of records to skip
            limit: Maximum number of records to return
            before_timestamp: Get messages before this timestamp

        Returns:
            Tuple of (messages list, total count)
        """
        # Verify user has access to task
        if not self._user_has_task_access(task_id, user_id):
            raise ValueError("Insufficient permissions to view task messages")

        # Build query
        query = self.db.query(TaskChatMessage).filter(
            TaskChatMessage.task_id == task_id
        )

        if before_timestamp:
            query = query.filter(TaskChatMessage.created_at < before_timestamp)

        # Get total count
        total = query.count()

        # Get messages with relationships
        messages = (
            query.options(
                joinedload(TaskChatMessage.from_user),
                joinedload(TaskChatMessage.media_attachments).joinedload(
                    TaskChatMessageMedia.media_attachment
                ),
            )
            .order_by(TaskChatMessage.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return messages, total

    def mark_task_chat_message_as_read(
        self,
        message_id: int,
        user_id: int,
    ) -> bool:
        """
        Mark a task chat message as read.

        Args:
            message_id: Message ID
            user_id: User ID

        Returns:
            True if marked as read
        """
        message = self.db.query(TaskChatMessage).filter(
            TaskChatMessage.id == message_id
        ).first()

        if not message:
            raise ValueError(f"Message {message_id} not found")

        # Check if user has access to task
        if not self._user_has_task_access(message.task_id, user_id):
            raise ValueError("Insufficient permissions")

        # Check if already marked as read by this user
        existing_receipt = self.db.query(MessageReadReceipt).filter(
            and_(
                MessageReadReceipt.task_chat_message_id == message_id,
                MessageReadReceipt.user_id == user_id,
            )
        ).first()

        if existing_receipt:
            return True

        # Create read receipt
        receipt = MessageReadReceipt(
            task_chat_message_id=message_id,
            user_id=user_id,
        )
        self.db.add(receipt)
        self.db.commit()

        logger.info(f"Marked task chat message {message_id} as read by user {user_id}")
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


class UserStatusService:
    """Service for managing user online status and presence."""

    def __init__(self, db: Session):
        """Initialize user status service with database session."""
        self.db = db

    def update_user_status(
        self,
        user_id: int,
        status: str,
        custom_message: Optional[str] = None,
    ) -> UserStatus:
        """
        Update user's online status.

        Args:
            user_id: User ID
            status: Status (online, away, busy, offline)
            custom_message: Optional custom status message

        Returns:
            Updated or created UserStatus instance
        """
        # Get or create user status
        user_status = self.db.query(UserStatus).filter(
            UserStatus.user_id == user_id
        ).first()

        if user_status:
            user_status.status = status
            user_status.custom_message = custom_message
            user_status.last_seen = datetime.utcnow()
            user_status.updated_at = datetime.utcnow()
        else:
            user_status = UserStatus(
                user_id=user_id,
                status=status,
                custom_message=custom_message,
                last_seen=datetime.utcnow(),
            )
            self.db.add(user_status)

        self.db.commit()
        self.db.refresh(user_status)

        logger.info(f"Updated status for user {user_id} to {status}")
        return user_status

    def get_user_status(self, user_id: int) -> Optional[UserStatus]:
        """
        Get user's current status.

        Args:
            user_id: User ID

        Returns:
            UserStatus instance or None
        """
        return self.db.query(UserStatus).filter(
            UserStatus.user_id == user_id
        ).first()

    def get_online_users(self, limit: int = 100) -> List[UserStatus]:
        """
        Get list of online users.

        Args:
            limit: Maximum number of users to return

        Returns:
            List of UserStatus instances for online users
        """
        return (
            self.db.query(UserStatus)
            .options(joinedload(UserStatus.user))
            .filter(UserStatus.status == "online")
            .order_by(UserStatus.last_seen.desc())
            .limit(limit)
            .all()
        )

    def set_user_offline(self, user_id: int) -> bool:
        """
        Set user status to offline.

        Args:
            user_id: User ID

        Returns:
            True if updated successfully
        """
        user_status = self.db.query(UserStatus).filter(
            UserStatus.user_id == user_id
        ).first()

        if user_status:
            user_status.status = "offline"
            user_status.last_seen = datetime.utcnow()
            user_status.updated_at = datetime.utcnow()
            self.db.commit()

        return True

    # Message Threading methods
    def get_conversation_threads(
        self,
        user1_id: int,
        user2_id: int,
        skip: int = 0,
        limit: int = 20
    ) -> List[dict]:
        """
        Get conversation threads between two users.

        Args:
            user1_id: First user ID
            user2_id: Second user ID
            skip: Number of threads to skip
            limit: Maximum number of threads to return

        Returns:
            List of thread dictionaries with metadata
        """
        from sqlalchemy import func

        # Get unique thread IDs with latest message info
        subquery = (
            self.db.query(
                DirectMessage.thread_id,
                func.max(DirectMessage.created_at).label('latest_message_at'),
                func.count(DirectMessage.id).label('message_count')
            )
            .filter(
                or_(
                    and_(
                        DirectMessage.from_user_id == user1_id,
                        DirectMessage.to_user_id == user2_id
                    ),
                    and_(
                        DirectMessage.from_user_id == user2_id,
                        DirectMessage.to_user_id == user1_id
                    )
                ),
                DirectMessage.thread_id.isnot(None)
            )
            .group_by(DirectMessage.thread_id)
            .subquery()
        )

        # Get thread details with latest message
        threads_query = (
            self.db.query(
                subquery.c.thread_id,
                subquery.c.latest_message_at,
                subquery.c.message_count,
                DirectMessage.content.label('latest_content'),
                DirectMessage.from_user_id.label('latest_from_user_id'),
                User.username.label('latest_from_username')
            )
            .join(
                DirectMessage,
                and_(
                    DirectMessage.thread_id == subquery.c.thread_id,
                    DirectMessage.created_at == subquery.c.latest_message_at
                )
            )
            .join(User, User.id == DirectMessage.from_user_id)
            .order_by(desc(subquery.c.latest_message_at))
            .offset(skip)
            .limit(limit)
        )

        thread_results = threads_query.all()

        threads = []
        for thread_result in thread_results:
            threads.append({
                'thread_id': thread_result.thread_id,
                'message_count': thread_result.message_count,
                'latest_message_at': thread_result.latest_message_at,
                'latest_message': {
                    'content': thread_result.latest_content,
                    'from_user_id': thread_result.latest_from_user_id,
                    'from_username': thread_result.latest_from_username
                }
            })

        return threads

    def create_message_thread(
        self,
        from_user_id: int,
        to_user_id: int,
        initial_message: str,
        content_type: str = "markdown",
        media_attachment_ids: Optional[List[int]] = None
    ) -> dict:
        """
        Create a new message thread between two users.

        Args:
            from_user_id: ID of user creating the thread
            to_user_id: ID of recipient user
            initial_message: Initial message content
            content_type: Message content type
            media_attachment_ids: Optional media attachments

        Returns:
            Dictionary with thread info and initial message
        """
        import uuid

        # Generate unique thread ID
        thread_id = str(uuid.uuid4())

        # Create initial message
        message = self.send_direct_message(
            from_user_id=from_user_id,
            to_user_id=to_user_id,
            content=initial_message,
            content_type=content_type,
            thread_id=thread_id,
            media_attachment_ids=media_attachment_ids
        )

        return {
            'thread_id': thread_id,
            'created_at': message.created_at,
            'initial_message': message,
            'participant_ids': [from_user_id, to_user_id]
        }

    def get_thread_messages(
        self,
        thread_id: str,
        user_id: int,
        skip: int = 0,
        limit: int = 50,
        include_media: bool = True
    ) -> List[DirectMessage]:
        """
        Get messages in a specific thread.

        Args:
            thread_id: Thread ID
            user_id: ID of requesting user (for permission check)
            skip: Number of messages to skip
            limit: Maximum number of messages to return
            include_media: Whether to include media attachments

        Returns:
            List of DirectMessage instances

        Raises:
            ValueError: If user doesn't have access to thread
        """
        # Check if user has access to this thread
        if not self._user_has_thread_access(thread_id, user_id):
            raise ValueError(f"User {user_id} does not have access to thread {thread_id}")

        query = (
            self.db.query(DirectMessage)
            .filter(DirectMessage.thread_id == thread_id)
            .order_by(DirectMessage.created_at)
            .offset(skip)
            .limit(limit)
        )

        if include_media:
            query = query.options(joinedload(DirectMessage.media_attachments))

        return query.all()

    def get_thread_participants(self, thread_id: str) -> List[User]:
        """
        Get participants in a message thread.

        Args:
            thread_id: Thread ID

        Returns:
            List of User instances who are participants in the thread
        """
        # Get unique user IDs from messages in thread
        participant_ids = (
            self.db.query(DirectMessage.from_user_id)
            .filter(DirectMessage.thread_id == thread_id)
            .union(
                self.db.query(DirectMessage.to_user_id)
                .filter(DirectMessage.thread_id == thread_id)
            )
            .distinct()
            .all()
        )

        user_ids = [pid[0] for pid in participant_ids]
        
        if not user_ids:
            return []

        return (
            self.db.query(User)
            .filter(User.id.in_(user_ids))
            .all()
        )

    def _user_has_thread_access(self, thread_id: str, user_id: int) -> bool:
        """
        Check if user has access to a message thread.

        Args:
            thread_id: Thread ID
            user_id: User ID

        Returns:
            True if user has access
        """
        # User has access if they sent or received any message in the thread
        message_exists = (
            self.db.query(DirectMessage)
            .filter(
                DirectMessage.thread_id == thread_id,
                or_(
                    DirectMessage.from_user_id == user_id,
                    DirectMessage.to_user_id == user_id
                )
            )
            .first()
        )

        return message_exists is not None
