"""
Mention service for TaaskMaaster.

This module contains business logic for handling @username mentions
in comments and messages with real-time notifications.
"""

import re
from typing import List, Optional, Set

from sqlalchemy.orm import Session, joinedload

from app.core.logging import get_logger
from app.models.task_comment import TaskComment
from app.models.direct_message import DirectMessage
from app.models.comment import TaskChatMessage
from app.models.task import Task
from app.models.user import User
from app.services.notification_service import NotificationService

logger = get_logger(__name__)


class MentionService:
    """Service for managing @username mentions and notifications."""

    def __init__(self, db: Session):
        """Initialize mention service with database session."""
        self.db = db
        self.notification_service = NotificationService(db)

    # Mention pattern: @username (alphanumeric + underscore, 3-30 chars)
    MENTION_PATTERN = re.compile(r'@([a-zA-Z0-9_]{3,30})')

    def extract_mentions(self, content: str) -> List[str]:
        """
        Extract @username mentions from content.

        Args:
            content: Content to scan for mentions

        Returns:
            List of mentioned usernames (without @ symbol)
        """
        mentions = self.MENTION_PATTERN.findall(content)
        return list(set(mentions))  # Remove duplicates

    def validate_mentions(self, usernames: List[str]) -> List[User]:
        """
        Validate that mentioned usernames exist and return User objects.

        Args:
            usernames: List of usernames to validate

        Returns:
            List of valid User objects
        """
        if not usernames:
            return []

        valid_users = self.db.query(User).filter(
            User.username.in_(usernames)
        ).all()

        return valid_users

    def get_mentionable_users(
        self,
        current_user_id: int,
        context_type: str = "task",
        context_id: Optional[int] = None,
        search_query: Optional[str] = None,
        limit: int = 10
    ) -> List[dict]:
        """
        Get users that can be mentioned in a given context.

        Args:
            current_user_id: ID of user making the mention
            context_type: Type of context (task, direct_message, general)
            context_id: ID of the context (e.g., task_id)
            search_query: Optional search query to filter users
            limit: Maximum number of users to return

        Returns:
            List of user dictionaries with mention info
        """
        query = self.db.query(User).filter(User.id != current_user_id)

        # Filter based on context
        if context_type == "task" and context_id:
            # For task context, include task participants and all users
            # (in a real system, you might want to limit to team members)
            task = self.db.query(Task).filter(Task.id == context_id).first()
            if task:
                # Include task creator and assignee
                relevant_user_ids = {task.created_by_id}
                if task.assigned_to_id:
                    relevant_user_ids.add(task.assigned_to_id)
                
                # Also include users who have commented on the task
                commenters = (
                    self.db.query(TaskComment.user_id)
                    .filter(TaskComment.task_id == context_id)
                    .distinct()
                    .all()
                )
                relevant_user_ids.update([c.user_id for c in commenters])
                
                # For now, include all users but prioritize relevant ones
                # In a real system, you might want to filter more strictly
                pass

        # Apply search filter if provided
        if search_query:
            search_terms = search_query.lower().split()
            search_conditions = []
            for term in search_terms:
                search_conditions.extend([
                    User.username.ilike(f"%{term}%"),
                    User.first_name.ilike(f"%{term}%"),
                    User.last_name.ilike(f"%{term}%"),
                    User.email.ilike(f"%{term}%"),
                ])
            if search_conditions:
                query = query.filter(
                    db.or_(*search_conditions)
                )

        # Get users
        users = query.limit(limit).all()

        # Format for mention suggestions
        mentionable_users = []
        for user in users:
            display_name = user.username
            if user.first_name and user.last_name:
                display_name = f"{user.first_name} {user.last_name}"
            elif user.first_name:
                display_name = user.first_name

            mentionable_users.append({
                'id': user.id,
                'username': user.username,
                'display_name': display_name,
                'email': user.email,
                'mention_text': f"@{user.username}",
                'avatar_url': None,  # TODO: Add avatar support
            })

        return mentionable_users

    async def process_comment_mentions(
        self,
        comment: TaskComment,
        mentioned_usernames: List[str]
    ) -> List[User]:
        """
        Process mentions in a task comment and send notifications.

        Args:
            comment: The comment containing mentions
            mentioned_usernames: List of mentioned usernames

        Returns:
            List of users who were successfully notified
        """
        if not mentioned_usernames:
            return []

        # Validate mentioned users
        valid_users = self.validate_mentions(mentioned_usernames)
        if not valid_users:
            return []

        # Get task info
        task = self.db.query(Task).filter(Task.id == comment.task_id).first()
        if not task:
            logger.warning(f"Task {comment.task_id} not found for mention processing")
            return []

        # Get comment author
        author = self.db.query(User).filter(User.id == comment.user_id).first()
        if not author:
            logger.warning(f"User {comment.user_id} not found for mention processing")
            return []

        # Send mention notifications
        notified_users = []
        for user in valid_users:
            # Don't notify if user mentioned themselves
            if user.id == comment.user_id:
                continue

            # Check if user has access to the task
            if not self._user_has_task_access(task.id, user.id):
                logger.info(f"User {user.id} doesn't have access to task {task.id}, skipping mention")
                continue

            try:
                await self.notification_service.notify_user_mentioned(
                    mentioned_user=user,
                    mentioning_user=author,
                    task=task,
                    comment=comment
                )
                notified_users.append(user)
            except Exception as e:
                logger.error(f"Failed to send mention notification to user {user.id}: {e}")

        logger.info(f"Processed {len(mentioned_usernames)} mentions, notified {len(notified_users)} users")
        return notified_users

    async def process_message_mentions(
        self,
        message: DirectMessage,
        mentioned_usernames: List[str]
    ) -> List[User]:
        """
        Process mentions in a direct message and send notifications.

        Args:
            message: The direct message containing mentions
            mentioned_usernames: List of mentioned usernames

        Returns:
            List of users who were successfully notified
        """
        if not mentioned_usernames:
            return []

        # For direct messages, only notify the recipient if they're mentioned
        # (mentioning others in a private conversation doesn't make sense)
        recipient = self.db.query(User).filter(User.id == message.to_user_id).first()
        if not recipient:
            return []

        # Check if recipient is mentioned
        if recipient.username not in mentioned_usernames:
            return []

        # Get sender info
        sender = self.db.query(User).filter(User.id == message.from_user_id).first()
        if not sender:
            return []

        try:
            await self.notification_service.notify_user_mentioned_in_message(
                mentioned_user=recipient,
                mentioning_user=sender,
                message=message
            )
            return [recipient]
        except Exception as e:
            logger.error(f"Failed to send message mention notification: {e}")
            return []

    async def process_task_chat_mentions(
        self,
        message: TaskChatMessage,
        mentioned_usernames: List[str]
    ) -> List[User]:
        """
        Process mentions in a task chat message and send notifications.

        Args:
            message: The task chat message containing mentions
            mentioned_usernames: List of mentioned usernames

        Returns:
            List of users who were successfully notified
        """
        if not mentioned_usernames:
            return []

        # Validate mentioned users
        valid_users = self.validate_mentions(mentioned_usernames)
        if not valid_users:
            return []

        # Get task info
        task = self.db.query(Task).filter(Task.id == message.task_id).first()
        if not task:
            logger.warning(f"Task {message.task_id} not found for mention processing")
            return []

        # Get message author
        author = self.db.query(User).filter(User.id == message.from_user_id).first()
        if not author:
            logger.warning(f"User {message.from_user_id} not found for mention processing")
            return []

        # Send mention notifications
        notified_users = []
        for user in valid_users:
            # Don't notify if user mentioned themselves
            if user.id == message.from_user_id:
                continue

            # Check if user has access to the task
            if not self._user_has_task_access(task.id, user.id):
                logger.info(f"User {user.id} doesn't have access to task {task.id}, skipping mention")
                continue

            try:
                await self.notification_service.notify_user_mentioned_in_task_chat(
                    mentioned_user=user,
                    mentioning_user=author,
                    task=task,
                    message=message
                )
                notified_users.append(user)
            except Exception as e:
                logger.error(f"Failed to send task chat mention notification to user {user.id}: {e}")

        logger.info(f"Processed {len(mentioned_usernames)} task chat mentions, notified {len(notified_users)} users")
        return notified_users

    def highlight_mentions_in_content(self, content: str, format_type: str = "html") -> str:
        """
        Highlight mentions in content for display.

        Args:
            content: Content containing mentions
            format_type: Format type (html, markdown)

        Returns:
            Content with highlighted mentions
        """
        def replace_mention(match):
            username = match.group(1)
            if format_type == "html":
                return f'<span class="mention" data-username="{username}">@{username}</span>'
            elif format_type == "markdown":
                return f'**@{username}**'
            else:
                return f'@{username}'

        return self.MENTION_PATTERN.sub(replace_mention, content)

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
