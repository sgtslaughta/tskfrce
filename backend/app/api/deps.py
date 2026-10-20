"""
API Dependencies

Common dependencies used across API endpoints including database sessions,
authentication, and user context management.
"""

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.auth import AuthService
from app.core.database import get_db_session
from app.core.logging import get_logger
from app.models.user import User, UserRole

logger = get_logger(__name__)

security = HTTPBearer(auto_error=False)


get_db = get_db_session  # alias kept for existing routes


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="You are not logged in. Log in and try again.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def user_from_token(token: str | None, db: Session) -> User | None:
    """Decode a bearer JWT (PyJWT) and load its active user, or None."""
    return AuthService(db).get_current_user(token) if token else None


def get_current_user_from_token(
    token: HTTPAuthorizationCredentials | None = Depends(security), db: Session = Depends(get_db)
) -> User:
    """Get current user from the Authorization: Bearer JWT. The only identity source."""
    user = user_from_token(token.credentials if token else None, db)
    if user is None:
        raise _unauthorized()
    return user


get_current_user = get_current_user_from_token


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Get current active user (must be active/not disabled).
    """
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user


def require_parent(user: User = Depends(get_current_active_user)) -> User:
    """Allow parents only."""
    if user.role != UserRole.PARENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only parents can do this."
        )
    return user


def require_self_or_parent(user_id: int, user: User) -> None:
    """Kids may only touch their own records; parents may touch anyone's."""
    if user.id != user_id and user.role != UserRole.PARENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You can only do this for yourself."
        )


def get_current_superuser(current_user: User = Depends(get_current_user)) -> User:
    """
    Get current superuser (must be superuser/admin).
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return current_user


def get_optional_user(
    token: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User | None:
    """Current user if a valid bearer token is sent, else None."""
    return user_from_token(token.credentials if token else None, db)


class CommonQueryParams:
    """
    Common query parameters for list endpoints.
    """

    def __init__(
        self,
        limit: int = 50,
        offset: int = 0,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ):
        self.limit = min(limit, 100)  # Cap at 100
        self.offset = max(offset, 0)  # Ensure non-negative
        self.sort_by = sort_by
        self.sort_order = sort_order.lower() if sort_order.lower() in ["asc", "desc"] else "desc"


def get_pagination_params(
    limit: int = 50, offset: int = 0, sort_by: str | None = None, sort_order: str = "desc"
) -> CommonQueryParams:
    """
    Dependency for common pagination parameters.
    """
    return CommonQueryParams(limit, offset, sort_by, sort_order)


def verify_task_access(
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> bool:
    """
    Verify that the current user has access to a specific task.
    """
    from app.models.task import Task

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Check if user is task creator, assignee, or has admin privileges
    if (
        task.created_by_id == current_user.id
        or task.assigned_to_id == current_user.id
        or current_user.is_superuser
    ):
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions to access this task"
    )


def verify_comment_access(
    comment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> bool:
    """
    Verify that the current user has access to a specific comment.
    """
    from app.models.task_comment import TaskComment

    comment = db.query(TaskComment).filter(TaskComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    # Check task access first
    verify_task_access(comment.task_id, current_user, db)
    return True


def verify_message_access(
    message_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> bool:
    """
    Verify that the current user has access to a specific message.
    """
    from app.models.conversation import Conversation
    from app.models.direct_message import DirectMessage

    message = db.query(DirectMessage).filter(DirectMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    # Check if user is participant in the conversation
    conversation = db.query(Conversation).filter(Conversation.id == message.conversation_id).first()

    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Check if current user is a participant
    participant_ids = [p.id for p in conversation.participants]
    if current_user.id not in participant_ids and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to access this message",
        )

    return True


def get_request_metadata(
    user_agent: str | None = Header(None),
    x_forwarded_for: str | None = Header(None),
    x_real_ip: str | None = Header(None),
) -> dict:
    """
    Extract request metadata for logging and analytics.
    """
    return {"user_agent": user_agent, "forwarded_for": x_forwarded_for, "real_ip": x_real_ip}
