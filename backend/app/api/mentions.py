"""
Mentions API endpoints for TaaskMaaster.

This module contains FastAPI routes for mention-related operations.
"""

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.logging import get_logger
from app.services.mention_service import MentionService

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


@router.get("/suggestions")
async def get_mention_suggestions(
    context_type: str = Query(..., description="Context type (task, direct_message, general)"),
    context_id: Optional[int] = Query(None, description="Context ID (e.g., task_id)"),
    search: Optional[str] = Query(None, description="Search query to filter users"),
    limit: int = Query(default=10, le=50, description="Maximum number of suggestions"),
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Get mention suggestions for autocomplete.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Query Parameters:**
    - context_type: Type of context (task, direct_message, general)
    - context_id: Optional context ID (e.g., task_id for task context)
    - search: Optional search query to filter users by name/username
    - limit: Maximum number of suggestions to return
    
    **Response:**
    ```json
    {
      "suggestions": [
        {
          "id": 123,
          "username": "john_doe",
          "display_name": "John Doe",
          "email": "john@example.com",
          "mention_text": "@john_doe",
          "avatar_url": null
        }
      ]
    }
    ```
    """
    user_data = get_user_data_from_header(x_user_data)
    user_id = user_data["user_id"]
    
    try:
        mention_service = MentionService(db)
        suggestions = mention_service.get_mentionable_users(
            current_user_id=user_id,
            context_type=context_type,
            context_id=context_id,
            search_query=search,
            limit=limit
        )
        
        return {"suggestions": suggestions}
        
    except Exception as e:
        logger.error(f"Error getting mention suggestions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/extract")
async def extract_mentions(
    content: str,
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Extract mentions from content.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Request Body:**
    ```json
    {
      "content": "Hey @john_doe, can you check @jane_smith's work?"
    }
    ```
    
    **Response:**
    ```json
    {
      "mentions": [
        {
          "username": "john_doe",
          "valid": true,
          "user": {
            "id": 123,
            "username": "john_doe",
            "display_name": "John Doe"
          }
        },
        {
          "username": "jane_smith",
          "valid": false,
          "user": null
        }
      ]
    }
    ```
    """
    user_data = get_user_data_from_header(x_user_data)
    
    try:
        mention_service = MentionService(db)
        
        # Extract mentioned usernames
        mentioned_usernames = mention_service.extract_mentions(content)
        
        # Validate mentions
        valid_users = mention_service.validate_mentions(mentioned_usernames)
        valid_usernames = {user.username: user for user in valid_users}
        
        # Build response
        mentions = []
        for username in mentioned_usernames:
            if username in valid_usernames:
                user = valid_usernames[username]
                display_name = user.username
                if user.first_name and user.last_name:
                    display_name = f"{user.first_name} {user.last_name}"
                elif user.first_name:
                    display_name = user.first_name
                
                mentions.append({
                    "username": username,
                    "valid": True,
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "display_name": display_name,
                        "email": user.email,
                    }
                })
            else:
                mentions.append({
                    "username": username,
                    "valid": False,
                    "user": None
                })
        
        return {"mentions": mentions}
        
    except Exception as e:
        logger.error(f"Error extracting mentions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/highlight")
async def highlight_mentions(
    content: str,
    format_type: str = "html",
    db: Session = Depends(get_db),
    x_user_data: Optional[str] = Header(None)
):
    """
    Highlight mentions in content for display.
    
    **Headers:**
    - X-User-Data: JSON containing user information
    
    **Request Body:**
    ```json
    {
      "content": "Hey @john_doe, great work!",
      "format_type": "html"
    }
    ```
    
    **Response:**
    ```json
    {
      "highlighted_content": "Hey <span class=\"mention\" data-username=\"john_doe\">@john_doe</span>, great work!"
    }
    ```
    """
    user_data = get_user_data_from_header(x_user_data)
    
    try:
        mention_service = MentionService(db)
        highlighted_content = mention_service.highlight_mentions_in_content(
            content, format_type
        )
        
        return {"highlighted_content": highlighted_content}
        
    except Exception as e:
        logger.error(f"Error highlighting mentions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
