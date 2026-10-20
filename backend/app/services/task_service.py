"""
Task service for TaaskMaaster.

This module contains business logic for advanced task management including
templates, categories, tags, dependencies, and recurring tasks.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import io
import csv
import json

from sqlalchemy import and_, desc, or_
from sqlalchemy.orm import Session, selectinload

from app.core.logging import get_logger
from app.models.task import (
    RecurrenceType,
    Task,
    TaskCategory,
    TaskPriority,
    TaskStatus,
    TaskTag,
    TaskTagAssociation,
    TaskTemplate,
    RewardType,
)
from app.schemas.task import (
    TaskCategoryCreate,
    TaskCreate,
    TaskTagCreate,
    TaskTemplateCreate,
    TaskUpdate,
    TaskBulkUpdate,
    TaskExportRequest,
)
from app.services.redis_service import redis_service
from app.models.user import User, UserRole

logger = get_logger(__name__)


class TaskService:
    """Service for task management operations."""

    def __init__(self, db: Session):
        """Initialize task service with database session."""
        self.db = db

    async def create_task(self, task_data: TaskCreate, created_by_id: int) -> Task:
        """
        Create a new task with advanced features.

        Args:
            task_data: Task creation data
            created_by_id: ID of user creating the task

        Returns:
            Created task instance
        """
        # Create task instance
        task = Task(
            title=task_data.title,
            description=task_data.description,
            priority=task_data.priority,
            due_date=task_data.due_date,
            estimated_hours=task_data.estimated_hours,
            points=task_data.points,
            reward_type=task_data.reward_type,
            reward_value=task_data.reward_value,
            reward_description=task_data.reward_description,
            is_recurring=task_data.is_recurring,
            recurrence_pattern=task_data.recurrence_pattern,
            template_id=task_data.template_id,
            category_id=task_data.category_id,
            created_by_id=created_by_id,
            assigned_to_id=task_data.assigned_to_id,
            parent_task_id=task_data.parent_task_id,
        )

        self.db.add(task)
        self.db.flush()  # Get the task ID

        # Add tags if provided
        if task_data.tag_names:
            self._add_tags_to_task(task.id, task_data.tag_names, created_by_id)

        # Add task creation to history (before commit)
        try:
            from app.models.comment import TaskStatusHistory
            
            # Get the creator's username
            creator = self.db.query(User).filter(User.id == created_by_id).first()
            creator_username = creator.username if creator else "Unknown"
            
            # Create history entry for task creation
            history_entry = TaskStatusHistory(
                task_id=task.id,
                user_id=created_by_id,
                previous_status=None,  # No previous status for creation
                new_status=task.status.value,
                comment=f"Task created by {creator_username}"
            )
            self.db.add(history_entry)
        except Exception as e:
            logger.error(f"Error creating task creation history: {e}")

        self.db.commit()
        self.db.refresh(task)

        # Invalidate cache for the user
        redis_service.invalidate_task_cache(created_by_id, task.id)
        if task.assigned_to_id and task.assigned_to_id != created_by_id:
            redis_service.invalidate_task_cache(task.assigned_to_id, task.id)

        logger.info(f"Created task {task.id} by user {created_by_id}")
        
        # Send notifications for task creation
        try:
            from app.services.notification_service import NotificationService
            notification_service = NotificationService(self.db)
            
            # Notify assignee if task is assigned to someone else
            if task.assigned_to_id and task.assigned_to_id != created_by_id:
                await notification_service.notify_task_created(task, created_by_id)
        except Exception as e:
            logger.error(f"Error sending task creation notification: {e}")
        
        return task

    def bulk_update_tasks(self, bulk_update_data: TaskBulkUpdate, user_id: int) -> List[Task]:
        """
        Bulk update multiple tasks.

        Args:
            bulk_update_data: Bulk update data containing task IDs and updates
            user_id: ID of user performing the update

        Returns:
            List of updated task instances
        """
        updated_tasks = []
        
        for task_id in bulk_update_data.task_ids:
            task = self.get_task(task_id, user_id)
            if not task:
                logger.warning(f"Task {task_id} not found or access denied for user {user_id}")
                continue
                
            # Apply updates
            update_data = bulk_update_data.updates.dict(exclude_unset=True)

            # Handle enum fields separately
            if "status" in update_data:
                task.status = TaskStatus(update_data.pop("status"))
            if "priority" in update_data:
                task.priority = TaskPriority(update_data.pop("priority"))
            if "reward_type" in update_data:
                task.reward_type = RewardType(update_data.pop("reward_type"))

            # Update remaining fields
            for field, value in update_data.items():
                if hasattr(task, field):
                    setattr(task, field, value)
            
            task.updated_at = datetime.utcnow()
            updated_tasks.append(task)
        
        self.db.commit()
        
        # Invalidate cache for all updated tasks
        for task in updated_tasks:
            redis_service.invalidate_task_cache(task.created_by_id, task.id)
            if task.assigned_to_id and task.assigned_to_id != task.created_by_id:
                redis_service.invalidate_task_cache(task.assigned_to_id, task.id)
        
        logger.info(f"Bulk updated {len(updated_tasks)} tasks by user {user_id}")
        return updated_tasks

    def export_tasks(self, export_request: TaskExportRequest, user_id: int) -> str:
        """
        Export tasks in the specified format.

        Args:
            export_request: Export request data
            user_id: ID of user requesting export

        Returns:
            Exported data as string
        """
        # Get tasks based on filters
        query = self.db.query(Task).filter(Task.created_by_id == user_id)
        
        # Apply filters
        if export_request.filters:
            if export_request.filters.get('status'):
                query = query.filter(Task.status == TaskStatus(export_request.filters['status']))
            if export_request.filters.get('priority'):
                query = query.filter(Task.priority == TaskPriority(export_request.filters['priority']))
            if export_request.filters.get('category_id'):
                query = query.filter(Task.category_id == export_request.filters['category_id'])
        
        # Apply date range
        if export_request.date_range:
            start_date = export_request.date_range.get('start')
            end_date = export_request.date_range.get('end')
            if start_date:
                query = query.filter(Task.created_at >= start_date)
            if end_date:
                query = query.filter(Task.created_at <= end_date)
        
        # Include/exclude completed tasks
        if not export_request.include_completed:
            query = query.filter(Task.status != TaskStatus.DONE)
        
        tasks = query.all()
        
        if export_request.format.lower() == 'csv':
            return self._export_to_csv(tasks)
        elif export_request.format.lower() == 'json':
            return self._export_to_json(tasks)
        else:
            raise ValueError(f"Unsupported export format: {export_request.format}")

    def _export_to_csv(self, tasks: List[Task]) -> str:
        """
        Export tasks to CSV format.

        Args:
            tasks: List of tasks to export

        Returns:
            CSV string
        """
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'ID', 'Title', 'Description', 'Status', 'Priority', 'Due Date',
            'Completed At', 'Estimated Hours', 'Actual Hours', 'Points',
            'Reward Type', 'Reward Value', 'Reward Description',
            'Category', 'Assigned To', 'Created At', 'Updated At'
        ])
        
        # Write data
        for task in tasks:
            writer.writerow([
                task.id,
                task.title,
                task.description or '',
                task.status.value,
                task.priority.value,
                task.due_date.isoformat() if task.due_date else '',
                task.completed_at.isoformat() if task.completed_at else '',
                task.estimated_hours,
                task.actual_hours,
                task.points,
                task.reward_type.value if task.reward_type else '',
                task.reward_value,
                task.reward_description or '',
                task.category.name if task.category else '',
                task.assigned_to.username if task.assigned_to else '',
                task.created_at.isoformat(),
                task.updated_at.isoformat(),
            ])
        
        return output.getvalue()

    def _export_to_json(self, tasks: List[Task]) -> str:
        """
        Export tasks to JSON format.

        Args:
            tasks: List of tasks to export

        Returns:
            JSON string
        """
        tasks_data = []
        for task in tasks:
            task_dict = {
                'id': task.id,
                'title': task.title,
                'description': task.description,
                'status': task.status.value,
                'priority': task.priority.value,
                'due_date': task.due_date.isoformat() if task.due_date else None,
                'completed_at': task.completed_at.isoformat() if task.completed_at else None,
                'estimated_hours': task.estimated_hours,
                'actual_hours': task.actual_hours,
                'points': task.points,
                'reward_type': task.reward_type.value if task.reward_type else None,
                'reward_value': task.reward_value,
                'reward_description': task.reward_description,
                'category': task.category.name if task.category else None,
                'assigned_to': task.assigned_to.username if task.assigned_to else None,
                'created_at': task.created_at.isoformat(),
                'updated_at': task.updated_at.isoformat(),
            }
            tasks_data.append(task_dict)
        
        return json.dumps(tasks_data, indent=2)

    def get_task(self, task_id: int, user_id: int) -> Optional[Task]:
        """
        Get a task by ID with full relationships.

        Args:
            task_id: Task ID
            user_id: User ID for access control

        Returns:
            Task instance or None
        """
        # Try to get from cache first
        cached_task = redis_service.get_task_details(task_id)
        if cached_task and cached_task.get("user_id") == user_id:
            logger.info(f"Task {task_id} retrieved from cache")
            # Convert back to Task object if needed
            return self._dict_to_task(cached_task)
        
        # Get from database
        task = (
            self.db.query(Task)
            .options(
                selectinload(Task.assigned_to),
                selectinload(Task.category),
                selectinload(Task.template),
                selectinload(Task.tags),
                selectinload(Task.subtasks),
                selectinload(Task.dependencies),
                selectinload(Task.media_attachments)
            )
            .filter(
                Task.id == task_id,
                or_(
                    Task.created_by_id == user_id,
                    Task.assigned_to_id == user_id,
                ),
            )
            .first()
        )
        
        # Cache the task if found
        if task:
            task_dict = self._task_to_dict(task)
            redis_service.cache_task_details(task_id, task_dict)
        
        return task

    def get_tasks(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[TaskStatus] = None,
        priority: Optional[TaskPriority] = None,
        category_id: Optional[int] = None,
        assigned_to_id: Optional[int] = None,
        reward_type: Optional[RewardType] = None,
        search: Optional[str] = None,
    ) -> tuple[List[Task], int]:
        """
        Get tasks with filtering and pagination.

        Args:
            user_id: User ID for access control
            skip: Number of records to skip
            limit: Maximum number of records to return
            status: Filter by task status
            priority: Filter by task priority
            category_id: Filter by category
            assigned_to_id: Filter by assigned user
            search: Search in title and description

        Returns:
            Tuple of (tasks, total_count)
        """
        # Get user to check role for RBAC
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return [], 0
        
        # Try to get from cache if no filters applied (most common case)
        if not any([status, priority, category_id, assigned_to_id, reward_type, search]) and skip == 0:
            cached_tasks = redis_service.get_user_tasks(user_id)
            if cached_tasks:
                logger.info(f"User {user_id} tasks retrieved from cache with relationships")
                # Convert cached data back to Task objects with relationships
                tasks = [self._dict_to_task(task_dict) for task_dict in cached_tasks[:limit]]
                return tasks, len(cached_tasks)
        
        # Build query based on user role
        query = self.db.query(Task).options(
            selectinload(Task.assigned_to),
            selectinload(Task.category),
            selectinload(Task.template),
            selectinload(Task.tags),
            selectinload(Task.subtasks),
            selectinload(Task.dependencies),
            selectinload(Task.media_attachments)
        )
        
        # RBAC: Admins and organizers can view all tasks, regular users only their own
        if user.role in [UserRole.ADMIN, UserRole.ORGANIZER]:
            # Admins and organizers can see all tasks
            pass
        else:
            # Regular users can only see tasks they created or are assigned to
            query = query.filter(
                or_(Task.created_by_id == user_id, Task.assigned_to_id == user_id)
            )

        # Apply filters
        if status:
            query = query.filter(Task.status == status)
        if priority:
            query = query.filter(Task.priority == priority)
        if category_id:
            query = query.filter(Task.category_id == category_id)
        if assigned_to_id:
            query = query.filter(Task.assigned_to_id == assigned_to_id)
        if reward_type:
            query = query.filter(Task.reward_type == reward_type)
        if search:
            search_filter = or_(
                Task.title.ilike(f"%{search}%"),
                Task.description.ilike(f"%{search}%"),
            )
            query = query.filter(search_filter)

        total = query.count()
        tasks = (
            query.order_by(desc(Task.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

        # Cache the results if no filters applied
        if not any([status, priority, category_id, assigned_to_id, reward_type, search]) and skip == 0:
            task_dicts = [self._task_to_dict(task) for task in tasks]
            redis_service.cache_user_tasks(user_id, task_dicts)

        return tasks, total

    async def update_task(
        self, task_id: int, task_data: Dict[str, Any], user_id: int
    ) -> Optional[Task]:
        """
        Update a task.

        Args:
            task_id: Task ID
            task_data: Task update data
            user_id: User ID for access control

        Returns:
            Updated task instance or None
        """
        # Get user for RBAC
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return None
            
        # Query task directly from database
        query = (
            self.db.query(Task)
            .options(
                selectinload(Task.assigned_to),
                selectinload(Task.category),
                selectinload(Task.template),
                selectinload(Task.tags),
                selectinload(Task.subtasks),
                selectinload(Task.dependencies),
                selectinload(Task.media_attachments)
            )
            .filter(Task.id == task_id)
        )
        
        # RBAC: Admins and organizers can update any task
        if user.role.value not in [UserRole.ADMIN.value, UserRole.ORGANIZER.value]:
            # Regular users can only update their own tasks or tasks assigned to them
            query = query.filter(
                or_(
                    Task.created_by_id == user_id,
                    Task.assigned_to_id == user_id,
                )
            )
        
        task = query.first()
        if not task:
            return None

        # Store the old assigned_to_id to invalidate cache later and for notifications
        old_assigned_to_id = task.assigned_to_id
        old_task_data = {
            'title': task.title,
            'description': task.description,
            'priority': task.priority.value if task.priority else None,
            'due_date': task.due_date.isoformat() if task.due_date else None,
            'estimated_hours': task.estimated_hours,
            'points': task.points,
        }

        # Handle tags separately
        tag_names = task_data.pop("tag_names", None)
        if tag_names is not None:
            self._update_task_tags(task_id, tag_names, user_id)

        # Handle enum fields separately
        if "status" in task_data:
            try:
                task.status = TaskStatus(task_data.pop("status"))
            except ValueError as e:
                raise ValueError(f"Invalid status value: {e}")

        if "priority" in task_data:
            try:
                task.priority = TaskPriority(task_data.pop("priority"))
            except ValueError as e:
                raise ValueError(f"Invalid priority value: {e}")

        if "reward_type" in task_data:
            try:
                task.reward_type = RewardType(task_data.pop("reward_type"))
            except ValueError as e:
                raise ValueError(f"Invalid reward_type value: {e}")

        # Handle date fields
        if "due_date" in task_data and task_data["due_date"] is not None:
            try:
                task.due_date = datetime.fromisoformat(task_data.pop("due_date"))
            except ValueError as e:
                raise ValueError(f"Invalid due_date format: {e}")

        if "completed_at" in task_data and task_data["completed_at"] is not None:
            try:
                task.completed_at = datetime.fromisoformat(task_data.pop("completed_at"))
            except ValueError as e:
                raise ValueError(f"Invalid completed_at format: {e}")

        # Handle category field - convert category name to category_id
        if "category" in task_data:
            category_name = task_data.pop("category")
            if category_name is None or category_name == "":
                # Clear category
                task.category_id = None
            else:
                # Find category by name
                from app.models.task import TaskCategory
                category = self.db.query(TaskCategory).filter(TaskCategory.name == category_name).first()
                if category:
                    task.category_id = category.id
                else:
                    # Create new category if it doesn't exist
                    new_category = TaskCategory(
                        name=category_name,
                        description=f"Auto-created category: {category_name}",
                        color="#6B7280",  # Default gray color
                        created_by_id=user_id
                    )
                    self.db.add(new_category)
                    self.db.flush()  # Get the ID without committing
                    task.category_id = new_category.id

        # Update remaining fields
        for field, value in task_data.items():
            if hasattr(task, field):
                try:
                    setattr(task, field, value)
                except (ValueError, TypeError) as e:
                    raise ValueError(f"Invalid value for {field}: {e}")

        task.updated_at = datetime.utcnow()

        try:
            self.db.commit()
            self.db.refresh(task)
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Failed to update task: {e}")

        # Invalidate cache for the user who made the update
        redis_service.invalidate_task_cache(user_id, task_id)
        
        # Invalidate cache for the old assigned user (if different)
        if old_assigned_to_id and old_assigned_to_id != user_id:
            redis_service.invalidate_task_cache(old_assigned_to_id, task_id)
            
        # Invalidate cache for the new assigned user (if different from both user_id and old_assigned_to_id)
        if task.assigned_to_id and task.assigned_to_id != user_id and task.assigned_to_id != old_assigned_to_id:
            redis_service.invalidate_task_cache(task.assigned_to_id, task_id)

        logger.info(f"Updated task {task_id} by user {user_id}")
        
        # Send notifications for task updates
        try:
            from app.services.notification_service import NotificationService
            notification_service = NotificationService(self.db)
            
            # Detect changed fields
            changed_fields = []
            current_task_data = {
                'title': task.title,
                'description': task.description,
                'priority': task.priority.value if task.priority else None,
                'due_date': task.due_date.isoformat() if task.due_date else None,
                'estimated_hours': task.estimated_hours,
                'points': task.points,
            }
            
            for field, old_value in old_task_data.items():
                if current_task_data[field] != old_value:
                    changed_fields.append(field)
            
            # Handle assignment changes
            if old_assigned_to_id != task.assigned_to_id:
                # Add assignment change to history
                try:
                    from app.models.comment import TaskStatusHistory
                    
                    old_user = self.db.query(User).filter(User.id == old_assigned_to_id).first() if old_assigned_to_id else None
                    new_user = self.db.query(User).filter(User.id == task.assigned_to_id).first() if task.assigned_to_id else None
                    updater = self.db.query(User).filter(User.id == user_id).first()
                    
                    if old_assigned_to_id and task.assigned_to_id:
                        # Reassignment
                        comment = f"Task reassigned from {old_user.username} to {new_user.username} by {updater.username}"
                    elif task.assigned_to_id and not old_assigned_to_id:
                        # New assignment
                        comment = f"Task assigned to {new_user.username} by {updater.username}"
                    elif old_assigned_to_id and not task.assigned_to_id:
                        # Unassignment
                        comment = f"Task unassigned from {old_user.username} by {updater.username}"
                    else:
                        comment = f"Assignment changed by {updater.username}"
                    
                    history_entry = TaskStatusHistory(
                        task_id=task.id,
                        user_id=user_id,
                        previous_status=task.status.value,  # Status didn't change, just assignment
                        new_status=task.status.value,
                        comment=comment
                    )
                    self.db.add(history_entry)
                    self.db.commit()
                except Exception as e:
                    logger.error(f"Error creating assignment change history: {e}")
                
                # Send notifications
                if old_assigned_to_id and task.assigned_to_id:
                    # Reassignment
                    await notification_service.notify_task_reassigned(
                        task, old_assigned_to_id, task.assigned_to_id, user_id
                    )
                elif task.assigned_to_id and not old_assigned_to_id:
                    # New assignment
                    await notification_service.notify_task_assigned(
                        task, task.assigned_to_id, user_id
                    )
                # Note: We don't notify for unassignment (old_assigned_to_id and not task.assigned_to_id)
                # as it's usually part of a reassignment or intentional removal
            
            # Notify about other field changes (if any)
            if changed_fields:
                await notification_service.notify_task_updated(task, user_id, changed_fields)
                
        except Exception as e:
            logger.error(f"Error sending task update notifications: {e}")
        
        return task

    async def delete_task(self, task_id: int, user_id: int) -> bool:
        """
        Delete a task.

        Args:
            task_id: Task ID
            user_id: User ID for access control

        Returns:
            True if deleted, False otherwise
        """
        # Get user to check role for RBAC
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return False

        # Query the task directly from the database
        query = self.db.query(Task).filter(Task.id == task_id)
        
        # RBAC: Admins and organizers can delete any task
        if user.role.value not in [UserRole.ADMIN.value, UserRole.ORGANIZER.value]:
            # Regular users can only delete their own tasks or tasks assigned to them
            query = query.filter(
                or_(
                    Task.created_by_id == user_id,
                    Task.assigned_to_id == user_id,
                )
            )
        
        task = query.first()
        
        if not task:
            return False

        # Store task info for notifications before deletion
        task_title = task.title
        participants = self.get_task_participants(task_id)

        # Delete task associations first
        self.db.query(TaskTagAssociation).filter(
            TaskTagAssociation.task_id == task_id
        ).delete()

        # Delete the task
        self.db.delete(task)
        self.db.commit()

        # Invalidate cache for the user
        redis_service.invalidate_task_cache(user_id, task_id)
        if task.assigned_to_id and task.assigned_to_id != user_id:
            redis_service.invalidate_task_cache(task.assigned_to_id, task_id)

        # Send deletion notifications
        try:
            from app.services.notification_service import NotificationService
            notification_service = NotificationService(self.db)
            await notification_service.notify_task_deleted(
                task_title, task_id, user_id, participants
            )
        except Exception as e:
            logger.error(f"Error sending task deletion notification: {e}")

        logger.info(f"Deleted task {task_id} by user {user_id}")
        return True

    async def complete_task(
        self, task_id: int, user_id: int, actual_hours: Optional[float] = None
    ) -> Optional[Task]:
        """
        Mark a task as completed.

        Args:
            task_id: Task ID
            user_id: User ID for access control
            actual_hours: Actual hours spent on task

        Returns:
            Updated task instance or None
        """
        # Get user to check role for RBAC
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return None

        # Query task directly from database
        query = self.db.query(Task).filter(Task.id == task_id)
        
        # RBAC: Admins and organizers can complete any task
        if user.role.value not in [UserRole.ADMIN.value, UserRole.ORGANIZER.value]:
            # Regular users can only complete their own tasks or tasks assigned to them
            query = query.filter(
                or_(
                    Task.created_by_id == user_id,
                    Task.assigned_to_id == user_id,
                )
            )
        
        task = query.first()
        if not task:
            return None

        task.status = TaskStatus.DONE
        task.completed_at = datetime.utcnow()
        if actual_hours is not None:
            task.actual_hours = actual_hours

        # Invalidate cache before committing
        redis_service.invalidate_task_cache(user_id, task_id)
        if task.assigned_to_id and task.assigned_to_id != user_id:
            redis_service.invalidate_task_cache(task.assigned_to_id, task_id)

        try:
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Failed to complete task: {e}")

        # Query the task again to get fresh data
        task = (
            self.db.query(Task)
            .filter(Task.id == task_id)
            .first()
        )

        # Send completion notifications
        try:
            from app.services.notification_service import NotificationService
            notification_service = NotificationService(self.db)
            await notification_service.notify_task_completed(task, user_id)
        except Exception as e:
            logger.error(f"Error sending task completion notification: {e}")

        logger.info(f"Completed task {task_id} by user {user_id}")
        return task

    def create_task_template(
        self, template_data: TaskTemplateCreate, created_by_id: int
    ) -> TaskTemplate:
        """
        Create a new task template.

        Args:
            template_data: Template creation data
            created_by_id: ID of user creating the template

        Returns:
            Created template instance
        """
        template = TaskTemplate(
            name=template_data.name,
            description=template_data.description,
            title_pattern=template_data.title_pattern,
            description_template=template_data.description_template,
            estimated_hours=template_data.estimated_hours,
            points=template_data.points,
            priority=template_data.priority,
            category_id=template_data.category_id,
            tags=template_data.tags,
            is_public=template_data.is_public,
            created_by_id=created_by_id,
        )

        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)

        logger.info(
            f"Created task template {template.id} by user {created_by_id}"
        )
        return template

    def to_task_template_response(self, template: TaskTemplate) -> dict:
        """
        Convert TaskTemplate to response format.

        Args:
            template: TaskTemplate instance

        Returns:
            Dictionary representation for API response
        """
        response = {
            'id': template.id,
            'name': template.name,
            'description': template.description,
            'title_pattern': template.title_pattern,
            'description_template': template.description_template,
            'estimated_hours': template.estimated_hours,
            'points': template.points,
            'priority': template.priority,
            'category_id': template.category_id,
            'tags': template.tags,
            'is_public': template.is_public,
            'created_by_id': template.created_by_id,
            'created_at': template.created_at,
            'updated_at': template.updated_at,
            'category': None
        }
        
        # Add category data if available
        if template.category_id:
            category = self.db.query(TaskCategory).filter(TaskCategory.id == template.category_id).first()
            if category:
                response['category'] = {
                    'id': category.id,
                    'name': category.name,
                    'description': category.description,
                    'color': category.color,
                    'icon': category.icon
                }
        
        return response

    def get_task_templates(
        self, user_id: int, include_public: bool = True
    ) -> List[dict]:
        """
        Get task templates available to user.

        Args:
            user_id: User ID
            include_public: Whether to include public templates

        Returns:
            List of task template response dictionaries
        """
        # Get user to check role for RBAC
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return []
        
        # RBAC: Admins and organizers can view all templates
        if user.role in [UserRole.ADMIN, UserRole.ORGANIZER]:
            all_templates = self.db.query(TaskTemplate).all()
            return [self.to_task_template_response(template) for template in all_templates]
        else:
            # Regular users can only see their own templates and public ones
            templates = []
            
            # Get user's own templates
            user_templates = self.db.query(TaskTemplate).filter(
                TaskTemplate.created_by_id == user_id
            ).all()
            templates.extend(user_templates)
            
            # Get public templates if requested
            if include_public:
                public_templates = self.db.query(TaskTemplate).filter(
                    TaskTemplate.is_public
                ).all()
                templates.extend(public_templates)
            
            return [self.to_task_template_response(template) for template in templates]

    async def create_task_from_template(
        self, template_id: int, user_id: int, **kwargs
    ) -> Optional[Task]:
        """
        Create a task from a template.

        Args:
            template_id: Template ID
            user_id: User ID creating the task
            **kwargs: Additional task data

        Returns:
            Created task instance or None
        """
        template = (
            self.db.query(TaskTemplate)
            .filter(TaskTemplate.id == template_id)
            .first()
        )
        if not template:
            return None

        # Build task creation parameters, avoiding conflicts
        # Use template values as fallback when kwargs values are None or missing
        task_params = {
            "title": kwargs.get("title") or template.title_pattern,
            "description": kwargs.get("description") or template.description_template,
            "priority": kwargs.get("priority") or template.priority,
            "estimated_hours": kwargs.get("estimated_hours") or template.estimated_hours,
            "points": kwargs.get("points") or template.points,
            "category_id": kwargs.get("category_id") or template.category_id,
            "tag_names": kwargs.get("tag_names") or template.tags,
        }
        
        # Add any additional kwargs that aren't already handled
        handled_keys = {
            "title", "description", "priority", "estimated_hours", 
            "points", "category_id", "tag_names"
        }
        for key, value in kwargs.items():
            if key not in handled_keys:
                task_params[key] = value

        # Create task data from template
        task_data = TaskCreate(**task_params)

        return await self.create_task(task_data, user_id)

    def create_category(
        self, category_data: TaskCategoryCreate, created_by_id: int
    ) -> TaskCategory:
        """
        Create a new task category.

        Args:
            category_data: Category creation data
            created_by_id: ID of user creating the category

        Returns:
            Created category instance
        """
        category = TaskCategory(
            name=category_data.name,
            description=category_data.description,
            color=category_data.color,
            icon=category_data.icon,
            parent_id=category_data.parent_id,
            created_by_id=created_by_id,
        )

        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)

        logger.info(
            f"Created task category {category.id} by user {created_by_id}"
        )
        return category

    def to_task_category_response(self, category: TaskCategory) -> dict:
        """
        Convert TaskCategory to response format.

        Args:
            category: TaskCategory instance

        Returns:
            Dictionary representation for API response
        """
        return {
            'id': category.id,
            'name': category.name,
            'description': category.description,
            'color': category.color,
            'icon': category.icon,
            'parent_id': category.parent_id,
            'created_by_id': category.created_by_id,
            'created_at': category.created_at,
            'updated_at': category.updated_at,
            'subcategories': []  # TODO: Implement subcategories if needed
        }

    def get_categories(self, user_id: int) -> List[dict]:
        """
        Get task categories for user.

        Args:
            user_id: User ID

        Returns:
            List of task category response dictionaries
        """
        # Get user to check role for RBAC
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return []
        
        # RBAC: Admins and organizers can view all categories
        if user.role in [UserRole.ADMIN, UserRole.ORGANIZER]:
            categories = self.db.query(TaskCategory).all()
            return [self.to_task_category_response(category) for category in categories]
        else:
            # Regular users can only see their own categories
            categories = (
                self.db.query(TaskCategory)
                .filter(TaskCategory.created_by_id == user_id)
                .all()
            )
            return [self.to_task_category_response(category) for category in categories]

    def create_tag(
        self, tag_data: TaskTagCreate, created_by_id: int
    ) -> TaskTag:
        """
        Create a new task tag.

        Args:
            tag_data: Tag creation data
            created_by_id: ID of user creating the tag

        Returns:
            Created tag instance
        """
        tag = TaskTag(
            name=tag_data.name,
            color=tag_data.color,
            created_by_id=created_by_id,
        )

        self.db.add(tag)
        self.db.commit()
        self.db.refresh(tag)

        logger.info(f"Created task tag {tag.id} by user {created_by_id}")
        return tag

    def get_tags(self) -> List[TaskTag]:
        """
        Get all task tags.

        Returns:
            List of task tags
        """
        return self.db.query(TaskTag).all()

    def _add_tags_to_task(
        self, task_id: int, tag_names: List[str], user_id: int
    ):
        """Add tags to a task."""
        for tag_name in tag_names:
            # Get or create tag
            tag = (
                self.db.query(TaskTag).filter(TaskTag.name == tag_name).first()
            )
            if not tag:
                tag = TaskTag(name=tag_name, created_by_id=user_id)
                self.db.add(tag)
                self.db.flush()

            # Create association if it doesn't exist
            existing = (
                self.db.query(TaskTagAssociation)
                .filter(
                    and_(
                        TaskTagAssociation.task_id == task_id,
                        TaskTagAssociation.tag_id == tag.id,
                    )
                )
                .first()
            )

            if not existing:
                association = TaskTagAssociation(
                    task_id=task_id, tag_id=tag.id
                )
                self.db.add(association)

    def _update_task_tags(
        self, task_id: int, tag_names: List[str], user_id: int
    ):
        """Update tags for a task."""
        # Remove existing associations
        self.db.query(TaskTagAssociation).filter(
            TaskTagAssociation.task_id == task_id
        ).delete()

        # Add new tags
        self._add_tags_to_task(task_id, tag_names, user_id)

    def create_recurring_tasks(self) -> int:
        """
        Create recurring tasks based on patterns.

        Returns:
            Number of tasks created
        """
        # Get all recurring tasks that need new instances
        recurring_tasks = (
            self.db.query(Task)
            .filter(
                and_(
                    Task.is_recurring,
                    Task.recurrence_pattern.isnot(None),
                )
            )
            .all()
        )

        created_count = 0
        for task in recurring_tasks:
            if self._should_create_recurring_instance(task):
                new_task = self._create_recurring_instance(task)
                if new_task:
                    created_count += 1

        self.db.commit()
        logger.info(f"Created {created_count} recurring task instances")
        return created_count

    def _should_create_recurring_instance(self, task: Task) -> bool:
        """Check if a recurring task should create a new instance."""
        if not task.recurrence_pattern:
            return False

        # Check if the last instance was completed and enough time has passed
        last_instance = (
            self.db.query(Task)
            .filter(
                and_(
                    Task.template_id == task.template_id,
                    Task.created_at > task.created_at,
                )
            )
            .order_by(desc(Task.created_at))
            .first()
        )

        if not last_instance:
            return True

        # Check recurrence pattern
        pattern = task.recurrence_pattern
        recurrence_type = pattern.get("type")

        if recurrence_type == RecurrenceType.DAILY:
            return (datetime.utcnow() - last_instance.created_at).days >= 1
        elif recurrence_type == RecurrenceType.WEEKLY:
            return (datetime.utcnow() - last_instance.created_at).days >= 7
        elif recurrence_type == RecurrenceType.MONTHLY:
            return (datetime.utcnow() - last_instance.created_at).days >= 30

        return False

    def _create_recurring_instance(self, task: Task) -> Optional[Task]:
        """Create a new instance of a recurring task."""
        new_task = Task(
            title=task.title,
            description=task.description,
            priority=task.priority,
            estimated_hours=task.estimated_hours,
            points=task.points,
            is_recurring=task.is_recurring,
            recurrence_pattern=task.recurrence_pattern,
            template_id=task.template_id,
            category_id=task.category_id,
            created_by_id=task.created_by_id,
            assigned_to_id=task.assigned_to_id,
        )

        # Calculate new due date based on recurrence pattern
        if task.due_date and task.recurrence_pattern:
            new_task.due_date = self._calculate_next_due_date(
                task.due_date, task.recurrence_pattern
            )

        self.db.add(new_task)
        return new_task

    def _calculate_next_due_date(
        self, current_due_date: datetime, pattern: Dict[str, Any]
    ) -> datetime:
        """Calculate the next due date based on recurrence pattern."""
        recurrence_type = pattern.get("type")

        if recurrence_type == RecurrenceType.DAILY:
            return current_due_date + timedelta(days=1)
        elif recurrence_type == RecurrenceType.WEEKLY:
            return current_due_date + timedelta(weeks=1)
        elif recurrence_type == RecurrenceType.MONTHLY:
            # Simple monthly calculation
            return current_due_date + timedelta(days=30)
        elif recurrence_type == RecurrenceType.YEARLY:
            return current_due_date + timedelta(days=365)

        return current_due_date

    def to_task_response(self, task: Task) -> Dict[str, Any]:
        """
        Convert a Task model instance to a TaskResponse dictionary.
        
        Args:
            task: Task model instance
            
        Returns:
            Dictionary representation suitable for TaskResponse
        """
        # Convert assigned_to User object to dictionary
        assigned_to_dict = None
        if task.assigned_to:
            assigned_to_dict = {
                "id": task.assigned_to.id,
                "username": task.assigned_to.username,
                "email": task.assigned_to.email,
                "first_name": getattr(task.assigned_to, 'first_name', None),
                "last_name": getattr(task.assigned_to, 'last_name', None),
            }
        
        # Convert category to dictionary
        category_dict = None
        if task.category:
            category_dict = {
                "id": task.category.id,
                "name": task.category.name,
                "description": task.category.description,
                "color": task.category.color,
                "icon": task.category.icon,
            }
        
        # Convert template to dictionary
        template_dict = None
        if task.template:
            template_dict = {
                "id": task.template.id,
                "name": task.template.name,
                "description": task.template.description,
                "title_pattern": task.template.title_pattern,
                "description_template": task.template.description_template,
                "estimated_hours": task.template.estimated_hours,
                "points": task.template.points,
                "priority": task.template.priority.value,
                "is_public": task.template.is_public,
            }
        
        # Convert tags to list of dictionaries
        tags_list = []
        if task.tags:
            for tag in task.tags:
                tags_list.append({
                    "id": tag.id,
                    "name": tag.name,
                    "color": tag.color,
                })
        
        # Convert subtasks to list of dictionaries
        subtasks_list = []
        if task.subtasks:
            for subtask in task.subtasks:
                subtasks_list.append(self.to_task_response(subtask))
        
        # Convert dependencies to list of dictionaries
        dependencies_list = []
        if task.dependencies:
            for dep in task.dependencies:
                dependencies_list.append({
                    "id": dep.id,
                    "dependent_task_id": dep.dependent_task_id,
                    "dependency_type": dep.dependency_type.value if hasattr(dep.dependency_type, 'value') else dep.dependency_type,
                })
        
        # Convert media attachments to list of dictionaries
        media_list = []
        if task.media_attachments:
            for media in task.media_attachments:
                media_list.append({
                    "id": media.id,
                    "filename": media.filename,
                    "file_path": media.file_path,
                    "file_size": media.file_size,
                    "mime_type": media.mime_type,
                    "uploaded_at": media.uploaded_at.isoformat() if media.uploaded_at else None,
                })
        
        return {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "status": task.status.value,
            "priority": task.priority.value,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "estimated_hours": task.estimated_hours,
            "actual_hours": task.actual_hours,
            "points": task.points,
            "is_recurring": task.is_recurring,
            "recurrence_pattern": task.recurrence_pattern,
            "created_by_id": task.created_by_id,
            "assigned_to_id": task.assigned_to_id,
            "category_id": task.category_id,
            "template_id": task.template_id,
            "parent_task_id": task.parent_task_id,
            "created_at": task.created_at.isoformat(),
            "updated_at": task.updated_at.isoformat(),
            "assigned_to": assigned_to_dict,
            "category": category_dict,
            "template": template_dict,
            "tags": tags_list,
            "subtasks": subtasks_list,
            "dependencies": dependencies_list,
            "media_attachments": media_list,
        }

    def _task_to_dict(self, task: Task) -> Dict[str, Any]:
        """
        Convert Task object to dictionary for caching.
        
        Args:
            task: Task object
            
        Returns:
            Dictionary representation of task
        """
        # Serialize assigned_to user
        assigned_to_dict = None
        if task.assigned_to:
            assigned_to_dict = {
                "id": task.assigned_to.id,
                "username": task.assigned_to.username,
                "email": task.assigned_to.email,
                "first_name": getattr(task.assigned_to, 'first_name', None),
                "last_name": getattr(task.assigned_to, 'last_name', None),
                "role": task.assigned_to.role.value if task.assigned_to.role else None,
            }
        
        # Serialize category
        category_dict = None
        if task.category:
            category_dict = {
                "id": task.category.id,
                "name": task.category.name,
                "description": task.category.description,
                "color": task.category.color,
            }
        
        # Serialize tags
        tags_list = []
        if task.tags:
            tags_list = [
                {
                    "id": tag.id,
                    "name": tag.name,
                    "color": tag.color,
                }
                for tag in task.tags
            ]
        
        return {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "status": task.status.value,
            "priority": task.priority.value,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "estimated_hours": task.estimated_hours,
            "actual_hours": task.actual_hours,
            "points": task.points,
            "is_recurring": task.is_recurring,
            "recurrence_pattern": task.recurrence_pattern,
            "created_by_id": task.created_by_id,
            "assigned_to_id": task.assigned_to_id,
            "category_id": task.category_id,
            "template_id": task.template_id,
            "parent_task_id": task.parent_task_id,
            "created_at": task.created_at.isoformat(),
            "updated_at": task.updated_at.isoformat(),
            "user_id": task.created_by_id,  # For cache key identification
            # Relationship data
            "assigned_to": assigned_to_dict,
            "category": category_dict,
            "tags": tags_list,
        }

    def _dict_to_task(self, task_dict: Dict[str, Any]) -> Task:
        """
        Convert dictionary back to Task object.
        
        Args:
            task_dict: Dictionary representation of task
            
        Returns:
            Task object
        """
        from app.models.user import User
        from app.models.task import TaskCategory, TaskTag
        
        # Create a minimal Task object with cached data
        task = Task()
        task.id = task_dict["id"]
        task.title = task_dict["title"]
        task.description = task_dict["description"]
        task.status = TaskStatus(task_dict["status"])
        task.priority = TaskPriority(task_dict["priority"])
        task.due_date = datetime.fromisoformat(task_dict["due_date"]) if task_dict["due_date"] else None
        task.completed_at = datetime.fromisoformat(task_dict["completed_at"]) if task_dict["completed_at"] else None
        task.estimated_hours = task_dict["estimated_hours"]
        task.actual_hours = task_dict["actual_hours"]
        task.points = task_dict["points"]
        task.is_recurring = task_dict["is_recurring"]
        task.recurrence_pattern = task_dict["recurrence_pattern"]
        task.created_by_id = task_dict["created_by_id"]
        task.assigned_to_id = task_dict["assigned_to_id"]
        task.category_id = task_dict["category_id"]
        task.template_id = task_dict["template_id"]
        task.parent_task_id = task_dict["parent_task_id"]
        task.created_at = datetime.fromisoformat(task_dict["created_at"])
        task.updated_at = datetime.fromisoformat(task_dict["updated_at"])
        
        # Reconstruct relationships from cached data
        # Assigned user
        if task_dict.get("assigned_to"):
            assigned_to_data = task_dict["assigned_to"]
            user = User()
            user.id = assigned_to_data["id"]
            user.username = assigned_to_data["username"]
            user.email = assigned_to_data["email"]
            user.first_name = assigned_to_data.get("first_name")
            user.last_name = assigned_to_data.get("last_name")
            if assigned_to_data.get("role"):
                from app.models.user import UserRole
                user.role = UserRole(assigned_to_data["role"])
            task.assigned_to = user
        
        # Category
        if task_dict.get("category"):
            category_data = task_dict["category"]
            category = TaskCategory()
            category.id = category_data["id"]
            category.name = category_data["name"]
            category.description = category_data.get("description")
            category.color = category_data.get("color")
            task.category = category
        
        # Tags
        if task_dict.get("tags"):
            tags = []
            for tag_data in task_dict["tags"]:
                tag = TaskTag()
                tag.id = tag_data["id"]
                tag.name = tag_data["name"]
                tag.color = tag_data.get("color")
                tags.append(tag)
            task.tags = tags
        
        return task

    # Workflow validation methods
    def validate_task_assignment(
        self,
        task_id: int,
        assigned_to_id: int,
        assigner_id: int,
    ) -> bool:
        """
        Validate task assignment.

        Args:
            task_id: Task ID
            assigned_to_id: User ID to assign to
            assigner_id: User ID performing the assignment

        Returns:
            True if assignment is valid

        Raises:
            ValueError: If assignment is invalid
        """
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise ValueError(f"Task {task_id} not found")

        # Only task creator can assign tasks
        if task.created_by_id != assigner_id:
            raise ValueError("Only task creator can assign tasks")

        # Verify assigned user exists
        assigned_user = self.db.query(User).filter(User.id == assigned_to_id).first()
        if not assigned_user:
            raise ValueError(f"User {assigned_to_id} not found")

        return True

    def can_user_modify_task(
        self,
        task_id: int,
        user_id: int,
        action: str = "edit",
    ) -> bool:
        """
        Check if user can modify a task.

        Args:
            task_id: Task ID
            user_id: User ID
            action: Action type (edit, delete, assign, etc.)

        Returns:
            True if user can perform the action
        """
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return False

        # Task creator can always modify
        if task.created_by_id == user_id:
            return True

        # Assigned user can edit task content but not assign/delete
        if task.assigned_to_id == user_id:
            return action in ["edit", "comment", "status"]

        # TODO: Add admin role check
        # if user has admin role, return True

        return False

    def get_task_participants(self, task_id: int) -> List[int]:
        """
        Get list of user IDs who are participants in a task.

        Args:
            task_id: Task ID

        Returns:
            List of user IDs (creator, assignee, commenters)
        """
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return []

        participants = set()

        # Add creator and assignee
        participants.add(task.created_by_id)
        if task.assigned_to_id:
            participants.add(task.assigned_to_id)

        # Add users who have commented on the task
        # This will require importing TaskComment, but we'll do it here to avoid circular imports
        try:
            from app.models.task_comment import TaskComment
            commenters = (
                self.db.query(TaskComment.user_id)
                .filter(TaskComment.task_id == task_id)
                .distinct()
                .all()
            )
            participants.update([c.user_id for c in commenters])
        except ImportError:
            # If comment model not available, just use creator and assignee
            pass

        return list(participants)

    def get_task_stakeholders(self, task_id: int) -> List[int]:
        """
        Get list of user IDs who are stakeholders in a task (for notifications).

        Args:
            task_id: Task ID

        Returns:
            List of user IDs who should receive notifications
        """
        # For now, stakeholders are the same as participants
        # In the future, this could include project managers, team leads, etc.
        return self.get_task_participants(task_id)
