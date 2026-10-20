"""
Search and filtering service for TaaskMaaster.

This module contains business logic for searching and filtering
comments, messages, and other content.
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Tuple, Union

from sqlalchemy import and_, desc, func, or_, text
from sqlalchemy.orm import Session, joinedload

from app.core.logging import get_logger
from app.models.task_comment import TaskComment
from app.models.direct_message import DirectMessage
from app.models.comment import (
    TaskChatMessage,
    TaskStatusHistory,
)
from app.models.task import Task
from app.models.user import User

logger = get_logger(__name__)


class SearchType(str, Enum):
    """Search types for different content."""
    
    COMMENTS = "comments"
    DIRECT_MESSAGES = "direct_messages"
    TASK_CHAT_MESSAGES = "task_chat_messages"
    STATUS_HISTORY = "status_history"
    ALL = "all"


class SortOrder(str, Enum):
    """Sort order options."""
    
    ASC = "asc"
    DESC = "desc"


class SortBy(str, Enum):
    """Sort by options."""
    
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
    RELEVANCE = "relevance"
    USER = "user"


class SearchService:
    """Service for searching and filtering content."""

    def __init__(self, db: Session):
        """Initialize search service with database session."""
        self.db = db

    def search_comments(
        self,
        query: str,
        user_id: int,
        task_id: Optional[int] = None,
        user_filter: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        content_type: Optional[str] = None,
        include_system: bool = True,
        sort_by: SortBy = SortBy.CREATED_AT,
        sort_order: SortOrder = SortOrder.DESC,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[TaskComment], int]:
        """
        Search task comments.

        Args:
            query: Search query string
            user_id: User performing the search
            task_id: Optional task ID to filter by
            user_filter: Optional user ID to filter by
            date_from: Optional start date filter
            date_to: Optional end date filter
            content_type: Optional content type filter
            include_system: Whether to include system comments
            sort_by: Sort field
            sort_order: Sort order
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            Tuple of (comments list, total count)
        """
        # Build base query
        base_query = self.db.query(TaskComment).options(
            joinedload(TaskComment.user),
            joinedload(TaskComment.task),
            joinedload(TaskComment.media_attachments),
        )

        # Apply filters
        filters = []

        # Text search in content
        if query.strip():
            search_terms = query.strip().split()
            search_conditions = []
            for term in search_terms:
                search_conditions.append(
                    TaskComment.content.ilike(f"%{term}%")
                )
            if search_conditions:
                filters.append(or_(*search_conditions))

        # Task filter
        if task_id:
            filters.append(TaskComment.task_id == task_id)
        else:
            # User must have access to tasks
            accessible_tasks = self._get_accessible_task_ids(user_id)
            if accessible_tasks:
                filters.append(TaskComment.task_id.in_(accessible_tasks))
            else:
                # No accessible tasks, return empty result
                return [], 0

        # User filter
        if user_filter:
            filters.append(TaskComment.user_id == user_filter)

        # Date filters
        if date_from:
            filters.append(TaskComment.created_at >= date_from)
        if date_to:
            filters.append(TaskComment.created_at <= date_to)

        # Content type filter
        if content_type:
            filters.append(TaskComment.content_type == content_type)

        # System comment filter
        if not include_system:
            filters.append(TaskComment.is_system_comment == False)

        # Apply all filters
        if filters:
            base_query = base_query.filter(and_(*filters))

        # Get total count
        total = base_query.count()

        # Apply sorting
        if sort_by == SortBy.CREATED_AT:
            sort_field = TaskComment.created_at
        elif sort_by == SortBy.UPDATED_AT:
            sort_field = TaskComment.updated_at
        elif sort_by == SortBy.USER:
            sort_field = TaskComment.user_id
        else:
            sort_field = TaskComment.created_at

        if sort_order == SortOrder.DESC:
            base_query = base_query.order_by(desc(sort_field))
        else:
            base_query = base_query.order_by(sort_field)

        # Apply pagination
        comments = base_query.offset(skip).limit(limit).all()

        return comments, total

    def search_direct_messages(
        self,
        query: str,
        user_id: int,
        other_user_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        sort_by: SortBy = SortBy.CREATED_AT,
        sort_order: SortOrder = SortOrder.DESC,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[DirectMessage], int]:
        """
        Search direct messages.

        Args:
            query: Search query string
            user_id: User performing the search
            other_user_id: Optional other user ID to filter by
            date_from: Optional start date filter
            date_to: Optional end date filter
            sort_by: Sort field
            sort_order: Sort order
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            Tuple of (messages list, total count)
        """
        # Build base query - only messages involving the user
        base_query = self.db.query(DirectMessage).options(
            joinedload(DirectMessage.from_user),
            joinedload(DirectMessage.to_user),
            joinedload(DirectMessage.media_attachments),
        ).filter(
            or_(
                DirectMessage.from_user_id == user_id,
                DirectMessage.to_user_id == user_id,
            )
        )

        # Apply filters
        filters = []

        # Text search in content
        if query.strip():
            search_terms = query.strip().split()
            search_conditions = []
            for term in search_terms:
                search_conditions.append(
                    DirectMessage.content.ilike(f"%{term}%")
                )
            if search_conditions:
                filters.append(or_(*search_conditions))

        # Other user filter
        if other_user_id:
            filters.append(
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

        # Date filters
        if date_from:
            filters.append(DirectMessage.created_at >= date_from)
        if date_to:
            filters.append(DirectMessage.created_at <= date_to)

        # Apply all filters
        if filters:
            base_query = base_query.filter(and_(*filters))

        # Get total count
        total = base_query.count()

        # Apply sorting
        if sort_by == SortBy.CREATED_AT:
            sort_field = DirectMessage.created_at
        elif sort_by == SortBy.UPDATED_AT:
            sort_field = DirectMessage.updated_at
        else:
            sort_field = DirectMessage.created_at

        if sort_order == SortOrder.DESC:
            base_query = base_query.order_by(desc(sort_field))
        else:
            base_query = base_query.order_by(sort_field)

        # Apply pagination
        messages = base_query.offset(skip).limit(limit).all()

        return messages, total

    def search_task_chat_messages(
        self,
        query: str,
        user_id: int,
        task_id: Optional[int] = None,
        user_filter: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        sort_by: SortBy = SortBy.CREATED_AT,
        sort_order: SortOrder = SortOrder.DESC,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[TaskChatMessage], int]:
        """
        Search task chat messages.

        Args:
            query: Search query string
            user_id: User performing the search
            task_id: Optional task ID to filter by
            user_filter: Optional user ID to filter by
            date_from: Optional start date filter
            date_to: Optional end date filter
            sort_by: Sort field
            sort_order: Sort order
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            Tuple of (messages list, total count)
        """
        # Build base query
        base_query = self.db.query(TaskChatMessage).options(
            joinedload(TaskChatMessage.from_user),
            joinedload(TaskChatMessage.task),
            joinedload(TaskChatMessage.media_attachments),
        )

        # Apply filters
        filters = []

        # Text search in content
        if query.strip():
            search_terms = query.strip().split()
            search_conditions = []
            for term in search_terms:
                search_conditions.append(
                    TaskChatMessage.content.ilike(f"%{term}%")
                )
            if search_conditions:
                filters.append(or_(*search_conditions))

        # Task filter
        if task_id:
            # Check if user has access to this task
            if not self._user_has_task_access(task_id, user_id):
                return [], 0
            filters.append(TaskChatMessage.task_id == task_id)
        else:
            # User must have access to tasks
            accessible_tasks = self._get_accessible_task_ids(user_id)
            if accessible_tasks:
                filters.append(TaskChatMessage.task_id.in_(accessible_tasks))
            else:
                # No accessible tasks, return empty result
                return [], 0

        # User filter
        if user_filter:
            filters.append(TaskChatMessage.from_user_id == user_filter)

        # Date filters
        if date_from:
            filters.append(TaskChatMessage.created_at >= date_from)
        if date_to:
            filters.append(TaskChatMessage.created_at <= date_to)

        # Apply all filters
        if filters:
            base_query = base_query.filter(and_(*filters))

        # Get total count
        total = base_query.count()

        # Apply sorting
        if sort_by == SortBy.CREATED_AT:
            sort_field = TaskChatMessage.created_at
        elif sort_by == SortBy.UPDATED_AT:
            sort_field = TaskChatMessage.updated_at
        elif sort_by == SortBy.USER:
            sort_field = TaskChatMessage.from_user_id
        else:
            sort_field = TaskChatMessage.created_at

        if sort_order == SortOrder.DESC:
            base_query = base_query.order_by(desc(sort_field))
        else:
            base_query = base_query.order_by(sort_field)

        # Apply pagination
        messages = base_query.offset(skip).limit(limit).all()

        return messages, total

    def search_all_content(
        self,
        query: str,
        user_id: int,
        search_types: List[SearchType] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        sort_by: SortBy = SortBy.CREATED_AT,
        sort_order: SortOrder = SortOrder.DESC,
        skip: int = 0,
        limit: int = 50,
    ) -> Dict[str, Tuple[List, int]]:
        """
        Search across all content types.

        Args:
            query: Search query string
            user_id: User performing the search
            search_types: List of content types to search
            date_from: Optional start date filter
            date_to: Optional end date filter
            sort_by: Sort field
            sort_order: Sort order
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            Dictionary with search results for each content type
        """
        if search_types is None:
            search_types = [
                SearchType.COMMENTS,
                SearchType.DIRECT_MESSAGES,
                SearchType.TASK_CHAT_MESSAGES,
            ]

        results = {}

        # Search comments
        if SearchType.COMMENTS in search_types:
            comments, comments_total = self.search_comments(
                query=query,
                user_id=user_id,
                date_from=date_from,
                date_to=date_to,
                sort_by=sort_by,
                sort_order=sort_order,
                skip=skip,
                limit=limit,
            )
            results["comments"] = (comments, comments_total)

        # Search direct messages
        if SearchType.DIRECT_MESSAGES in search_types:
            messages, messages_total = self.search_direct_messages(
                query=query,
                user_id=user_id,
                date_from=date_from,
                date_to=date_to,
                sort_by=sort_by,
                sort_order=sort_order,
                skip=skip,
                limit=limit,
            )
            results["direct_messages"] = (messages, messages_total)

        # Search task chat messages
        if SearchType.TASK_CHAT_MESSAGES in search_types:
            chat_messages, chat_total = self.search_task_chat_messages(
                query=query,
                user_id=user_id,
                date_from=date_from,
                date_to=date_to,
                sort_by=sort_by,
                sort_order=sort_order,
                skip=skip,
                limit=limit,
            )
            results["task_chat_messages"] = (chat_messages, chat_total)

        return results

    def get_recent_activity(
        self,
        user_id: int,
        days: int = 7,
        limit: int = 50,
    ) -> Dict[str, List]:
        """
        Get recent activity for a user.

        Args:
            user_id: User ID
            days: Number of days to look back
            limit: Maximum number of items per type

        Returns:
            Dictionary with recent activity items
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Get accessible tasks
        accessible_tasks = self._get_accessible_task_ids(user_id)

        results = {}

        # Recent comments
        if accessible_tasks:
            recent_comments = (
                self.db.query(TaskComment)
                .options(
                    joinedload(TaskComment.user),
                    joinedload(TaskComment.task),
                )
                .filter(
                    TaskComment.task_id.in_(accessible_tasks),
                    TaskComment.created_at >= cutoff_date,
                )
                .order_by(desc(TaskComment.created_at))
                .limit(limit)
                .all()
            )
            results["recent_comments"] = recent_comments

        # Recent direct messages
        recent_messages = (
            self.db.query(DirectMessage)
            .options(
                joinedload(DirectMessage.from_user),
                joinedload(DirectMessage.to_user),
            )
            .filter(
                or_(
                    DirectMessage.from_user_id == user_id,
                    DirectMessage.to_user_id == user_id,
                ),
                DirectMessage.created_at >= cutoff_date,
            )
            .order_by(desc(DirectMessage.created_at))
            .limit(limit)
            .all()
        )
        results["recent_messages"] = recent_messages

        # Recent task chat messages
        if accessible_tasks:
            recent_chat = (
                self.db.query(TaskChatMessage)
                .options(
                    joinedload(TaskChatMessage.from_user),
                    joinedload(TaskChatMessage.task),
                )
                .filter(
                    TaskChatMessage.task_id.in_(accessible_tasks),
                    TaskChatMessage.created_at >= cutoff_date,
                )
                .order_by(desc(TaskChatMessage.created_at))
                .limit(limit)
                .all()
            )
            results["recent_chat"] = recent_chat

        return results

    def _get_accessible_task_ids(self, user_id: int) -> List[int]:
        """
        Get task IDs that a user has access to.

        Args:
            user_id: User ID

        Returns:
            List of accessible task IDs
        """
        # User has access to tasks they created or are assigned to
        accessible_tasks = (
            self.db.query(Task.id)
            .filter(
                or_(
                    Task.created_by_id == user_id,
                    Task.assigned_to_id == user_id,
                )
            )
            .all()
        )

        return [task.id for task in accessible_tasks]

    def _user_has_task_access(self, task_id: int, user_id: int) -> bool:
        """
        Check if user has access to a specific task.

        Args:
            task_id: Task ID
            user_id: User ID

        Returns:
            True if user has access
        """
        task = (
            self.db.query(Task)
            .filter(
                Task.id == task_id,
                or_(
                    Task.created_by_id == user_id,
                    Task.assigned_to_id == user_id,
                )
            )
            .first()
        )

        return task is not None
