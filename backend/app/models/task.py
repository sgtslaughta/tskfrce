"""
Task models for TaaskMaaster.

This module contains models for advanced task management including
templates, categories, tags, dependencies, and recurring tasks.
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.core.database import Base


class TaskPriority(str, Enum):
    """Task priority levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskStatus(str, Enum):
    """Task status values."""

    TODO = "todo"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    SUBMITTED_FOR_APPROVAL = "submitted_for_approval"
    REVIEW = "review"  # Legacy status, kept for backward compatibility
    DONE = "done"
    CANCELLED = "cancelled"


class RewardType(str, Enum):
    """Reward types for task completion."""

    POINTS = "points"
    MONETARY = "monetary"
    TIME = "time"
    CUSTOM = "custom"


class RecurrenceType(str, Enum):
    """Recurrence pattern types."""

    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class Task(Base):
    """
    Advanced task model with support for templates, categories, tags, and
    dependencies.

    Attributes:
        id: Primary key
        title: Task title
        description: Task description
        status: Current task status
        priority: Task priority level
        due_date: Task due date
        completed_at: Completion timestamp
        estimated_hours: Estimated time to complete
        actual_hours: Actual time spent
        points: Points awarded for completion (legacy field)
        reward_type: Type of reward for task completion
        reward_value: Value of the reward (amount, points, time, etc.)
        reward_description: Description of custom rewards
        is_recurring: Whether task repeats
        recurrence_pattern: JSON pattern for recurring tasks
        template_id: Reference to task template
        category_id: Task category
        created_by_id: User who created the task
        assigned_to_id: User assigned to the task
        parent_task_id: Parent task for subtasks
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.TODO, index=True)
    priority = Column(
        SQLEnum(TaskPriority), default=TaskPriority.MEDIUM, index=True
    )
    due_date = Column(DateTime, nullable=True, index=True)
    completed_at = Column(DateTime, nullable=True)
    estimated_hours = Column(Float, default=0.0)
    actual_hours = Column(Float, default=0.0)
    points = Column(Integer, default=0)  # Legacy field for backward compatibility
    reward_type = Column(SQLEnum(RewardType), default=RewardType.POINTS, index=True)
    reward_value = Column(Float, default=0.0)  # Amount, points, time in minutes, etc.
    reward_description = Column(String(255), nullable=True)  # For custom rewards
    is_recurring = Column(Boolean, default=False)
    recurrence_pattern = Column(JSON, nullable=True)
    template_id = Column(
        Integer, ForeignKey("task_templates.id"), nullable=True
    )
    category_id = Column(
        Integer, ForeignKey("task_categories.id"), nullable=True
    )
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    parent_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    
    # New workflow fields
    submitted_for_approval_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    created_by = relationship(
        "User", back_populates="created_tasks", foreign_keys=[created_by_id]
    )
    assigned_to = relationship(
        "User", back_populates="tasks", foreign_keys=[assigned_to_id]
    )
    template = relationship("TaskTemplate", back_populates="tasks")
    category = relationship("TaskCategory", back_populates="tasks")
    tags = relationship(
        "TaskTag", secondary="task_tag_associations", back_populates="tasks"
    )
    dependencies = relationship(
        "TaskDependency",
        back_populates="task",
        foreign_keys="TaskDependency.task_id",
    )
    subtasks = relationship(
        "Task",
        back_populates="parent_task",
        foreign_keys="Task.parent_task_id",
    )
    parent_task = relationship(
        "Task",
        back_populates="subtasks",
        remote_side=[id],
        foreign_keys="Task.parent_task_id",
    )
    media_attachments = relationship("MediaAttachment", back_populates="task")
    lists = relationship(
        "TaskList",
        secondary="task_list_associations",
        back_populates="tasks"
    )
    
    # New workflow and messaging relationships
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")
    status_history = relationship("TaskStatusHistory", back_populates="task", cascade="all, delete-orphan")
    chat_messages = relationship("TaskChatMessage", back_populates="task", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        """String representation of Task."""
        return (
            f"<Task(id={self.id}, title='{self.title}', "
            f"status='{self.status}')>"
        )


class TaskList(Base):
    """
    Task list model for organizing tasks into custom groups.

    Attributes:
        id: Primary key
        name: List name
        description: List description
        color: List color for visual identification
        is_public: Whether list is public/shared
        is_archived: Whether list is archived
        created_by_id: User who created the list
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "task_lists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    color = Column(String(7), default="#3B82F6")  # Hex color code
    is_public = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    created_by = relationship("User", back_populates="created_lists")
    tasks = relationship(
        "Task",
        secondary="task_list_associations",
        back_populates="lists"
    )

    def __repr__(self) -> str:
        """String representation of TaskList."""
        return f"<TaskList(id={self.id}, name='{self.name}')>"


class TaskListAssociation(Base):
    """
    Association table for many-to-many relationship between tasks and lists.
    Includes position for ordering tasks within lists.

    Attributes:
        id: Primary key
        task_id: Reference to task
        list_id: Reference to list
        position: Position of task within the list (for ordering)
        added_at: When task was added to list
    """

    __tablename__ = "task_list_associations"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    list_id = Column(Integer, ForeignKey("task_lists.id"), nullable=False)
    position = Column(Integer, default=0)  # For ordering tasks within list
    added_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self) -> str:
        """String representation of TaskListAssociation."""
        return (
            f"<TaskListAssociation(task_id={self.task_id}, "
            f"list_id={self.list_id}, position={self.position})>"
        )


class TaskTemplate(Base):
    """
    Task template for creating reusable task structures.

    Attributes:
        id: Primary key
        name: Template name
        description: Template description
        title_pattern: Pattern for task title
        description_template: Template for task description
        estimated_hours: Default estimated hours
        points: Default points
        priority: Default priority
        category_id: Default category
        tags: Default tags
        is_public: Whether template is public
        created_by_id: User who created the template
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "task_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    title_pattern = Column(String(255), nullable=False)
    description_template = Column(Text, nullable=True)
    estimated_hours = Column(Float, default=0.0)
    points = Column(Integer, default=0)
    priority = Column(SQLEnum(TaskPriority), default=TaskPriority.MEDIUM)
    category_id = Column(
        Integer, ForeignKey("task_categories.id"), nullable=True
    )
    tags = Column(JSON, nullable=True)  # List of tag names
    is_public = Column(Boolean, default=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    tasks = relationship("Task", back_populates="template")
    category = relationship("TaskCategory", back_populates="templates")

    def __repr__(self) -> str:
        """String representation of TaskTemplate."""
        return f"<TaskTemplate(id={self.id}, name='{self.name}')>"


class TaskCategory(Base):
    """
    Task categories for organization.

    Attributes:
        id: Primary key
        name: Category name
        description: Category description
        color: Category color (hex)
        icon: Category icon name
        parent_id: Parent category for hierarchy
        created_by_id: User who created the category
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "task_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    color = Column(String(7), default="#3B82F6")  # Hex color
    icon = Column(String(50), nullable=True)
    parent_id = Column(
        Integer, ForeignKey("task_categories.id"), nullable=True
    )
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    tasks = relationship("Task", back_populates="category")
    templates = relationship("TaskTemplate", back_populates="category")
    subcategories = relationship(
        "TaskCategory",
        back_populates="parent_category",
        foreign_keys="TaskCategory.parent_id",
    )
    parent_category = relationship(
        "TaskCategory",
        back_populates="subcategories",
        remote_side=[id],
        foreign_keys="TaskCategory.parent_id",
    )

    def __repr__(self) -> str:
        """String representation of TaskCategory."""
        return f"<TaskCategory(id={self.id}, name='{self.name}')>"


class TaskTag(Base):
    """
    Task tags for flexible categorization.

    Attributes:
        id: Primary key
        name: Tag name
        color: Tag color (hex)
        created_by_id: User who created the tag
        created_at: Creation timestamp
    """

    __tablename__ = "task_tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True, index=True)
    color = Column(String(7), default="#6B7280")  # Hex color
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    tasks = relationship(
        "Task", secondary="task_tag_associations", back_populates="tags"
    )

    def __repr__(self) -> str:
        """String representation of TaskTag."""
        return f"<TaskTag(id={self.id}, name='{self.name}')>"


class TaskTagAssociation(Base):
    """Association table for task-tag many-to-many relationship."""

    __tablename__ = "task_tag_associations"

    task_id = Column(Integer, ForeignKey("tasks.id"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("task_tags.id"), primary_key=True)


class TaskDependency(Base):
    """
    Task dependencies for managing task relationships.

    Attributes:
        id: Primary key
        task_id: Dependent task
        depends_on_task_id: Task this depends on
        dependency_type: Type of dependency
        created_at: Creation timestamp
    """

    __tablename__ = "task_dependencies"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    depends_on_task_id = Column(
        Integer, ForeignKey("tasks.id"), nullable=False
    )
    dependency_type = Column(
        String(50), default="finish_to_start"
    )  # finish_to_start, start_to_start, etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    task = relationship(
        "Task", back_populates="dependencies", foreign_keys=[task_id]
    )
    depends_on_task = relationship("Task", foreign_keys=[depends_on_task_id])

    def __repr__(self) -> str:
        """String representation of TaskDependency."""
        return (
            f"<TaskDependency(task_id={self.task_id}, "
            f"depends_on={self.depends_on_task_id})>"
        )
