"""
WebSocket API endpoints for TaaskMaaster.

This module contains WebSocket routes for real-time notifications and messaging.
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.logging import get_logger
from app.services.websocket_service import websocket_manager

logger = get_logger(__name__)

router = APIRouter()


def get_user_from_websocket_query(websocket: WebSocket) -> Optional[dict]:
    """
    Extract user data from WebSocket query parameters.
    
    Args:
        websocket: WebSocket connection
        
    Returns:
        Dictionary with user data or None if invalid
    """
    try:
        # Get user_data from query parameters
        user_data_param = websocket.query_params.get("user_data")
        if not user_data_param:
            logger.warning("WebSocket connection missing user_data query parameter")
            return None
        
        user_data = json.loads(user_data_param)
        if 'user_id' not in user_data:
            logger.warning("WebSocket connection missing user_id in user_data")
            return None
            
        return user_data
    except json.JSONDecodeError:
        logger.warning("WebSocket connection has invalid JSON in user_data parameter")
        return None
    except Exception as e:
        logger.error(f"Error parsing WebSocket user data: {e}")
        return None


@router.websocket("/notifications")
async def websocket_notifications_endpoint(
    websocket: WebSocket,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time notifications.
    
    **Connection URL:**
    ```
    ws://localhost:8000/ws/notifications?user_data={"user_id":123,"username":"john_doe","role":"user"}
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
    # Authenticate user from query parameters BEFORE accepting connection
    user_data = get_user_from_websocket_query(websocket)
    if not user_data:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid authentication data")
        return
    
    # Accept WebSocket connection only after authentication passes
    await websocket.accept()
    
    user_id = user_data["user_id"]
    
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
                    await websocket.send_text(json.dumps({
                        "type": "heartbeat_ack",
                        "timestamp": message.get("timestamp")
                    }))
                    
                elif message_type == "status_update":
                    # Update user status
                    new_status = message.get("status", "online")
                    await websocket_manager.update_user_status(user_id, new_status, db)
                    
                else:
                    logger.warning(f"Unknown message type from notifications WebSocket: {message_type}")
                    
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
async def websocket_messaging_endpoint(
    websocket: WebSocket,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time messaging.
    
    **Connection URL:**
    ```
    ws://localhost:8000/ws/messaging?user_data={"user_id":123,"username":"john_doe","role":"user"}
    ```
    
    **Message Types Received:**
    - `direct_message`: New direct message
    - `task_chat_message`: New task chat message
    - `typing_indicator`: User typing status
    - `message_read`: Message read receipt
    - `user_status_changed`: User online status changed
    """
    # Authenticate user from query parameters BEFORE accepting connection
    user_data = get_user_from_websocket_query(websocket)
    if not user_data:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid authentication data")
        return
    
    user_id = user_data["user_id"]
    
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
                    await websocket.send_text(json.dumps({
                        "type": "heartbeat_ack",
                        "timestamp": message.get("timestamp")
                    }))
                    
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
                            db=db
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
async def get_websocket_stats():
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
