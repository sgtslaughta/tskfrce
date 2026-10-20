"""
User presence service for TaaskMaaster.

This module contains business logic for managing user online presence,
status, and real-time activity tracking.
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Set

from sqlalchemy import and_, desc, func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.logging import get_logger
from app.models.comment import UserStatus
from app.models.user import User
from app.services.websocket_service import websocket_manager

logger = get_logger(__name__)


class PresenceStatus(str, Enum):
    """User presence status options."""
    
    ONLINE = "online"
    AWAY = "away"
    BUSY = "busy"
    OFFLINE = "offline"


class ActivityType(str, Enum):
    """User activity types for presence tracking."""
    
    VIEWING_TASK = "viewing_task"
    EDITING_COMMENT = "editing_comment"
    TYPING_MESSAGE = "typing_message"
    IN_MEETING = "in_meeting"
    IDLE = "idle"


class PresenceService:
    """Service for managing user presence and activity status."""

    def __init__(self, db: Session):
        """Initialize presence service with database session."""
        self.db = db
        
        # In-memory tracking for real-time presence
        self.active_users: Dict[int, Dict] = {}  # user_id -> presence_data
        self.typing_users: Dict[str, Set[int]] = {}  # context -> set of user_ids
        self.viewing_users: Dict[int, Set[int]] = {}  # task_id -> set of user_ids

    async def update_user_presence(
        self,
        user_id: int,
        status: PresenceStatus,
        custom_message: Optional[str] = None,
        activity_type: Optional[ActivityType] = None,
        context_id: Optional[int] = None
    ) -> UserStatus:
        """
        Update user's presence status and activity.

        Args:
            user_id: User ID
            status: Presence status
            custom_message: Optional custom status message
            activity_type: Optional current activity type
            context_id: Optional context ID (e.g., task_id for viewing_task)

        Returns:
            Updated UserStatus instance
        """
        # Update database record
        user_status = self.db.query(UserStatus).filter(
            UserStatus.user_id == user_id
        ).first()

        if user_status:
            user_status.status = status.value
            user_status.custom_message = custom_message
            user_status.last_seen = datetime.utcnow()
            user_status.updated_at = datetime.utcnow()
        else:
            user_status = UserStatus(
                user_id=user_id,
                status=status.value,
                custom_message=custom_message,
                last_seen=datetime.utcnow(),
            )
            self.db.add(user_status)

        self.db.commit()
        self.db.refresh(user_status)

        # Update in-memory tracking
        self.active_users[user_id] = {
            'status': status.value,
            'custom_message': custom_message,
            'last_seen': datetime.utcnow(),
            'activity_type': activity_type.value if activity_type else None,
            'context_id': context_id,
        }

        # Broadcast presence update
        await self._broadcast_presence_update(user_id, user_status)

        logger.info(f"Updated presence for user {user_id} to {status.value}")
        return user_status

    async def set_user_activity(
        self,
        user_id: int,
        activity_type: ActivityType,
        context_id: Optional[int] = None,
        metadata: Optional[Dict] = None
    ) -> None:
        """
        Set user's current activity.

        Args:
            user_id: User ID
            activity_type: Type of activity
            context_id: Optional context ID (e.g., task_id)
            metadata: Optional additional metadata
        """
        # Update in-memory activity tracking
        if user_id in self.active_users:
            self.active_users[user_id].update({
                'activity_type': activity_type.value,
                'context_id': context_id,
                'activity_metadata': metadata,
                'activity_updated_at': datetime.utcnow(),
            })
        else:
            # User not in active tracking, add them
            self.active_users[user_id] = {
                'status': PresenceStatus.ONLINE.value,
                'last_seen': datetime.utcnow(),
                'activity_type': activity_type.value,
                'context_id': context_id,
                'activity_metadata': metadata,
                'activity_updated_at': datetime.utcnow(),
            }

        # Special handling for specific activities
        if activity_type == ActivityType.VIEWING_TASK and context_id:
            await self._add_task_viewer(context_id, user_id)
        elif activity_type == ActivityType.TYPING_MESSAGE and context_id:
            await self._add_typing_user(f"task_{context_id}", user_id)

        logger.debug(f"Set activity for user {user_id}: {activity_type.value}")

    async def clear_user_activity(
        self,
        user_id: int,
        activity_type: Optional[ActivityType] = None,
        context_id: Optional[int] = None
    ) -> None:
        """
        Clear user's current activity.

        Args:
            user_id: User ID
            activity_type: Optional specific activity type to clear
            context_id: Optional context ID
        """
        if user_id in self.active_users:
            if activity_type is None:
                # Clear all activity
                self.active_users[user_id].update({
                    'activity_type': None,
                    'context_id': None,
                    'activity_metadata': None,
                })
            else:
                # Clear specific activity if it matches
                current_activity = self.active_users[user_id].get('activity_type')
                if current_activity == activity_type.value:
                    self.active_users[user_id].update({
                        'activity_type': None,
                        'context_id': None,
                        'activity_metadata': None,
                    })

        # Special handling for specific activities
        if activity_type == ActivityType.VIEWING_TASK and context_id:
            await self._remove_task_viewer(context_id, user_id)
        elif activity_type == ActivityType.TYPING_MESSAGE and context_id:
            await self._remove_typing_user(f"task_{context_id}", user_id)

    async def get_user_presence(self, user_id: int) -> Optional[Dict]:
        """
        Get user's current presence information.

        Args:
            user_id: User ID

        Returns:
            Dictionary with presence information or None
        """
        # Check in-memory first
        if user_id in self.active_users:
            presence_data = self.active_users[user_id].copy()
            
            # Add user info
            user = self.db.query(User).filter(User.id == user_id).first()
            if user:
                presence_data.update({
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                    }
                })
            
            return presence_data

        # Fall back to database
        user_status = (
            self.db.query(UserStatus)
            .options(joinedload(UserStatus.user))
            .filter(UserStatus.user_id == user_id)
            .first()
        )

        if user_status:
            return {
                'user_id': user_status.user_id,
                'status': user_status.status,
                'custom_message': user_status.custom_message,
                'last_seen': user_status.last_seen,
                'user': {
                    'id': user_status.user.id,
                    'username': user_status.user.username,
                    'first_name': user_status.user.first_name,
                    'last_name': user_status.user.last_name,
                } if user_status.user else None,
            }

        return None

    async def get_online_users(
        self,
        limit: int = 100,
        include_activity: bool = False
    ) -> List[Dict]:
        """
        Get list of currently online users.

        Args:
            limit: Maximum number of users to return
            include_activity: Whether to include activity information

        Returns:
            List of user presence dictionaries
        """
        online_users = []

        # Get from in-memory tracking first (more real-time)
        for user_id, presence_data in self.active_users.items():
            if presence_data.get('status') == PresenceStatus.ONLINE.value:
                user = self.db.query(User).filter(User.id == user_id).first()
                if user:
                    user_data = {
                        'user_id': user_id,
                        'status': presence_data['status'],
                        'custom_message': presence_data.get('custom_message'),
                        'last_seen': presence_data['last_seen'],
                        'user': {
                            'id': user.id,
                            'username': user.username,
                            'first_name': user.first_name,
                            'last_name': user.last_name,
                        }
                    }
                    
                    if include_activity:
                        user_data.update({
                            'activity_type': presence_data.get('activity_type'),
                            'context_id': presence_data.get('context_id'),
                            'activity_metadata': presence_data.get('activity_metadata'),
                        })
                    
                    online_users.append(user_data)

        # If we don't have enough from memory, supplement from database
        if len(online_users) < limit:
            db_online = (
                self.db.query(UserStatus)
                .options(joinedload(UserStatus.user))
                .filter(UserStatus.status == PresenceStatus.ONLINE.value)
                .order_by(desc(UserStatus.last_seen))
                .limit(limit)
                .all()
            )

            # Add users not already in memory tracking
            for user_status in db_online:
                if user_status.user_id not in self.active_users:
                    user_data = {
                        'user_id': user_status.user_id,
                        'status': user_status.status,
                        'custom_message': user_status.custom_message,
                        'last_seen': user_status.last_seen,
                        'user': {
                            'id': user_status.user.id,
                            'username': user_status.user.username,
                            'first_name': user_status.user.first_name,
                            'last_name': user_status.user.last_name,
                        } if user_status.user else None,
                    }
                    online_users.append(user_data)

        return online_users[:limit]

    async def get_task_viewers(self, task_id: int) -> List[Dict]:
        """
        Get users currently viewing a specific task.

        Args:
            task_id: Task ID

        Returns:
            List of user dictionaries
        """
        viewers = []
        
        if task_id in self.viewing_users:
            for user_id in self.viewing_users[task_id]:
                presence = await self.get_user_presence(user_id)
                if presence:
                    viewers.append(presence)

        return viewers

    async def get_typing_users(self, context: str) -> List[Dict]:
        """
        Get users currently typing in a specific context.

        Args:
            context: Context identifier (e.g., "task_123", "direct_456")

        Returns:
            List of user dictionaries
        """
        typing_users = []
        
        if context in self.typing_users:
            for user_id in self.typing_users[context]:
                presence = await self.get_user_presence(user_id)
                if presence:
                    typing_users.append(presence)

        return typing_users

    async def cleanup_stale_presence(self, max_age_minutes: int = 30) -> int:
        """
        Clean up stale presence data.

        Args:
            max_age_minutes: Maximum age in minutes before considering presence stale

        Returns:
            Number of cleaned up records
        """
        cutoff_time = datetime.utcnow() - timedelta(minutes=max_age_minutes)
        
        # Clean up in-memory tracking
        stale_users = []
        for user_id, presence_data in self.active_users.items():
            if presence_data['last_seen'] < cutoff_time:
                stale_users.append(user_id)

        for user_id in stale_users:
            del self.active_users[user_id]
            # Also remove from viewing and typing tracking
            for task_id, viewers in self.viewing_users.items():
                viewers.discard(user_id)
            for context, typers in self.typing_users.items():
                typers.discard(user_id)

        # Update database for stale users
        updated_count = (
            self.db.query(UserStatus)
            .filter(
                UserStatus.last_seen < cutoff_time,
                UserStatus.status != PresenceStatus.OFFLINE.value
            )
            .update({
                'status': PresenceStatus.OFFLINE.value,
                'updated_at': datetime.utcnow()
            })
        )
        self.db.commit()

        total_cleaned = len(stale_users) + updated_count
        if total_cleaned > 0:
            logger.info(f"Cleaned up {total_cleaned} stale presence records")

        return total_cleaned

    async def _broadcast_presence_update(self, user_id: int, user_status: UserStatus) -> None:
        """
        Broadcast presence update to relevant users.

        Args:
            user_id: User whose presence changed
            user_status: Updated user status
        """
        try:
            # Get user info
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                return

            # Create presence update message
            presence_message = {
                "type": "user_presence_changed",
                "timestamp": datetime.utcnow().isoformat(),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                },
                "status": user_status.status,
                "custom_message": user_status.custom_message,
                "last_seen": user_status.last_seen.isoformat()
            }

            # Get users who should receive this update
            # For now, broadcast to all online users
            # In production, you might want to limit to contacts/collaborators
            online_users = await self.get_online_users(include_activity=False)
            recipient_ids = [u['user_id'] for u in online_users if u['user_id'] != user_id]

            if recipient_ids:
                await websocket_manager.broadcast_messages(recipient_ids, presence_message)

        except Exception as e:
            logger.error(f"Error broadcasting presence update: {e}")

    async def _add_task_viewer(self, task_id: int, user_id: int) -> None:
        """Add user to task viewers tracking."""
        if task_id not in self.viewing_users:
            self.viewing_users[task_id] = set()
        self.viewing_users[task_id].add(user_id)

    async def _remove_task_viewer(self, task_id: int, user_id: int) -> None:
        """Remove user from task viewers tracking."""
        if task_id in self.viewing_users:
            self.viewing_users[task_id].discard(user_id)
            if not self.viewing_users[task_id]:
                del self.viewing_users[task_id]

    async def _add_typing_user(self, context: str, user_id: int) -> None:
        """Add user to typing users tracking."""
        if context not in self.typing_users:
            self.typing_users[context] = set()
        self.typing_users[context].add(user_id)

    async def _remove_typing_user(self, context: str, user_id: int) -> None:
        """Remove user from typing users tracking."""
        if context in self.typing_users:
            self.typing_users[context].discard(user_id)
            if not self.typing_users[context]:
                del self.typing_users[context]
