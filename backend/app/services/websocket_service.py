"""
WebSocket service for TaaskMaaster.

This module contains the WebSocket connection manager and notification
broadcasting functionality for real-time features.
"""

import json
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.user import User
from app.services.messaging_service import UserStatusService

logger = get_logger(__name__)


class WebSocketManager:
    """Enhanced WebSocket connection manager for notifications and messaging."""

    def __init__(self):
        """Initialize WebSocket manager."""
        # Separate connection pools for different types
        self.notification_connections: Dict[int, List[WebSocket]] = {}
        self.messaging_connections: Dict[int, List[WebSocket]] = {}
        
        # User status tracking
        self.user_status: Dict[int, str] = {}  # user_id -> status
        self.typing_status: Dict[str, Dict[int, datetime]] = {}  # context -> {user_id: last_typed}
        
        # Connection metadata
        self.connection_metadata: Dict[WebSocket, Dict] = {}

    async def connect_notifications(self, websocket: WebSocket, user_id: int, db: Session):
        """
        Connect a user to the notifications channel.

        Args:
            websocket: WebSocket connection (already accepted)
            user_id: User ID
            db: Database session
        """
        
        # Add to connections pool
        if user_id not in self.notification_connections:
            self.notification_connections[user_id] = []
        self.notification_connections[user_id].append(websocket)
        
        # Store connection metadata
        self.connection_metadata[websocket] = {
            'user_id': user_id,
            'type': 'notifications',
            'connected_at': datetime.utcnow(),
        }
        
        # Update user status to online
        await self.update_user_status(user_id, "online", db)
        
        logger.info(f"User {user_id} connected to notifications WebSocket")

    async def connect_messaging(self, websocket: WebSocket, user_id: int, db: Session):
        """
        Connect a user to the messaging channel.

        Args:
            websocket: WebSocket connection (already accepted)
            user_id: User ID
            db: Database session
        """
        
        # Add to connections pool
        if user_id not in self.messaging_connections:
            self.messaging_connections[user_id] = []
        self.messaging_connections[user_id].append(websocket)
        
        # Store connection metadata
        self.connection_metadata[websocket] = {
            'user_id': user_id,
            'type': 'messaging',
            'connected_at': datetime.utcnow(),
        }
        
        logger.info(f"User {user_id} connected to messaging WebSocket")

    async def disconnect_notifications(self, websocket: WebSocket, user_id: int, db: Session):
        """
        Disconnect a user from the notifications channel.

        Args:
            websocket: WebSocket connection
            user_id: User ID
            db: Database session
        """
        if user_id in self.notification_connections:
            try:
                self.notification_connections[user_id].remove(websocket)
                if not self.notification_connections[user_id]:
                    del self.notification_connections[user_id]
            except ValueError:
                pass
        
        # Remove connection metadata
        self.connection_metadata.pop(websocket, None)
        
        # Update status to offline if no connections remain
        if (
            user_id not in self.notification_connections 
            and user_id not in self.messaging_connections
        ):
            await self.update_user_status(user_id, "offline", db)
        
        logger.info(f"User {user_id} disconnected from notifications WebSocket")

    async def disconnect_messaging(self, websocket: WebSocket, user_id: int, db: Session):
        """
        Disconnect a user from the messaging channel.

        Args:
            websocket: WebSocket connection
            user_id: User ID
            db: Database session
        """
        if user_id in self.messaging_connections:
            try:
                self.messaging_connections[user_id].remove(websocket)
                if not self.messaging_connections[user_id]:
                    del self.messaging_connections[user_id]
            except ValueError:
                pass
        
        # Remove connection metadata
        self.connection_metadata.pop(websocket, None)
        
        # Update status to offline if no connections remain
        if (
            user_id not in self.notification_connections 
            and user_id not in self.messaging_connections
        ):
            await self.update_user_status(user_id, "offline", db)
        
        logger.info(f"User {user_id} disconnected from messaging WebSocket")

    async def send_notification(self, user_id: int, message: dict):
        """
        Send a notification to a specific user.

        Args:
            user_id: User ID
            message: Notification message dictionary
        """
        if user_id in self.notification_connections:
            disconnected = []
            for connection in self.notification_connections[user_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    logger.warning(f"Failed to send notification to user {user_id}: {e}")
                    disconnected.append(connection)
            
            # Remove disconnected connections
            for connection in disconnected:
                try:
                    self.notification_connections[user_id].remove(connection)
                    self.connection_metadata.pop(connection, None)
                except ValueError:
                    pass

    async def send_message(self, user_id: int, message: dict):
        """
        Send a message to a specific user.

        Args:
            user_id: User ID
            message: Message dictionary
        """
        if user_id in self.messaging_connections:
            disconnected = []
            for connection in self.messaging_connections[user_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    logger.warning(f"Failed to send message to user {user_id}: {e}")
                    disconnected.append(connection)
            
            # Remove disconnected connections
            for connection in disconnected:
                try:
                    self.messaging_connections[user_id].remove(connection)
                    self.connection_metadata.pop(connection, None)
                except ValueError:
                    pass

    async def broadcast_notifications(self, user_ids: List[int], message: dict):
        """
        Broadcast a notification to multiple users.

        Args:
            user_ids: List of user IDs
            message: Notification message dictionary
        """
        for user_id in user_ids:
            await self.send_notification(user_id, message)

    async def broadcast_messages(self, user_ids: List[int], message: dict):
        """
        Broadcast a message to multiple users.

        Args:
            user_ids: List of user IDs
            message: Message dictionary
        """
        for user_id in user_ids:
            await self.send_message(user_id, message)

    async def update_user_status(self, user_id: int, status: str, db: Session):
        """
        Update user status and broadcast to relevant users.

        Args:
            user_id: User ID
            status: Status (online, away, busy, offline)
            db: Database session
        """
        self.user_status[user_id] = status
        
        # Update in database
        status_service = UserStatusService(db)
        status_service.update_user_status(user_id, status)
        
        # Get user info for broadcast
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return
        
        # Broadcast status change to relevant users
        status_message = {
            "type": "user_status_changed",
            "timestamp": datetime.utcnow().isoformat(),
            "user": {
                "id": user.id,
                "username": user.username,
            },
            "status": status,
            "last_seen": datetime.utcnow().isoformat()
        }
        
        # Get users who should receive this status update
        # For now, broadcast to all connected users
        # In the future, this should be limited to task collaborators, contacts, etc.
        relevant_users = await self.get_relevant_users_for_status(user_id, db)
        await self.broadcast_notifications(relevant_users, status_message)

    async def handle_typing_indicator(
        self, 
        user_id: int, 
        context_type: str, 
        context_id: int, 
        is_typing: bool,
        db: Session
    ):
        """
        Handle typing indicator updates.

        Args:
            user_id: User ID
            context_type: Context type (task_chat, direct_message)
            context_id: Context ID (task_id or user_id)
            is_typing: Whether user is typing
            db: Database session
        """
        context_key = f"{context_type}_{context_id}"
        
        if is_typing:
            if context_key not in self.typing_status:
                self.typing_status[context_key] = {}
            self.typing_status[context_key][user_id] = datetime.utcnow()
        else:
            if context_key in self.typing_status and user_id in self.typing_status[context_key]:
                del self.typing_status[context_key][user_id]
        
        # Get user info
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return
        
        # Broadcast typing indicator
        typing_message = {
            "type": "typing_indicator",
            "timestamp": datetime.utcnow().isoformat(),
            "user": {
                "id": user.id,
                "username": user.username,
            },
            "context": {
                "type": context_type,
                "context_id": context_id
            },
            "is_typing": is_typing
        }
        
        # Get other participants in this context
        participants = await self.get_context_participants(context_type, context_id, db)
        recipients = [p for p in participants if p != user_id]
        await self.broadcast_messages(recipients, typing_message)

    async def get_relevant_users_for_status(self, user_id: int, db: Session) -> List[int]:
        """
        Get users who should receive status updates for a user.

        Args:
            user_id: User ID
            db: Database session

        Returns:
            List of user IDs
        """
        # For now, return all connected users
        # In the future, this should be limited to:
        # - Task collaborators
        # - Direct message contacts
        # - Team members
        # - Friends/contacts
        
        connected_users = set()
        connected_users.update(self.notification_connections.keys())
        connected_users.update(self.messaging_connections.keys())
        
        # Remove the user themselves
        connected_users.discard(user_id)
        
        return list(connected_users)

    async def get_context_participants(
        self, 
        context_type: str, 
        context_id: int, 
        db: Session
    ) -> List[int]:
        """
        Get participants for a given context.

        Args:
            context_type: Context type (task_chat, direct_message)
            context_id: Context ID
            db: Database session

        Returns:
            List of user IDs
        """
        if context_type == "task_chat":
            # Get task participants
            from app.services.task_service import TaskService
            task_service = TaskService(db)
            return task_service.get_task_participants(context_id)
        
        elif context_type == "direct_message":
            # For direct messages, context_id is the other user's ID
            return [context_id]  # Will be expanded with current user by caller
        
        return []

    def get_connection_stats(self) -> dict:
        """
        Get connection statistics.

        Returns:
            Dictionary with connection stats
        """
        return {
            "notification_connections": len(self.notification_connections),
            "messaging_connections": len(self.messaging_connections),
            "total_notification_sockets": sum(
                len(connections) for connections in self.notification_connections.values()
            ),
            "total_messaging_sockets": sum(
                len(connections) for connections in self.messaging_connections.values()
            ),
            "online_users": len(set(
                list(self.notification_connections.keys()) + 
                list(self.messaging_connections.keys())
            )),
        }


# Global WebSocket manager instance
websocket_manager = WebSocketManager()
