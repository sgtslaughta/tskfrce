"""
Workflow service for TaaskMaaster.

This module contains business logic for task workflow management,
status transitions, approvals, and status history tracking.
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Set, Tuple

from sqlalchemy import and_, desc
from sqlalchemy.orm import Session, joinedload

from app.core.logging import get_logger
from app.models.comment import TaskStatusHistory
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.services.comment_service import CommentService

logger = get_logger(__name__)


class WorkflowTransition(str, Enum):
    """Valid workflow transitions."""
    
    # Assignment transitions
    TODO_TO_ASSIGNED = "todo_to_assigned"
    ASSIGNED_TO_IN_PROGRESS = "assigned_to_in_progress"
    
    # Progress transitions
    IN_PROGRESS_TO_SUBMITTED = "in_progress_to_submitted_for_approval"
    SUBMITTED_TO_DONE = "submitted_for_approval_to_done"
    
    # Rejection transitions
    SUBMITTED_TO_IN_PROGRESS = "submitted_for_approval_to_in_progress"
    
    # Direct transitions (for admins)
    TODO_TO_IN_PROGRESS = "todo_to_in_progress"
    TODO_TO_DONE = "todo_to_done"
    IN_PROGRESS_TO_DONE = "in_progress_to_done"
    
    # Cancel transitions
    ANY_TO_CANCELLED = "any_to_cancelled"


class WorkflowService:
    """Service for managing task workflow and status transitions."""

    def __init__(self, db: Session):
        """Initialize workflow service with database session."""
        self.db = db
        self.comment_service = CommentService(db)

        # Define valid status transitions
        self._transitions = {
            TaskStatus.TODO: {
                TaskStatus.ASSIGNED,
                TaskStatus.IN_PROGRESS,  # Direct for admins
                TaskStatus.DONE,  # Direct for admins
                TaskStatus.CANCELLED,
            },
            TaskStatus.ASSIGNED: {
                TaskStatus.IN_PROGRESS,
                TaskStatus.CANCELLED,
            },
            TaskStatus.IN_PROGRESS: {
                TaskStatus.SUBMITTED_FOR_APPROVAL,
                TaskStatus.DONE,  # Direct for admins
                TaskStatus.CANCELLED,
            },
            TaskStatus.SUBMITTED_FOR_APPROVAL: {
                TaskStatus.DONE,  # Only by task creator/approver
                TaskStatus.IN_PROGRESS,  # Rejection
                TaskStatus.CANCELLED,
            },
            TaskStatus.REVIEW: {  # Legacy status
                TaskStatus.DONE,
                TaskStatus.IN_PROGRESS,
                TaskStatus.CANCELLED,
            },
            TaskStatus.DONE: {
                TaskStatus.IN_PROGRESS,  # Reopen if needed
            },
            TaskStatus.CANCELLED: {
                TaskStatus.TODO,  # Restore
                TaskStatus.ASSIGNED,
                TaskStatus.IN_PROGRESS,
            },
        }

    def transition_task_status(
        self,
        task_id: int,
        new_status: TaskStatus,
        user_id: int,
        comment: Optional[str] = None,
        force: bool = False,
    ) -> Task:
        """
        Transition a task to a new status with workflow validation.

        Args:
            task_id: Task ID
            new_status: New status to transition to
            user_id: User ID performing the transition
            comment: Optional comment explaining the transition
            force: Whether to force the transition (admin only)

        Returns:
            Updated Task instance

        Raises:
            ValueError: If transition is invalid or user lacks permission
        """
        # Get task with relationships
        task = (
            self.db.query(Task)
            .options(
                joinedload(Task.created_by),
                joinedload(Task.assigned_to),
            )
            .filter(Task.id == task_id)
            .first()
        )

        if not task:
            raise ValueError(f"Task {task_id} not found")

        # Store previous status
        previous_status = task.status

        # Skip if already in target status
        if previous_status == new_status:
            logger.info(f"Task {task_id} already in status {new_status}")
            return task

        # Validate transition
        if not force:
            self._validate_transition(task, new_status, user_id)

        # Perform the transition
        task.status = new_status
        task.updated_at = datetime.utcnow()

        # Set workflow-specific timestamps
        if new_status == TaskStatus.SUBMITTED_FOR_APPROVAL:
            task.submitted_for_approval_at = datetime.utcnow()
        elif new_status == TaskStatus.DONE and previous_status == TaskStatus.SUBMITTED_FOR_APPROVAL:
            task.approved_at = datetime.utcnow()
            task.approved_by_id = user_id
            task.completed_at = datetime.utcnow()
        elif new_status == TaskStatus.DONE:
            task.completed_at = datetime.utcnow()

        # Record status change in history
        self._record_status_change(
            task_id=task_id,
            previous_status=previous_status,
            new_status=new_status,
            user_id=user_id,
            comment=comment,
        )

        # Create system comment
        system_comment = self._generate_status_change_comment(
            previous_status, new_status, user_id, comment
        )
        
        self.comment_service.create_system_comment(
            task_id=task_id,
            content=system_comment,
            user_id=user_id,
        )

        self.db.commit()
        self.db.refresh(task)

        # Send notifications (async, don't wait for completion)
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
            
            # Send appropriate notification based on transition
            if new_status == TaskStatus.SUBMITTED_FOR_APPROVAL:
                # Notify task creator about approval request
                asyncio.create_task(
                    notification_service.notify_task_approval_request(task, user_id)
                )
            else:
                # General status change notification
                asyncio.create_task(
                    notification_service.notify_task_status_changed(
                        task, previous_status.value, new_status.value, user_id, comment
                    )
                )
        except Exception as e:
            logger.warning(f"Failed to send workflow notification: {e}")

        logger.info(
            f"Transitioned task {task_id} from {previous_status} to {new_status} by user {user_id}"
        )

        return task

    def approve_task(
        self,
        task_id: int,
        approver_id: int,
        comment: Optional[str] = None,
    ) -> Task:
        """
        Approve a task that's submitted for approval.

        Args:
            task_id: Task ID
            approver_id: User ID of the approver
            comment: Optional approval comment

        Returns:
            Updated Task instance

        Raises:
            ValueError: If task not found or user lacks permission
        """
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise ValueError(f"Task {task_id} not found")

        if task.status != TaskStatus.SUBMITTED_FOR_APPROVAL:
            raise ValueError(f"Task {task_id} is not submitted for approval")

        # Check if user can approve (task creator or admin)
        if task.created_by_id != approver_id:
            # TODO: Add admin role check
            raise ValueError("Only task creator can approve completion")

        approval_comment = comment or "Task approved"
        
        # Perform the transition
        updated_task = self.transition_task_status(
            task_id=task_id,
            new_status=TaskStatus.DONE,
            user_id=approver_id,
            comment=approval_comment,
        )

        # Send approval notification (async, don't wait for completion)
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
            
            # Send approval notification
            asyncio.create_task(
                notification_service.notify_task_approved(updated_task, approver_id, comment)
            )
        except Exception as e:
            logger.warning(f"Failed to send approval notification: {e}")

        return updated_task

    def reject_task(
        self,
        task_id: int,
        rejector_id: int,
        reason: str,
    ) -> Task:
        """
        Reject a task that's submitted for approval.

        Args:
            task_id: Task ID
            rejector_id: User ID of the rejector
            reason: Reason for rejection

        Returns:
            Updated Task instance

        Raises:
            ValueError: If task not found or user lacks permission
        """
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise ValueError(f"Task {task_id} not found")

        if task.status != TaskStatus.SUBMITTED_FOR_APPROVAL:
            raise ValueError(f"Task {task_id} is not submitted for approval")

        # Check if user can reject (task creator or admin)
        if task.created_by_id != rejector_id:
            # TODO: Add admin role check
            raise ValueError("Only task creator can reject submission")

        rejection_comment = f"Task rejected: {reason}"
        
        # Perform the transition
        updated_task = self.transition_task_status(
            task_id=task_id,
            new_status=TaskStatus.IN_PROGRESS,
            user_id=rejector_id,
            comment=rejection_comment,
        )

        # Send rejection notification (async, don't wait for completion)
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
            
            # Send rejection notification
            asyncio.create_task(
                notification_service.notify_task_rejected(updated_task, rejector_id, reason)
            )
        except Exception as e:
            logger.warning(f"Failed to send rejection notification: {e}")

        return updated_task

    def get_task_status_history(
        self,
        task_id: int,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[TaskStatusHistory], int]:
        """
        Get status change history for a task.

        Args:
            task_id: Task ID
            user_id: User ID for permission checking
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            Tuple of (history list, total count)
        """
        # Verify user has access to task
        if not self._user_has_task_access(task_id, user_id):
            raise ValueError("Insufficient permissions to view task history")

        # Get total count
        total = (
            self.db.query(TaskStatusHistory)
            .filter(TaskStatusHistory.task_id == task_id)
            .count()
        )

        # Get history with user information
        history = (
            self.db.query(TaskStatusHistory)
            .options(joinedload(TaskStatusHistory.user))
            .filter(TaskStatusHistory.task_id == task_id)
            .order_by(TaskStatusHistory.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return history, total

    def get_valid_transitions(
        self,
        task_id: int,
        user_id: int,
    ) -> List[TaskStatus]:
        """
        Get valid status transitions for a task based on current status and user permissions.

        Args:
            task_id: Task ID
            user_id: User ID

        Returns:
            List of valid target statuses
        """
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return []

        # Get base valid transitions
        valid_statuses = list(self._transitions.get(task.status, set()))

        # Filter based on user permissions
        filtered_statuses = []
        for status in valid_statuses:
            try:
                # Check if user can make this transition
                self._validate_transition(task, status, user_id)
                filtered_statuses.append(status)
            except ValueError:
                # User can't make this transition
                continue

        return filtered_statuses

    def _validate_transition(
        self,
        task: Task,
        new_status: TaskStatus,
        user_id: int,
    ) -> None:
        """
        Validate if a status transition is allowed.

        Args:
            task: Task instance
            new_status: Target status
            user_id: User ID performing the transition

        Raises:
            ValueError: If transition is invalid
        """
        current_status = task.status

        # Check if transition is valid in workflow
        valid_transitions = self._transitions.get(current_status, set())
        if new_status not in valid_transitions:
            raise ValueError(
                f"Invalid transition from {current_status} to {new_status}"
            )

        # Check user permissions for specific transitions
        if new_status == TaskStatus.ASSIGNED:
            # Only task creator can assign
            if task.created_by_id != user_id:
                raise ValueError("Only task creator can assign tasks")

        elif new_status == TaskStatus.IN_PROGRESS:
            # Only assigned user can start work (or creator/admin)
            if (
                task.assigned_to_id != user_id
                and task.created_by_id != user_id
                # TODO: Add admin check
            ):
                raise ValueError("Only assigned user can start task")

        elif new_status == TaskStatus.SUBMITTED_FOR_APPROVAL:
            # Only assigned user can submit for approval
            if task.assigned_to_id != user_id:
                raise ValueError("Only assigned user can submit for approval")

        elif new_status == TaskStatus.DONE:
            # From SUBMITTED_FOR_APPROVAL: only creator can approve
            if current_status == TaskStatus.SUBMITTED_FOR_APPROVAL:
                if task.created_by_id != user_id:
                    raise ValueError("Only task creator can approve completion")
            # From other statuses: creator or assignee can mark done
            elif (
                task.created_by_id != user_id
                and task.assigned_to_id != user_id
                # TODO: Add admin check
            ):
                raise ValueError("Insufficient permissions to mark task as done")

    def _record_status_change(
        self,
        task_id: int,
        previous_status: TaskStatus,
        new_status: TaskStatus,
        user_id: int,
        comment: Optional[str] = None,
    ) -> TaskStatusHistory:
        """
        Record a status change in the history table.

        Args:
            task_id: Task ID
            previous_status: Previous status
            new_status: New status
            user_id: User who made the change
            comment: Optional comment

        Returns:
            Created TaskStatusHistory instance
        """
        history = TaskStatusHistory(
            task_id=task_id,
            user_id=user_id,
            previous_status=previous_status.value,
            new_status=new_status.value,
            comment=comment,
        )

        self.db.add(history)
        self.db.flush()  # Get the ID

        logger.info(f"Recorded status change for task {task_id}: {previous_status} -> {new_status}")
        return history

    def _generate_status_change_comment(
        self,
        previous_status: TaskStatus,
        new_status: TaskStatus,
        user_id: int,
        comment: Optional[str] = None,
    ) -> str:
        """
        Generate a system comment for status changes.

        Args:
            previous_status: Previous status
            new_status: New status
            user_id: User who made the change
            comment: Optional user comment

        Returns:
            System comment text
        """
        # Get user info
        user = self.db.query(User).filter(User.id == user_id).first()
        username = user.username if user else f"User {user_id}"

        # Generate base message
        status_messages = {
            TaskStatus.ASSIGNED: "assigned this task",
            TaskStatus.IN_PROGRESS: "started working on this task",
            TaskStatus.SUBMITTED_FOR_APPROVAL: "submitted this task for approval",
            TaskStatus.DONE: "marked this task as complete",
            TaskStatus.CANCELLED: "cancelled this task",
        }

        base_message = status_messages.get(
            new_status,
            f"changed status from {previous_status.value} to {new_status.value}"
        )

        system_comment = f"**{username}** {base_message}"

        # Add user comment if provided
        if comment:
            system_comment += f"\n\n> {comment}"

        return system_comment

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
