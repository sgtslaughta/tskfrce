"""
Authentication and authorization utilities for TaaskMaaster.

This module provides JWT-based authentication, password hashing,
and authorization utilities.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import get_db_session
from app.models.user import User
from app.services.user_service import UserService

logger = get_logger(__name__)

# Security configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer token scheme
security = HTTPBearer()


class AuthService:
    """Service for authentication and authorization operations."""

    def __init__(self, db: Session):
        """Initialize auth service with database session."""
        self.db = db
        self.user_service = UserService(db)

    def verify_password(
        self, plain_password: str, hashed_password: str
    ) -> bool:
        """
        Verify a plain password against its hash.

        Args:
            plain_password: Plain text password
            hashed_password: Hashed password

        Returns:
            True if password matches, False otherwise
        """
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        """
        Hash a password.

        Args:
            password: Plain text password

        Returns:
            Hashed password
        """
        return pwd_context.hash(password)

    def authenticate_user(
        self, username: str, password: str
    ) -> Optional[User]:
        """
        Authenticate a user with username/email and password.

        Args:
            username: Username or email
            password: Plain text password

        Returns:
            User instance if authenticated, None otherwise
        """
        # Try to find user by username or email
        user = self.user_service.get_user_by_username(username)
        if not user:
            user = self.user_service.get_user_by_email(username)

        if not user:
            return None

        # Verify password
        if not self.verify_password(password, user.hashed_password):
            return None

        if not user.is_active:
            return None

        logger.info(f"User {user.id} authenticated successfully")
        return user

    def create_access_token(
        self, data: dict, expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Create a JWT access token.

        Args:
            data: Data to encode in token
            expires_delta: Token expiration time

        Returns:
            JWT token string
        """
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=ACCESS_TOKEN_EXPIRE_MINUTES
            )

        to_encode.update({"exp": expire, "type": "access"})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    def create_refresh_token(
        self, data: dict, expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Create a JWT refresh token.

        Args:
            data: Data to encode in token
            expires_delta: Token expiration time

        Returns:
            JWT token string
        """
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                days=REFRESH_TOKEN_EXPIRE_DAYS
            )

        to_encode.update({"exp": expire, "type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    def verify_token(self, token: str) -> Optional[dict]:
        """
        Verify and decode a JWT token.

        Args:
            token: JWT token string

        Returns:
            Decoded token payload or None if invalid
        """
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except jwt.InvalidTokenError:
            return None

    def get_current_user(self, token: str) -> Optional[User]:
        """
        Get current user from JWT token.

        Args:
            token: JWT token string

        Returns:
            User instance or None
        """
        payload = self.verify_token(token)
        if payload is None:
            return None

        user_id = payload.get("sub")
        if user_id is None:
            return None
        
        try:
            user_id = int(user_id)
        except (ValueError, TypeError):
            return None

        user = self.user_service.get_user(user_id)
        if user is None or not user.is_active:
            return None

        return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db_session),
) -> User:
    """
    Dependency to get current authenticated user.

    Args:
        credentials: HTTP Bearer token credentials
        db: Database session

    Returns:
        Current authenticated user

    Raises:
        HTTPException: If authentication fails
    """
    auth_service = AuthService(db)
    user = auth_service.get_current_user(credentials.credentials)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Dependency to get current active user.

    Args:
        current_user: Current authenticated user

    Returns:
        Current active user

    Raises:
        HTTPException: If user is inactive
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
    return current_user


def get_current_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Dependency to get current superuser.

    Args:
        current_user: Current authenticated user

    Returns:
        Current superuser

    Raises:
        HTTPException: If user is not a superuser
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges",
        )
    return current_user
