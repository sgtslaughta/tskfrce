"""
Goal service for TaaskMaaster.

This module contains business logic for goal tracking and progress monitoring.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.gamification import Points
from app.models.goal import Goal, GoalProgress, GoalStatus, GoalType
from app.models.task import Task, TaskStatus
from app.schemas.goal import GoalCreate, GoalProgressCreate, GoalUpdate

logger = get_logger(__name__)


class GoalService:
    """Service for goal management operations."""

    def __init__(self, db: Session):
        """Initialize goal service with database session."""
        self.db = db

    def create_goal(self, goal_data: GoalCreate, user_id: int) -> Goal:
        """
        Create a new goal.

        Args:
            goal_data: Goal creation data
            user_id: ID of user creating the goal

        Returns:
            Created goal instance
        """
        goal = Goal(
            title=goal_data.title,
            description=goal_data.description,
            goal_type=goal_data.goal_type,
            target_value=goal_data.target_value,
            end_date=goal_data.end_date,
            is_recurring=goal_data.is_recurring,
            recurrence_pattern=goal_data.recurrence_pattern,
            user_id=user_id,
        )

        self.db.add(goal)
        self.db.commit()
        self.db.refresh(goal)

        logger.info(f"Created goal {goal.id} by user {user_id}")
        return goal

    def get_goal(self, goal_id: int, user_id: int) -> Optional[Goal]:
        """
        Get a goal by ID.

        Args:
            goal_id: Goal ID
            user_id: User ID for access control

        Returns:
            Goal instance or None
        """
        return (
            self.db.query(Goal)
            .filter(and_(Goal.id == goal_id, Goal.user_id == user_id))
            .first()
        )

    def get_goals(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[GoalStatus] = None,
        goal_type: Optional[GoalType] = None,
        is_completed: Optional[bool] = None,
    ) -> tuple[List[Goal], int]:
        """
        Get goals with filtering and pagination.

        Args:
            user_id: User ID for access control
            skip: Number of records to skip
            limit: Maximum number of records to return
            status: Filter by goal status
            goal_type: Filter by goal type
            is_completed: Filter by completion status

        Returns:
            Tuple of (goals, total_count)
        """
        query = self.db.query(Goal).filter(Goal.user_id == user_id)

        # Apply filters
        if status:
            query = query.filter(Goal.status == status)
        if goal_type:
            query = query.filter(Goal.goal_type == goal_type)
        if is_completed is not None:
            if is_completed:
                query = query.filter(Goal.current_value >= Goal.target_value)
            else:
                query = query.filter(Goal.current_value < Goal.target_value)

        total = query.count()
        goals = (
            query.order_by(desc(Goal.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

        return goals, total

    def update_goal(
        self, goal_id: int, goal_data: GoalUpdate, user_id: int
    ) -> Optional[Goal]:
        """
        Update a goal.

        Args:
            goal_id: Goal ID
            goal_data: Goal update data
            user_id: User ID for access control

        Returns:
            Updated goal instance or None
        """
        goal = self.get_goal(goal_id, user_id)
        if not goal:
            return None

        # Update fields
        update_data = goal_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(goal, field, value)

        goal.updated_at = datetime.utcnow()

        # Check if goal is completed
        if (
            goal.current_value >= goal.target_value
            and goal.status != GoalStatus.COMPLETED
        ):
            goal.status = GoalStatus.COMPLETED
            goal.completed_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(goal)

        logger.info(f"Updated goal {goal_id} by user {user_id}")
        return goal

    def delete_goal(self, goal_id: int, user_id: int) -> bool:
        """
        Delete a goal.

        Args:
            goal_id: Goal ID
            user_id: User ID for access control

        Returns:
            True if deleted, False otherwise
        """
        goal = self.get_goal(goal_id, user_id)
        if not goal:
            return False

        self.db.delete(goal)
        self.db.commit()

        logger.info(f"Deleted goal {goal_id} by user {user_id}")
        return True

    def add_progress(
        self, goal_id: int, progress_data: GoalProgressCreate, user_id: int
    ) -> Optional[GoalProgress]:
        """
        Add progress to a goal.

        Args:
            goal_id: Goal ID
            progress_data: Progress data
            user_id: User ID for access control

        Returns:
            Created progress entry or None
        """
        goal = self.get_goal(goal_id, user_id)
        if not goal:
            return None

        progress = GoalProgress(
            goal_id=goal_id,
            value=progress_data.value,
            notes=progress_data.notes,
            recorded_at=progress_data.recorded_at or datetime.utcnow(),
        )

        self.db.add(progress)

        # Update goal current value
        goal.current_value += progress_data.value

        # Check if goal is completed
        if (
            goal.current_value >= goal.target_value
            and goal.status != GoalStatus.COMPLETED
        ):
            goal.status = GoalStatus.COMPLETED
            goal.completed_at = datetime.utcnow()

        goal.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(progress)

        logger.info(
            f"Added progress {progress.value} to goal {goal_id} "
            f"by user {user_id}"
        )
        return progress

    def get_progress(
        self, goal_id: int, user_id: int, skip: int = 0, limit: int = 100
    ) -> tuple[List[GoalProgress], int]:
        """
        Get progress entries for a goal.

        Args:
            goal_id: Goal ID
            user_id: User ID for access control
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            Tuple of (progress_entries, total_count)
        """
        # Verify goal ownership
        goal = self.get_goal(goal_id, user_id)
        if not goal:
            return [], 0

        query = self.db.query(GoalProgress).filter(
            GoalProgress.goal_id == goal_id
        )
        total = query.count()
        progress_entries = (
            query.order_by(desc(GoalProgress.recorded_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

        return progress_entries, total

    def update_goal_progress_from_tasks(self, user_id: int) -> int:
        """
        Update goal progress based on completed tasks.

        Args:
            user_id: User ID

        Returns:
            Number of goals updated
        """
        # Get all active task count goals for the user
        task_goals = (
            self.db.query(Goal)
            .filter(
                and_(
                    Goal.user_id == user_id,
                    Goal.goal_type == GoalType.TASK_COUNT,
                    Goal.status == GoalStatus.ACTIVE,
                )
            )
            .all()
        )

        updated_count = 0
        for goal in task_goals:
            # Count completed tasks since goal start date
            completed_tasks = (
                self.db.query(Task)
                .filter(
                    and_(
                        Task.assigned_to_id == user_id,
                        Task.status == TaskStatus.DONE,
                        Task.completed_at >= goal.start_date,
                    )
                )
                .count()
            )

            if completed_tasks != goal.current_value:
                goal.current_value = completed_tasks
                goal.updated_at = datetime.utcnow()

                # Check if goal is completed
                if goal.current_value >= goal.target_value:
                    goal.status = GoalStatus.COMPLETED
                    goal.completed_at = datetime.utcnow()

                updated_count += 1

        self.db.commit()
        logger.info(
            f"Updated {updated_count} task count goals for user {user_id}"
        )
        return updated_count

    def update_goal_progress_from_points(self, user_id: int) -> int:
        """
        Update goal progress based on points earned.

        Args:
            user_id: User ID

        Returns:
            Number of goals updated
        """
        # Get all active points goals for the user
        points_goals = (
            self.db.query(Goal)
            .filter(
                and_(
                    Goal.user_id == user_id,
                    Goal.goal_type == GoalType.POINTS,
                    Goal.status == GoalStatus.ACTIVE,
                )
            )
            .all()
        )

        updated_count = 0
        for goal in points_goals:
            # Sum points earned since goal start date
            total_points = (
                self.db.query(func.sum(Points.amount))
                .filter(
                    and_(
                        Points.user_id == user_id,
                        Points.amount > 0,
                        Points.created_at >= goal.start_date,
                    )
                )
                .scalar()
                or 0
            )

            if total_points != goal.current_value:
                goal.current_value = total_points
                goal.updated_at = datetime.utcnow()

                # Check if goal is completed
                if goal.current_value >= goal.target_value:
                    goal.status = GoalStatus.COMPLETED
                    goal.completed_at = datetime.utcnow()

                updated_count += 1

        self.db.commit()
        logger.info(f"Updated {updated_count} points goals for user {user_id}")
        return updated_count

    def get_goal_statistics(self, user_id: int) -> Dict[str, Any]:
        """
        Get goal statistics for a user.

        Args:
            user_id: User ID

        Returns:
            Dictionary with goal statistics
        """
        total_goals = (
            self.db.query(Goal).filter(Goal.user_id == user_id).count()
        )
        completed_goals = (
            self.db.query(Goal)
            .filter(
                and_(
                    Goal.user_id == user_id,
                    Goal.status == GoalStatus.COMPLETED,
                )
            )
            .count()
        )
        active_goals = (
            self.db.query(Goal)
            .filter(
                and_(Goal.user_id == user_id, Goal.status == GoalStatus.ACTIVE)
            )
            .count()
        )

        # Average completion rate
        completion_rate = (
            (completed_goals / total_goals * 100) if total_goals > 0 else 0
        )

        # Goals by type
        goals_by_type = (
            self.db.query(Goal.goal_type, func.count(Goal.id))
            .filter(Goal.user_id == user_id)
            .group_by(Goal.goal_type)
            .all()
        )

        return {
            "total_goals": total_goals,
            "completed_goals": completed_goals,
            "active_goals": active_goals,
            "completion_rate": round(completion_rate, 2),
            "goals_by_type": dict(goals_by_type),
        }

    def create_recurring_goals(self) -> int:
        """
        Create recurring goals based on patterns.

        Returns:
            Number of goals created
        """
        # Get all completed recurring goals
        recurring_goals = (
            self.db.query(Goal)
            .filter(
                and_(
                    Goal.is_recurring is True,
                    Goal.recurrence_pattern.isnot(None),
                    Goal.status == GoalStatus.COMPLETED,
                )
            )
            .all()
        )

        created_count = 0
        for goal in recurring_goals:
            if self._should_create_recurring_goal(goal):
                new_goal = self._create_recurring_goal(goal)
                if new_goal:
                    created_count += 1

        self.db.commit()
        logger.info(f"Created {created_count} recurring goal instances")
        return created_count

    def _should_create_recurring_goal(self, goal: Goal) -> bool:
        """Check if a recurring goal should create a new instance."""
        if not goal.recurrence_pattern:
            return False

        # Check if enough time has passed since completion
        if not goal.completed_at:
            return False

        pattern = goal.recurrence_pattern
        recurrence_type = pattern.get("type")

        if recurrence_type == "daily":
            return (datetime.utcnow() - goal.completed_at).days >= 1
        elif recurrence_type == "weekly":
            return (datetime.utcnow() - goal.completed_at).days >= 7
        elif recurrence_type == "monthly":
            return (datetime.utcnow() - goal.completed_at).days >= 30

        return False

    def _create_recurring_goal(self, goal: Goal) -> Optional[Goal]:
        """Create a new instance of a recurring goal."""
        new_goal = Goal(
            title=goal.title,
            description=goal.description,
            goal_type=goal.goal_type,
            target_value=goal.target_value,
            is_recurring=goal.is_recurring,
            recurrence_pattern=goal.recurrence_pattern,
            user_id=goal.user_id,
        )

        # Calculate new end date based on recurrence pattern
        if goal.end_date and goal.recurrence_pattern:
            new_goal.end_date = self._calculate_next_end_date(
                goal.end_date, goal.recurrence_pattern
            )

        self.db.add(new_goal)
        return new_goal

    def _calculate_next_end_date(
        self, current_end_date: datetime, pattern: Dict[str, Any]
    ) -> datetime:
        """Calculate the next end date based on recurrence pattern."""
        recurrence_type = pattern.get("type")

        if recurrence_type == "daily":
            return current_end_date + timedelta(days=1)
        elif recurrence_type == "weekly":
            return current_end_date + timedelta(weeks=1)
        elif recurrence_type == "monthly":
            return current_end_date + timedelta(days=30)
        elif recurrence_type == "yearly":
            return current_end_date + timedelta(days=365)

        return current_end_date
