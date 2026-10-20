"""
WebSocket API endpoints for TaaskMaaster.

This module contains WebSocket routes for real-time notifications and messaging.
"""

import json

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db, user_from_token
from app.core.logging import get_logger
from app.models.user import User
from app.services.websocket_service import websocket_manager

logger = get_logger(__name__)

router = APIRouter()


async def authenticate(websocket: WebSocket, db: Session) -> int | None:
    """Verify ?token=<JWT> before accept(); close with 4401 and return None if invalid."""
    user = user_from_token(websocket.query_params.get("token"), db)
    if user is None:
        await websocket.close(code=4401, reason="Log in again to connect.")
        return None
    return user.id


@router.websocket("/notifications")
async def websocket_notifications_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    """
    WebSocket endpoint for real-time notifications.

    **Connection URL:**
    ```
    ws://localhost:8000/ws/notifications?token=<JWT access token>
    ```

    **Message Types Received:**
    - `task_comment`: New comment on a task
    - `task_status_changed`: Task status changed
    - `task_approval_request`: Task submitted for approval
    - `task_approved`: Task approved
    - `task_rejected`: Task rejected
    - `user_mentioned`: User mentioned in a comment
    - `media_attached`: Media attached to task/comment
    """
    user_id = await authenticate(websocket, db)
    if user_id is None:
        return

    # Accept WebSocket connection only after authentication passes
    await websocket.accept()

    try:
        # Add user to notifications pool (websocket already accepted)
        if user_id not in websocket_manager.notification_connections:
            websocket_manager.notification_connections[user_id] = []
        websocket_manager.notification_connections[user_id].append(websocket)

        logger.info(f"User {user_id} connected to notifications WebSocket")

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Receive message from client with timeout
                data = await websocket.receive_text()
                message = json.loads(data)

                # Handle client-side messages (like heartbeat, status updates, etc.)
                message_type = message.get("type")

                if message_type == "heartbeat":
                    # Respond to heartbeat
                    await websocket.send_text(
                        json.dumps({"type": "heartbeat_ack", "timestamp": message.get("timestamp")})
                    )

                elif message_type == "status_update":
                    # Update user status
                    new_status = message.get("status", "online")
                    await websocket_manager.update_user_status(user_id, new_status, db)

                else:
                    logger.warning(
                        f"Unknown message type from notifications WebSocket: {message_type}"
                    )

            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON received from user {user_id} notifications WebSocket")
            except Exception as e:
                logger.error(f"Error handling notifications WebSocket message: {e}")
                break

    except WebSocketDisconnect:
        logger.info(f"User {user_id} disconnected from notifications WebSocket")
    except Exception as e:
        logger.error(f"Unexpected error in notifications WebSocket: {e}")
    finally:
        # Ensure cleanup
        await websocket_manager.disconnect_notifications(websocket, user_id, db)


@router.websocket("/messaging")
async def websocket_messaging_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    """
    WebSocket endpoint for real-time messaging.

    **Connection URL:**
    ```
    ws://localhost:8000/ws/messaging?token=<JWT access token>
    ```

    **Message Types Received:**
    - `direct_message`: New direct message
    - `task_chat_message`: New task chat message
    - `typing_indicator`: User typing status
    - `message_read`: Message read receipt
    - `user_status_changed`: User online status changed
    """
    user_id = await authenticate(websocket, db)
    if user_id is None:
        return

    try:
        # Accept WebSocket connection only after authentication passes
        await websocket.accept()

        # Connect user to messaging
        await websocket_manager.connect_messaging(websocket, user_id, db)

        logger.info(f"User {user_id} connected to messaging WebSocket")

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_text()
                logger.info(f"Received WebSocket message: {data}")
                message = json.loads(data)
                logger.info(f"Parsed WebSocket message: {message}")

                # Handle client-side messages
                message_type = message.get("type")
                logger.info(f"Message type: {message_type}")

                if message_type == "heartbeat":
                    # Respond to heartbeat
                    await websocket.send_text(
                        json.dumps({"type": "heartbeat_ack", "timestamp": message.get("timestamp")})
                    )

                elif message_type == "typing_indicator":
                    # Handle typing indicator
                    context_type = message.get("context_type")
                    context_id = message.get("context_id")
                    is_typing = message.get("is_typing", False)

                    if context_type and context_id is not None:
                        await websocket_manager.handle_typing_indicator(
                            user_id=user_id,
                            context_type=context_type,
                            context_id=context_id,
                            is_typing=is_typing,
                            db=db,
                        )

                elif message_type == "status_update":
                    # Update user status
                    new_status = message.get("status", "online")
                    await websocket_manager.update_user_status(user_id, new_status, db)

                elif message_type == "join_task_chat":
                    # Join task chat (for future implementation)
                    task_id = message.get("task_id")
                    if task_id:
                        logger.info(f"User {user_id} joined task {task_id} chat")
                        # Future: Add user to task chat room

                elif message_type == "leave_task_chat":
                    # Leave task chat (for future implementation)
                    task_id = message.get("task_id")
                    if task_id:
                        logger.info(f"User {user_id} left task {task_id} chat")
                        # Future: Remove user from task chat room

                else:
                    logger.warning(f"Unknown message type from messaging WebSocket: {message_type}")

            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON received from user {user_id} messaging WebSocket")
            except Exception as e:
                logger.error(f"Error handling messaging WebSocket message: {e}")
                break

    except WebSocketDisconnect:
        logger.info(f"User {user_id} disconnected from messaging WebSocket")
    except Exception as e:
        logger.error(f"Unexpected error in messaging WebSocket: {e}")
    finally:
        # Ensure cleanup
        await websocket_manager.disconnect_messaging(websocket, user_id, db)


@router.get("/stats")
async def get_websocket_stats(_: User = Depends(get_current_active_user)):
    """
    Get WebSocket connection statistics.

    **Response:**
    ```json
    {
      "notification_connections": 15,
      "messaging_connections": 12,
      "total_notification_sockets": 18,
      "total_messaging_sockets": 15,
      "online_users": 20
    }
    ```
    """
    try:
        stats = websocket_manager.get_connection_stats()
        return stats
    except Exception as e:
        logger.error(f"Error getting WebSocket stats: {e}")
        return {
            "error": "Failed to get WebSocket statistics",
            "notification_connections": 0,
            "messaging_connections": 0,
            "total_notification_sockets": 0,
            "total_messaging_sockets": 0,
            "online_users": 0,
        }
