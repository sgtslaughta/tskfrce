"""
Permission service for TaaskMaaster.

This module contains business logic for managing permissions and access control
for comments, messages, and other resources.
"""

from enum import Enum
from typing import Dict, List, Optional, Set
from datetime import datetime

from sqlalchemy.orm import Session, joinedload

from app.core.logging import get_logger
from app.models.task_comment import TaskComment
from app.models.direct_message import DirectMessage
from app.models.comment import TaskChatMessage
from app.models.task import Task
from app.models.user import User, UserRole

logger = get_logger(__name__)


class Permission(str, Enum):
    """Permission types for different operations."""
    
    # Task permissions
    TASK_VIEW = "task:view"
    TASK_EDIT = "task:edit"
    TASK_DELETE = "task:delete"
    TASK_ASSIGN = "task:assign"
    TASK_APPROVE = "task:approve"
    TASK_COMMENT = "task:comment"
    
    # Comment permissions
    COMMENT_VIEW = "comment:view"
    COMMENT_CREATE = "comment:create"
    COMMENT_EDIT = "comment:edit"
    COMMENT_DELETE = "comment:delete"
    COMMENT_MODERATE = "comment:moderate"
    
    # Message permissions
    MESSAGE_SEND = "message:send"
    MESSAGE_VIEW = "message:view"
    MESSAGE_DELETE = "message:delete"
    
    # Admin permissions
    ADMIN_ALL = "admin:all"
    ADMIN_USERS = "admin:users"
    ADMIN_TASKS = "admin:tasks"
    ADMIN_MODERATE = "admin:moderate"


# UserRole is now imported from app.models.user


class PermissionService:
    """Service for managing permissions and access control."""

    def __init__(self, db: Session):
        """Initialize permission service with database session."""
        self.db = db
        
        # Role-based permission mapping
        self.role_permissions = {
            UserRole.ADMIN: {
                Permission.ADMIN_ALL,
                Permission.ADMIN_USERS,
                Permission.ADMIN_TASKS,
                Permission.ADMIN_MODERATE,
                Permission.TASK_VIEW,
                Permission.TASK_EDIT,
                Permission.TASK_DELETE,
                Permission.TASK_ASSIGN,
                Permission.TASK_APPROVE,
                Permission.TASK_COMMENT,
                Permission.COMMENT_VIEW,
                Permission.COMMENT_CREATE,
                Permission.COMMENT_EDIT,
                Permission.COMMENT_DELETE,
                Permission.COMMENT_MODERATE,
                Permission.MESSAGE_SEND,
                Permission.MESSAGE_VIEW,
                Permission.MESSAGE_DELETE,
            },
            UserRole.ORGANIZER: {
                Permission.TASK_VIEW,
                Permission.TASK_EDIT,
                Permission.TASK_ASSIGN,
                Permission.TASK_APPROVE,
                Permission.TASK_COMMENT,
                Permission.COMMENT_VIEW,
                Permission.COMMENT_CREATE,
                Permission.COMMENT_EDIT,
                Permission.COMMENT_DELETE,
                Permission.MESSAGE_SEND,
                Permission.MESSAGE_VIEW,
            },
            UserRole.USER: {
                Permission.TASK_VIEW,
                Permission.TASK_COMMENT,
                Permission.COMMENT_VIEW,
                Permission.COMMENT_CREATE,
                Permission.MESSAGE_SEND,
                Permission.MESSAGE_VIEW,
            }
        }

    def get_user_role(self, user_id: int) -> UserRole:
        """
        Get user role from database or user attributes.
        
        Args:
            user_id: User ID
            
        Returns:
            User role enum
        """
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return UserRole.USER  # Default to USER instead of GUEST
        
        # User model has role field
        if hasattr(user, 'role') and user.role:
            return UserRole(user.role)
        
        # Fallback logic
        if hasattr(user, 'is_superuser') and user.is_superuser:
            return UserRole.ADMIN
        else:
            return UserRole.USER

    def has_permission(
        self,
        user_id: int,
        permission: Permission,
        resource_id: Optional[int] = None,
        resource_type: Optional[str] = None
    ) -> bool:
        """
        Check if user has a specific permission.
        
        Args:
            user_id: User ID
            permission: Permission to check
            resource_id: Optional resource ID for context-specific permissions
            resource_type: Optional resource type (task, comment, message)
            
        Returns:
            True if user has permission
        """
        try:
            user_role = self.get_user_role(user_id)
            
            # Admin has all permissions
            if user_role == UserRole.ADMIN:
                return True
            
            # Check context-specific permissions first (task creator/assignee access)
            if resource_id and resource_type:
                context_permission = self._check_context_permission(
                    user_id, permission, resource_id, resource_type
                )
                if context_permission:
                    return True
            
            # Check role-based permissions as fallback
            role_perms = self.role_permissions.get(user_role, set())
            return permission in role_perms
            
        except Exception as e:
            logger.error(f"Error checking permission: {e}")
            return False

    def _check_context_permission(
        self,
        user_id: int,
        permission: Permission,
        resource_id: Optional[int],
        resource_type: Optional[str]
    ) -> bool:
        """
        Check context-specific permissions.
        
        Args:
            user_id: User ID
            permission: Permission to check
            resource_id: Resource ID
            resource_type: Resource type
            
        Returns:
            True if user has contextual permission
        """
        if not resource_id or not resource_type:
            return False  # No context to check, rely on role-based permissions
        
        try:
            if resource_type == "task":
                return self._check_task_permission(user_id, permission, resource_id)
            elif resource_type == "comment":
                return self._check_comment_permission(user_id, permission, resource_id)
            elif resource_type == "message":
                return self._check_message_permission(user_id, permission, resource_id)
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking context permission: {e}")
            return False

    def _check_task_permission(
        self,
        user_id: int,
        permission: Permission,
        task_id: int
    ) -> bool:
        """Check task-specific permissions."""
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return False
        
        # Task creator has full permissions
        if task.created_by_id == user_id:
            return True
        
        # Task assignee has view and comment permissions
        if task.assigned_to_id == user_id:
            return permission in {
                Permission.TASK_VIEW,
                Permission.TASK_COMMENT,
                Permission.COMMENT_VIEW,
                Permission.COMMENT_CREATE
            }
        
        # Public tasks can be viewed by anyone
        # TODO: Add visibility field to Task model
        if permission == Permission.TASK_VIEW:
            return True
        
        return False

    def _check_comment_permission(
        self,
        user_id: int,
        permission: Permission,
        comment_id: int
    ) -> bool:
        """Check comment-specific permissions."""
        comment = self.db.query(TaskComment).filter(
            TaskComment.id == comment_id
        ).first()
        
        if not comment:
            return False
        
        # Comment author can edit/delete their own comments
        if comment.user_id == user_id:
            return permission in {
                Permission.COMMENT_VIEW,
                Permission.COMMENT_EDIT,
                Permission.COMMENT_DELETE
            }
        
        # Check if user has access to the task
        if self._check_task_permission(user_id, Permission.TASK_VIEW, comment.task_id):
            return permission == Permission.COMMENT_VIEW
        
        return False

    def _check_message_permission(
        self,
        user_id: int,
        permission: Permission,
        message_id: int
    ) -> bool:
        """Check message-specific permissions."""
        message = self.db.query(DirectMessage).filter(
            DirectMessage.id == message_id
        ).first()
        
        if not message:
            return False
        
        # Message participants can view messages
        if user_id in [message.from_user_id, message.to_user_id]:
            return permission in {Permission.MESSAGE_VIEW, Permission.MESSAGE_DELETE}
        
        return False

    def filter_visible_tasks(
        self,
        user_id: int,
        tasks: List[Task]
    ) -> List[Task]:
        """
        Filter tasks based on user permissions.
        
        Args:
            user_id: User ID
            tasks: List of tasks to filter
            
        Returns:
            Filtered list of tasks user can view
        """
        visible_tasks = []
        
        for task in tasks:
            if self.has_permission(
                user_id, Permission.TASK_VIEW, task.id, "task"
            ):
                visible_tasks.append(task)
        
        return visible_tasks

    def filter_visible_comments(
        self,
        user_id: int,
        comments: List[TaskComment]
    ) -> List[TaskComment]:
        """
        Filter comments based on user permissions.
        
        Args:
            user_id: User ID
            comments: List of comments to filter
            
        Returns:
            Filtered list of comments user can view
        """
        visible_comments = []
        
        for comment in comments:
            if self.has_permission(
                user_id, Permission.COMMENT_VIEW, comment.id, "comment"
            ):
                visible_comments.append(comment)
        
        return visible_comments

    def can_user_edit_comment(self, user_id: int, comment_id: int) -> bool:
        """
        Check if user can edit a specific comment.
        
        Args:
            user_id: User ID
            comment_id: Comment ID
            
        Returns:
            True if user can edit comment
        """
        return self.has_permission(
            user_id, Permission.COMMENT_EDIT, comment_id, "comment"
        )

    def can_user_delete_comment(self, user_id: int, comment_id: int) -> bool:
        """
        Check if user can delete a specific comment.
        
        Args:
            user_id: User ID
            comment_id: Comment ID
            
        Returns:
            True if user can delete comment
        """
        return self.has_permission(
            user_id, Permission.COMMENT_DELETE, comment_id, "comment"
        )

    def can_user_approve_task(self, user_id: int, task_id: int) -> bool:
        """
        Check if user can approve a task.
        
        Args:
            user_id: User ID
            task_id: Task ID
            
        Returns:
            True if user can approve task
        """
        return self.has_permission(
            user_id, Permission.TASK_APPROVE, task_id, "task"
        )

    def get_user_permissions(self, user_id: int) -> Set[Permission]:
        """
        Get all permissions for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            Set of permissions user has
        """
        user_role = self.get_user_role(user_id)
        return self.role_permissions.get(user_role, set())

    def get_accessible_task_ids(self, user_id: int) -> List[int]:
        """
        Get list of task IDs user can access.
        
        Args:
            user_id: User ID
            
        Returns:
            List of accessible task IDs
        """
        user_role = self.get_user_role(user_id)
        
        if user_role == UserRole.ADMIN:
            # Admin can see all tasks
            tasks = self.db.query(Task.id).all()
            return [task.id for task in tasks]
        
        # Regular users can see tasks they created or are assigned to
        tasks = self.db.query(Task.id).filter(
            (Task.created_by_id == user_id) | (Task.assigned_to_id == user_id)
        ).all()
        
        return [task.id for task in tasks]

    def validate_bulk_operation_permissions(
        self,
        user_id: int,
        operation: str,
        resource_ids: List[int],
        resource_type: str
    ) -> Dict[str, List[int]]:
        """
        Validate permissions for bulk operations.
        
        Args:
            user_id: User ID
            operation: Operation type (edit, delete, etc.)
            resource_ids: List of resource IDs
            resource_type: Type of resource
            
        Returns:
            Dictionary with allowed and denied resource IDs
        """
        allowed = []
        denied = []
        
        permission_map = {
            "edit": {
                "comment": Permission.COMMENT_EDIT,
                "task": Permission.TASK_EDIT,
            },
            "delete": {
                "comment": Permission.COMMENT_DELETE,
                "task": Permission.TASK_DELETE,
                "message": Permission.MESSAGE_DELETE,
            },
            "view": {
                "comment": Permission.COMMENT_VIEW,
                "task": Permission.TASK_VIEW,
                "message": Permission.MESSAGE_VIEW,
            }
        }
        
        permission = permission_map.get(operation, {}).get(resource_type)
        if not permission:
            return {"allowed": [], "denied": resource_ids}
        
        for resource_id in resource_ids:
            if self.has_permission(user_id, permission, resource_id, resource_type):
                allowed.append(resource_id)
            else:
                denied.append(resource_id)
        
        return {"allowed": allowed, "denied": denied}
