"""
API Dependencies

Common dependencies used across API endpoints including database sessions,
authentication, and user context management.
"""

from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import json
from jose import JWTError, jwt

from app.core.database import SessionLocal
from app.core.config import settings
from app.models.user import User
from app.core.logging import get_logger

logger = get_logger(__name__)

security = HTTPBearer()


def get_db() -> Generator[Session, None, None]:
    """
    Database dependency that provides a database session.
    Automatically handles session cleanup.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user_from_token(
    token: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current user from JWT token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token.credentials, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    
    return user


def get_current_user_from_header(
    x_user_data: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get current user from X-User-Data header.
    This is used for API endpoints that expect user data in headers.
    """
    if not x_user_data:
        return None
    
    try:
        user_data = json.loads(x_user_data)
        user_id = user_data.get("id")
        
        if not user_id:
            return None
            
        user = db.query(User).filter(User.id == user_id).first()
        return user
        
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        logger.warning(f"Invalid user data in header: {e}")
        return None


def get_current_user(
    token: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_user_data: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current user from either JWT token or header data.
    Tries token first, then falls back to header data.
    """
    # Try to get user from JWT token first
    if token:
        try:
            return get_current_user_from_token(token, db)
        except HTTPException:
            pass
    
    # Fall back to header data
    user = get_current_user_from_header(x_user_data, db)
    if user:
        return user
    
    # If neither method works, raise authentication error
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current active user (must be active/not disabled).
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Inactive user"
        )
    return current_user


def get_current_superuser(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current superuser (must be superuser/admin).
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


def get_optional_user(
    token: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_user_data: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get current user optionally - returns None if not authenticated.
    Useful for endpoints that work with or without authentication.
    """
    try:
        return get_current_user(token, x_user_data, db)
    except HTTPException:
        return None


class CommonQueryParams:
    """
    Common query parameters for list endpoints.
    """
    def __init__(
        self,
        limit: int = 50,
        offset: int = 0,
        sort_by: Optional[str] = None,
        sort_order: str = "desc"
    ):
        self.limit = min(limit, 100)  # Cap at 100
        self.offset = max(offset, 0)  # Ensure non-negative
        self.sort_by = sort_by
        self.sort_order = sort_order.lower() if sort_order.lower() in ["asc", "desc"] else "desc"


def get_pagination_params(
    limit: int = 50,
    offset: int = 0,
    sort_by: Optional[str] = None,
    sort_order: str = "desc"
) -> CommonQueryParams:
    """
    Dependency for common pagination parameters.
    """
    return CommonQueryParams(limit, offset, sort_by, sort_order)


def verify_task_access(
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> bool:
    """
    Verify that the current user has access to a specific task.
    """
    from app.models.task import Task
    
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Check if user is task creator, assignee, or has admin privileges
    if (task.created_by_id == current_user.id or 
        task.assigned_to_id == current_user.id or
        current_user.is_superuser):
        return True
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not enough permissions to access this task"
    )


def verify_comment_access(
    comment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> bool:
    """
    Verify that the current user has access to a specific comment.
    """
    from app.models.task_comment import TaskComment
    
    comment = db.query(TaskComment).filter(TaskComment.id == comment_id).first()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    
    # Check task access first
    verify_task_access(comment.task_id, current_user, db)
    return True


def verify_message_access(
    message_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> bool:
    """
    Verify that the current user has access to a specific message.
    """
    from app.models.direct_message import DirectMessage
    from app.models.conversation import Conversation
    
    message = db.query(DirectMessage).filter(DirectMessage.id == message_id).first()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    # Check if user is participant in the conversation
    conversation = db.query(Conversation).filter(
        Conversation.id == message.conversation_id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Check if current user is a participant
    participant_ids = [p.id for p in conversation.participants]
    if current_user.id not in participant_ids and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to access this message"
        )
    
    return True


def get_request_metadata(
    user_agent: Optional[str] = Header(None),
    x_forwarded_for: Optional[str] = Header(None),
    x_real_ip: Optional[str] = Header(None)
) -> dict:
    """
    Extract request metadata for logging and analytics.
    """
    return {
        "user_agent": user_agent,
        "forwarded_for": x_forwarded_for,
        "real_ip": x_real_ip
    }
