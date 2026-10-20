"""
Messaging API endpoints for TaaskMaaster.

This module contains FastAPI routes for messaging-related operations.
"""

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.logging import get_logger
from app.core.rate_limiting import MessageRateLimit, BulkOperationRateLimit
from app.schemas.messaging import (
    ConversationListResponse,
    DirectMessageCreate,
    DirectMessageListResponse,
    DirectMessageResponse,
    MessageHistoryRequest,
    MessageReadRequest,
    OnlineUsersResponse,
    TaskChatMessageCreate,
    TaskChatMessageListResponse,
    TaskChatMessageResponse,
    TypingIndicatorRequest,
    UserStatusResponse,
    UserStatusUpdate,
)
from app.services.messaging_service import MessagingService, UserStatusService
from app.services.websocket_service import websocket_manager

logger = get_logger(__name__)

router = APIRouter()


def get_user_data_from_header(x_user_data: Optional[str] = Header(None)) -> dict:
    """
    Extract user data from X-User-Data header.
    
    Args:
        x_user_data: JSON string containing user data
        
    Returns:
        Dictionary with user data
        
    Raises:
        HTTPException: If header is missing or invalid
    """
    if not x_user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-User-Data header is required"
        )
    
    try:
        user_data = json.loads(x_user_data)
        if 'user_id' not in user_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_id is required in X-User-Data header"
            )
        return user_data
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON in X-User-Data header"
        )


# Direct Message endpoints
@router.post("/direct", response_model=DirectMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_direct_message(
    message_data: DirectMessageCreate,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None),
    _rate_limit: bool = Depends(MessageRateLimit)
):
    """
    Send a direct message to another user.
    
    **Headers:**
    - X-User-Data: JSON containing user information
      ```json
      {
        "user_id": 123,
        "username": "john_doe",
        "role": "user"
      }
      ```
    
    **Request Body:**
    ```json
    {
      "to_user_id": 456,
      "content": "Hey, can you review this task?",
      "content_type": "text",
      "thread_id": "optional-thread-id",
      "media_attachment_ids": [789, 790]
    }
    ```
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        messaging_service = MessagingService(db)
        message = messaging_service.send_direct_message(
            from_user_id=user_id,
            to_user_id=message_data.to_user_id,
            content=message_data.content,
            content_type=message_data.content_type,
            thread_id=message_data.thread_id,
            media_attachment_ids=message_data.media_attachment_ids,
        )
        
        # Send real-time notification
        await websocket_manager.send_message(
            message_data.to_user_id,
            {
                "type": "direct_message",
                "message_id": message.id,
                "from_user_id": user_id,
                "from_username": user_data.get("username", "Unknown"),
                "content": message.content,
                "timestamp": message.created_at.isoformat(),
            }
        )
        
        logger.info(f"Sent direct message {message.id} from user {user_id} to user {message_data.to_user_id}")
        return message
        
    except ValueError as e:
        logger.warning(f"Failed to send direct message: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error sending direct message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/direct/{other_user_id}", response_model=DirectMessageListResponse)
async def get_direct_messages(
    other_user_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get direct messages between current user and another user.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Query Parameters:**
    - skip: Number of messages to skip (pagination)
    - limit: Maximum number of messages to return
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        messaging_service = MessagingService(db)
        messages, total = messaging_service.get_direct_messages(
            user_id=user_id,
            other_user_id=other_user_id,
            skip=skip,
            limit=limit,
        )
        
        return DirectMessageListResponse(
            messages=messages,
            total=total,
            skip=skip,
            limit=limit
        )
        
    except Exception as e:
        logger.error(f"Unexpected error getting direct messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/conversations", response_model=ConversationListResponse)
async def get_conversations(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get list of conversations for the current user.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Query Parameters:**
    - skip: Number of conversations to skip (pagination)
    - limit: Maximum number of conversations to return
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        messaging_service = MessagingService(db)
        conversations = messaging_service.get_user_conversations(
            user_id=user_id,
            skip=skip,
            limit=limit,
        )
        
        return ConversationListResponse(
            conversations=conversations,
            total=len(conversations)
        )
        
    except Exception as e:
        logger.error(f"Unexpected error getting conversations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


# Task Chat Message endpoints
@router.post("/task-chat", response_model=TaskChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_task_chat_message(
    message_data: TaskChatMessageCreate,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Send a message to a task's chat channel.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Request Body:**
    ```json
    {
      "task_id": 123,
      "content": "Just pushed the latest changes!",
      "content_type": "text",
      "parent_message_id": 456,
      "media_attachment_ids": [789]
    }
    ```
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        messaging_service = MessagingService(db)
        message = messaging_service.send_task_chat_message(
            task_id=message_data.task_id,
            from_user_id=user_id,
            content=message_data.content,
            content_type=message_data.content_type,
            parent_message_id=message_data.parent_message_id,
            media_attachment_ids=message_data.media_attachment_ids,
        )
        
        # Get task participants for broadcasting
        from app.services.task_service import TaskService
        task_service = TaskService(db)
        participants = task_service.get_task_participants(message_data.task_id)
        
        # Remove sender from recipients
        recipients = [p for p in participants if p != user_id]
        
        # Send real-time notification to task participants
        await websocket_manager.broadcast_messages(
            recipients,
            {
                "type": "task_chat_message",
                "message_id": message.id,
                "task_id": message_data.task_id,
                "from_user_id": user_id,
                "from_username": user_data.get("username", "Unknown"),
                "content": message.content,
                "timestamp": message.created_at.isoformat(),
            }
        )
        
        logger.info(f"Sent task chat message {message.id} to task {message_data.task_id} by user {user_id}")
        return message
        
    except ValueError as e:
        logger.warning(f"Failed to send task chat message: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error sending task chat message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/task-chat/{task_id}", response_model=TaskChatMessageListResponse)
async def get_task_chat_messages(
    task_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get chat messages for a specific task.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Query Parameters:**
    - skip: Number of messages to skip (pagination)
    - limit: Maximum number of messages to return
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        messaging_service = MessagingService(db)
        messages, total = messaging_service.get_task_chat_messages(
            task_id=task_id,
            user_id=user_id,
            skip=skip,
            limit=limit,
        )
        
        return TaskChatMessageListResponse(
            messages=messages,
            total=total,
            skip=skip,
            limit=limit
        )
        
    except ValueError as e:
        logger.warning(f"Failed to get task chat messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error getting task chat messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


# Message Read Status endpoints
@router.post("/mark-read")
async def mark_messages_as_read(
    read_request: MessageReadRequest,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Mark messages as read.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Request Body:**
    ```json
    {
      "message_ids": [123, 456, 789]
    }
    ```
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        messaging_service = MessagingService(db)
        success_count = 0
        
        for message_id in read_request.message_ids:
            try:
                # Try direct message first
                messaging_service.mark_direct_message_as_read(message_id, user_id)
                success_count += 1
            except ValueError:
                try:
                    # Try task chat message
                    messaging_service.mark_task_chat_message_as_read(message_id, user_id)
                    success_count += 1
                except ValueError:
                    logger.warning(f"Could not mark message {message_id} as read for user {user_id}")
        
        return {
            "message": f"Marked {success_count} messages as read",
            "success_count": success_count,
            "total_requested": len(read_request.message_ids)
        }
        
    except Exception as e:
        logger.error(f"Unexpected error marking messages as read: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


# User Status endpoints
@router.post("/users/status", response_model=UserStatusResponse)
async def update_user_status(
    status_update: UserStatusUpdate,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Update user's online status.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Request Body:**
    ```json
    {
      "status": "online",
      "custom_message": "Working on project tasks"
    }
    ```
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        status_service = UserStatusService(db)
        user_status = status_service.update_user_status(
            user_id=user_id,
            status=status_update.status,
            custom_message=status_update.custom_message,
        )
        
        # Broadcast status change via WebSocket
        await websocket_manager.update_user_status(user_id, status_update.status, db)
        
        logger.info(f"Updated status for user {user_id} to {status_update.status}")
        return user_status
        
    except Exception as e:
        logger.error(f"Unexpected error updating user status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/users/status/{user_id}", response_model=UserStatusResponse)
async def get_user_status(
    user_id: int,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get a user's current status.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    """
    user_data = get_user_data_from_header(x_user_data)
    
    try:
        status_service = UserStatusService(db)
        user_status = status_service.get_user_status(user_id)
        
        if not user_status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Status for user {user_id} not found"
            )
        
        return user_status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error getting user status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/users/online", response_model=OnlineUsersResponse)
async def get_online_users(
    limit: int = 100,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get list of currently online users.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Query Parameters:**
    - limit: Maximum number of users to return
    """
    user_data = get_user_data_from_header(x_user_data)
    
    try:
        status_service = UserStatusService(db)
        online_users = status_service.get_online_users(limit=limit)
        
        return OnlineUsersResponse(
            online_users=online_users,
            total=len(online_users)
        )
        
    except Exception as e:
        logger.error(f"Unexpected error getting online users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


# Typing Indicator endpoint
@router.post("/typing")
async def send_typing_indicator(
    typing_request: TypingIndicatorRequest,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Send typing indicator for real-time messaging.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Request Body:**
    ```json
    {
      "context_type": "task_chat",
      "context_id": 123,
      "is_typing": true
    }
    ```
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        await websocket_manager.handle_typing_indicator(
            user_id=user_id,
            context_type=typing_request.context_type,
            context_id=typing_request.context_id,
            is_typing=typing_request.is_typing,
            db=db
        )
        
        return {"message": "Typing indicator sent successfully"}
        
    except Exception as e:
        logger.error(f"Unexpected error sending typing indicator: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


# Message Threading endpoints
@router.get("/threads/{user_id}")
async def get_conversation_threads(
    user_id: int,
    skip: int = Query(default=0, ge=0, description="Number of threads to skip"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum number of threads"),
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get conversation threads between current user and specified user.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Response:**
    ```json
    {
      "threads": [
        {
          "thread_id": "uuid-string",
          "message_count": 15,
          "latest_message_at": "2024-01-15T10:30:00Z",
          "latest_message": {
            "content": "Latest message content",
            "from_user_id": 123,
            "from_username": "john_doe"
          }
        }
      ],
      "total": 3
    }
    ```
    """
    user_data = get_user_data_from_header(x_user_data)
    current_user_id = user_data["user_id"]
    
    try:
        messaging_service = MessagingService(db)
        threads = messaging_service.get_conversation_threads(
            user1_id=current_user_id,
            user2_id=user_id,
            skip=skip,
            limit=limit
        )
        
        return {
            "threads": threads,
            "total": len(threads)
        }
        
    except Exception as e:
        logger.error(f"Error getting conversation threads: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/threads")
async def create_message_thread(
    to_user_id: int,
    initial_message: str,
    content_type: str = "markdown",
    media_attachment_ids: Optional[List[int]] = None,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Create a new message thread.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Request Body:**
    ```json
    {
      "to_user_id": 456,
      "initial_message": "Hey, let's start a new conversation thread!",
      "content_type": "markdown",
      "media_attachment_ids": [1, 2]
    }
    ```
    
    **Response:**
    ```json
    {
      "thread_id": "uuid-string",
      "created_at": "2024-01-15T10:30:00Z",
      "initial_message": {
        "id": 123,
        "content": "Hey, let's start a new conversation thread!",
        "from_user_id": 123,
        "to_user_id": 456,
        "created_at": "2024-01-15T10:30:00Z"
      },
      "participant_ids": [123, 456]
    }
    ```
    """
    user_data = get_user_data_from_header(x_user_data)
    from_user_id = user_data["user_id"]
    
    try:
        messaging_service = MessagingService(db)
        thread_info = messaging_service.create_message_thread(
            from_user_id=from_user_id,
            to_user_id=to_user_id,
            initial_message=initial_message,
            content_type=content_type,
            media_attachment_ids=media_attachment_ids
        )
        
        return thread_info
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating message thread: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/threads/{thread_id}/messages")
async def get_thread_messages(
    thread_id: str,
    skip: int = Query(default=0, ge=0, description="Number of messages to skip"),
    limit: int = Query(default=50, ge=1, le=100, description="Maximum number of messages"),
    include_media: bool = Query(default=True, description="Include media attachments"),
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get messages in a specific thread.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Response:**
    ```json
    {
      "thread_id": "uuid-string",
      "messages": [
        {
          "id": 123,
          "content": "Message content",
          "from_user_id": 123,
          "to_user_id": 456,
          "created_at": "2024-01-15T10:30:00Z",
          "media_attachments": []
        }
      ],
      "total": 25
    }
    ```
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        messaging_service = MessagingService(db)
        messages = messaging_service.get_thread_messages(
            thread_id=thread_id,
            user_id=user_id,
            skip=skip,
            limit=limit,
            include_media=include_media
        )
        
        # Convert messages to response format
        message_list = []
        for message in messages:
            message_dict = {
                "id": message.id,
                "content": message.content,
                "content_type": message.content_type,
                "from_user_id": message.from_user_id,
                "to_user_id": message.to_user_id,
                "thread_id": message.thread_id,
                "created_at": message.created_at,
                "updated_at": message.updated_at,
            }
            
            if include_media and hasattr(message, 'media_attachments'):
                message_dict["media_attachments"] = [
                    {
                        "id": attachment.media_attachment_id,
                        "filename": attachment.media_attachment.filename,
                        "file_type": attachment.media_attachment.file_type,
                        "file_size": attachment.media_attachment.file_size,
                    }
                    for attachment in message.media_attachments
                ]
            
            message_list.append(message_dict)
        
        return {
            "thread_id": thread_id,
            "messages": message_list,
            "total": len(message_list)
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting thread messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/threads/{thread_id}/participants")
async def get_thread_participants(
    thread_id: str,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get participants in a message thread.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Response:**
    ```json
    {
      "thread_id": "uuid-string",
      "participants": [
        {
          "id": 123,
          "username": "john_doe",
          "first_name": "John",
          "last_name": "Doe",
          "email": "john@example.com"
        }
      ],
      "total": 2
    }
    ```
    """
    user_data = get_user_data_from_header(x_user_data)
    
    try:
        messaging_service = MessagingService(db)
        participants = messaging_service.get_thread_participants(thread_id)
        
        participant_list = []
        for participant in participants:
            participant_list.append({
                "id": participant.id,
                "username": participant.username,
                "first_name": participant.first_name,
                "last_name": participant.last_name,
                "email": participant.email,
            })
        
        return {
            "thread_id": thread_id,
            "participants": participant_list,
            "total": len(participant_list)
        }
        
    except Exception as e:
        logger.error(f"Error getting thread participants: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
