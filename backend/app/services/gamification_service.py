"""
Gamification service for TaaskMaaster.

This module contains business logic for gamification features including
points, achievements, leaderboards, and streaks.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, asc, desc, func
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.gamification import (
    Achievement,
    AchievementType,
    Leaderboard,
    LeaderboardEntry,
    Points,
    PointsType,
    Streak,
    UserAchievement,
)
from app.models.goal import Goal, GoalStatus
from app.models.task import Task, TaskStatus
from app.schemas.gamification import LeaderboardCreate

logger = get_logger(__name__)


class GamificationService:
    """Service for gamification operations."""

    def __init__(self, db: Session):
        """Initialize gamification service with database session."""
        self.db = db

    def award_points(
        self,
        user_id: int,
        amount: int,
        points_type: PointsType,
        description: Optional[str] = None,
        reference_id: Optional[int] = None,
        reference_type: Optional[str] = None,
    ) -> Points:
        """
        Award points to a user.

        Args:
            user_id: User ID
            amount: Points amount (positive or negative)
            points_type: Type of points transaction
            description: Transaction description
            reference_id: Reference to related entity
            reference_type: Type of reference entity

        Returns:
            Created points transaction
        """
        points = Points(
            user_id=user_id,
            amount=amount,
            points_type=points_type,
            description=description,
            reference_id=reference_id,
            reference_type=reference_type,
        )

        self.db.add(points)
        self.db.commit()
        self.db.refresh(points)

        logger.info(
            f"Awarded {amount} points to user {user_id} for {points_type}"
        )
        return points

    def get_user_points_summary(self, user_id: int) -> Dict[str, Any]:
        """
        Get points summary for a user.

        Args:
            user_id: User ID

        Returns:
            Dictionary with points summary
        """
        # Total points
        total_points = (
            self.db.query(func.sum(Points.amount))
            .filter(Points.user_id == user_id)
            .scalar()
            or 0
        )

        # Points this week
        week_ago = datetime.utcnow() - timedelta(days=7)
        points_this_week = (
            self.db.query(func.sum(Points.amount))
            .filter(
                and_(Points.user_id == user_id, Points.created_at >= week_ago)
            )
            .scalar()
            or 0
        )

        # Points this month
        month_ago = datetime.utcnow() - timedelta(days=30)
        points_this_month = (
            self.db.query(func.sum(Points.amount))
            .filter(
                and_(Points.user_id == user_id, Points.created_at >= month_ago)
            )
            .scalar()
            or 0
        )

        # Points this year
        year_ago = datetime.utcnow() - timedelta(days=365)
        points_this_year = (
            self.db.query(func.sum(Points.amount))
            .filter(
                and_(Points.user_id == user_id, Points.created_at >= year_ago)
            )
            .scalar()
            or 0
        )

        # User rank
        total_users = self.db.query(
            func.count(Points.user_id.distinct())
        ).scalar()

        # Calculate user rank using subquery
        if total_points > 0:
            user_rank = (
                self.db.query(func.count(Points.user_id.distinct()))
                .filter(
                    Points.user_id.in_(
                        self.db.query(Points.user_id)
                        .group_by(Points.user_id)
                        .having(func.sum(Points.amount) > total_points)
                    )
                )
                .scalar()
                + 1
            )
        else:
            user_rank = None

        return {
            "user_id": user_id,
            "total_points": total_points,
            "points_this_week": points_this_week,
            "points_this_month": points_this_month,
            "points_this_year": points_this_year,
            "rank": user_rank,
            "total_users": total_users,
        }

    def get_user_points_history(
        self, user_id: int, skip: int = 0, limit: int = 100
    ) -> tuple[List[Points], int]:
        """
        Get points history for a user.

        Args:
            user_id: User ID
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            Tuple of (points_transactions, total_count)
        """
        query = self.db.query(Points).filter(Points.user_id == user_id)
        total = query.count()
        points = (
            query.order_by(desc(Points.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

        return points, total

    def check_and_award_achievements(self, user_id: int) -> List[Achievement]:
        """
        Check and award achievements to a user.

        Args:
            user_id: User ID

        Returns:
            List of newly awarded achievements
        """
        # Get all active achievements
        achievements = (
            self.db.query(Achievement)
            .filter(Achievement.is_active is True)
            .all()
        )

        newly_awarded = []
        for achievement in achievements:
            # Check if user already has this achievement
            existing = (
                self.db.query(UserAchievement)
                .filter(
                    and_(
                        UserAchievement.user_id == user_id,
                        UserAchievement.achievement_id == achievement.id,
                    )
                )
                .first()
            )

            if existing:
                continue

            # Check if user meets achievement criteria
            if self._check_achievement_criteria(user_id, achievement):
                user_achievement = UserAchievement(
                    user_id=user_id,
                    achievement_id=achievement.id,
                    progress_value=self._get_achievement_progress(
                        user_id, achievement
                    ),
                )

                self.db.add(user_achievement)

                # Award points for achievement
                if achievement.points_reward > 0:
                    self.award_points(
                        user_id=user_id,
                        amount=achievement.points_reward,
                        points_type=PointsType.ACHIEVEMENT,
                        description=f"Achievement: {achievement.name}",
                        reference_id=achievement.id,
                        reference_type="achievement",
                    )

                newly_awarded.append(achievement)

        self.db.commit()

        if newly_awarded:
            logger.info(
                f"Awarded {len(newly_awarded)} achievements to user {user_id}"
            )

        return newly_awarded

    def _check_achievement_criteria(
        self, user_id: int, achievement: Achievement
    ) -> bool:
        """Check if user meets achievement criteria."""
        if not achievement.criteria:
            return False

        criteria = achievement.criteria
        achievement_type = achievement.achievement_type

        if achievement_type == AchievementType.TASK_COMPLETION:
            required_count = criteria.get("task_count", 0)
            completed_tasks = (
                self.db.query(Task)
                .filter(
                    and_(
                        Task.assigned_to_id == user_id,
                        Task.status == TaskStatus.DONE,
                    )
                )
                .count()
            )
            return completed_tasks >= required_count

        elif achievement_type == AchievementType.POINTS_MILESTONE:
            required_points = criteria.get("points", 0)
            total_points = (
                self.db.query(func.sum(Points.amount))
                .filter(Points.user_id == user_id)
                .scalar()
                or 0
            )
            return total_points >= required_points

        elif achievement_type == AchievementType.STREAK:
            required_streak = criteria.get("streak_days", 0)
            streak_type = criteria.get("streak_type", "daily_tasks")
            streak = (
                self.db.query(Streak)
                .filter(
                    and_(
                        Streak.user_id == user_id,
                        Streak.streak_type == streak_type,
                    )
                )
                .first()
            )
            return streak and streak.current_streak >= required_streak

        elif achievement_type == AchievementType.GOAL_COMPLETION:
            required_goals = criteria.get("goal_count", 0)
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
            return completed_goals >= required_goals

        return False

    def _get_achievement_progress(
        self, user_id: int, achievement: Achievement
    ) -> Optional[float]:
        """Get progress value for an achievement."""
        achievement_type = achievement.achievement_type

        if achievement_type == AchievementType.TASK_COMPLETION:
            return (
                self.db.query(Task)
                .filter(
                    and_(
                        Task.assigned_to_id == user_id,
                        Task.status == TaskStatus.DONE,
                    )
                )
                .count()
            )

        elif achievement_type == AchievementType.POINTS_MILESTONE:
            return (
                self.db.query(func.sum(Points.amount))
                .filter(Points.user_id == user_id)
                .scalar()
                or 0
            )

        elif achievement_type == AchievementType.STREAK:
            streak_type = achievement.criteria.get(
                "streak_type", "daily_tasks"
            )
            streak = (
                self.db.query(Streak)
                .filter(
                    and_(
                        Streak.user_id == user_id,
                        Streak.streak_type == streak_type,
                    )
                )
                .first()
            )
            return streak.current_streak if streak else 0

        elif achievement_type == AchievementType.GOAL_COMPLETION:
            return (
                self.db.query(Goal)
                .filter(
                    and_(
                        Goal.user_id == user_id,
                        Goal.status == GoalStatus.COMPLETED,
                    )
                )
                .count()
            )

        return None

    def get_user_achievements(self, user_id: int) -> List[UserAchievement]:
        """
        Get achievements for a user.

        Args:
            user_id: User ID

        Returns:
            List of user achievements
        """
        return (
            self.db.query(UserAchievement)
            .filter(UserAchievement.user_id == user_id)
            .order_by(desc(UserAchievement.earned_at))
            .all()
        )

    def create_leaderboard(
        self, leaderboard_data: LeaderboardCreate
    ) -> Leaderboard:
        """
        Create a new leaderboard.

        Args:
            leaderboard_data: Leaderboard creation data

        Returns:
            Created leaderboard instance
        """
        leaderboard = Leaderboard(
            name=leaderboard_data.name,
            description=leaderboard_data.description,
            leaderboard_type=leaderboard_data.leaderboard_type,
            time_period=leaderboard_data.time_period,
            start_date=leaderboard_data.start_date,
            end_date=leaderboard_data.end_date,
        )

        self.db.add(leaderboard)
        self.db.commit()
        self.db.refresh(leaderboard)

        logger.info(f"Created leaderboard {leaderboard.id}")
        return leaderboard

    def update_leaderboard_scores(self, leaderboard_id: int) -> int:
        """
        Update scores for a leaderboard.

        Args:
            leaderboard_id: Leaderboard ID

        Returns:
            Number of entries updated
        """
        leaderboard = (
            self.db.query(Leaderboard)
            .filter(Leaderboard.id == leaderboard_id)
            .first()
        )
        if not leaderboard:
            return 0

        # Clear existing entries
        self.db.query(LeaderboardEntry).filter(
            LeaderboardEntry.leaderboard_id == leaderboard_id
        ).delete()

        # Calculate scores based on leaderboard type
        if leaderboard.leaderboard_type == "points":
            scores = self._calculate_points_scores(leaderboard)
        elif leaderboard.leaderboard_type == "tasks":
            scores = self._calculate_task_scores(leaderboard)
        elif leaderboard.leaderboard_type == "streaks":
            scores = self._calculate_streak_scores(leaderboard)
        else:
            return 0

        # Create entries
        entries = []
        for rank, (user_id, score) in enumerate(scores, 1):
            entry = LeaderboardEntry(
                leaderboard_id=leaderboard_id,
                user_id=user_id,
                score=score,
                rank=rank,
            )
            entries.append(entry)

        self.db.add_all(entries)
        self.db.commit()

        logger.info(
            f"Updated {len(entries)} leaderboard entries "
            f"for leaderboard {leaderboard_id}"
        )
        return len(entries)

    def _calculate_points_scores(
        self, leaderboard: Leaderboard
    ) -> List[tuple[int, float]]:
        """Calculate points-based scores for leaderboard."""
        query = self.db.query(
            Points.user_id, func.sum(Points.amount).label("total_points")
        ).filter(Points.amount > 0)

        # Apply time filter
        if leaderboard.time_period == "daily":
            start_date = datetime.utcnow() - timedelta(days=1)
        elif leaderboard.time_period == "weekly":
            start_date = datetime.utcnow() - timedelta(weeks=1)
        elif leaderboard.time_period == "monthly":
            start_date = datetime.utcnow() - timedelta(days=30)
        else:  # all_time
            start_date = None

        if start_date:
            query = query.filter(Points.created_at >= start_date)

        scores = (
            query.group_by(Points.user_id).order_by(desc("total_points")).all()
        )
        return [(user_id, total_points) for user_id, total_points in scores]

    def _calculate_task_scores(
        self, leaderboard: Leaderboard
    ) -> List[tuple[int, float]]:
        """Calculate task-based scores for leaderboard."""
        query = self.db.query(
            Task.assigned_to_id, func.count(Task.id).label("task_count")
        ).filter(Task.status == TaskStatus.DONE)

        # Apply time filter
        if leaderboard.time_period == "daily":
            start_date = datetime.utcnow() - timedelta(days=1)
        elif leaderboard.time_period == "weekly":
            start_date = datetime.utcnow() - timedelta(weeks=1)
        elif leaderboard.time_period == "monthly":
            start_date = datetime.utcnow() - timedelta(days=30)
        else:  # all_time
            start_date = None

        if start_date:
            query = query.filter(Task.completed_at >= start_date)

        scores = (
            query.group_by(Task.assigned_to_id)
            .order_by(desc("task_count"))
            .all()
        )
        return [
            (user_id, task_count) for user_id, task_count in scores if user_id
        ]

    def _calculate_streak_scores(
        self, leaderboard: Leaderboard
    ) -> List[tuple[int, float]]:
        """Calculate streak-based scores for leaderboard."""
        scores = (
            self.db.query(Streak.user_id, Streak.current_streak)
            .order_by(desc(Streak.current_streak))
            .all()
        )

        return [
            (user_id, current_streak) for user_id, current_streak in scores
        ]

    def get_leaderboard_entries(
        self, leaderboard_id: int, skip: int = 0, limit: int = 100
    ) -> tuple[List[LeaderboardEntry], int]:
        """
        Get leaderboard entries.

        Args:
            leaderboard_id: Leaderboard ID
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            Tuple of (entries, total_count)
        """
        query = self.db.query(LeaderboardEntry).filter(
            LeaderboardEntry.leaderboard_id == leaderboard_id
        )
        total = query.count()
        entries = (
            query.order_by(asc(LeaderboardEntry.rank))
            .offset(skip)
            .limit(limit)
            .all()
        )

        return entries, total

    def update_user_streak(
        self, user_id: int, streak_type: str, activity_date: datetime = None
    ) -> Optional[Streak]:
        """
        Update user streak based on activity.

        Args:
            user_id: User ID
            streak_type: Type of streak
            activity_date: Date of activity (defaults to now)

        Returns:
            Updated streak instance
        """
        if activity_date is None:
            activity_date = datetime.utcnow()

        streak = (
            self.db.query(Streak)
            .filter(
                and_(
                    Streak.user_id == user_id,
                    Streak.streak_type == streak_type,
                )
            )
            .first()
        )

        if not streak:
            streak = Streak(
                user_id=user_id,
                streak_type=streak_type,
                current_streak=1,
                longest_streak=1,
                last_activity=activity_date,
                start_date=activity_date,
            )
            self.db.add(streak)
        else:
            # Check if activity is consecutive
            if streak.last_activity:
                days_diff = (
                    activity_date.date() - streak.last_activity.date()
                ).days

                if days_diff == 1:  # Consecutive day
                    streak.current_streak += 1
                    if streak.current_streak > streak.longest_streak:
                        streak.longest_streak = streak.current_streak
                elif days_diff > 1:  # Break in streak
                    streak.current_streak = 1
                    streak.start_date = activity_date
                # If days_diff == 0, same day activity, no change needed

            streak.last_activity = activity_date

        self.db.commit()
        self.db.refresh(streak)

        logger.info(
            f"Updated streak for user {user_id}, type {streak_type}, "
            f"current: {streak.current_streak}"
        )
        return streak

    def get_user_streaks(self, user_id: int) -> List[Streak]:
        """
        Get all streaks for a user.

        Args:
            user_id: User ID

        Returns:
            List of user streaks
        """
        return self.db.query(Streak).filter(Streak.user_id == user_id).all()
