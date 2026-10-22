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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account is turned off. Ask a parent.",
        )
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
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You can't do that with this account."
        )
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


def get_request_metadata(
    user_agent: str | None = Header(None),
    x_forwarded_for: str | None = Header(None),
    x_real_ip: str | None = Header(None),
) -> dict:
    """
    Extract request metadata for logging and analytics.
    """
    return {"user_agent": user_agent, "forwarded_for": x_forwarded_for, "real_ip": x_real_ip}
