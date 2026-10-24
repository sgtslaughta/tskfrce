"""
Authentication and authorization utilities for TaaskMaaster.

This module provides JWT-based authentication, password hashing,
and authorization utilities.
"""

import secrets
from datetime import datetime, timedelta

import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.models.user import User
from app.services.user_service import UserService

logger = get_logger(__name__)

# Security configuration
SECRET_KEY = settings.JWT_SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = 7
INVITE_TTL = timedelta(hours=24)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    """Service for authentication and authorization operations."""

    def __init__(self, db: Session):
        """Initialize auth service with database session."""
        self.db = db
        self.user_service = UserService(db)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
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

    def authenticate_user(self, username: str, password: str) -> User | None:
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

    def create_access_token(self, data: dict, expires_delta: timedelta | None = None) -> str:
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
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

        to_encode.update({"exp": expire, "type": "access"})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    def create_refresh_token(self, data: dict, expires_delta: timedelta | None = None) -> str:
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
            expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

        to_encode.update({"exp": expire, "type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    def create_invite_token(self, username: str, invited_by: int) -> str:
        """One-time parent invite; its jti is recorded in used_invites on redemption."""
        exp = datetime.utcnow() + INVITE_TTL
        data = {
            "sub": username,
            "by": invited_by,
            "exp": exp,
            "type": "invite",
            "jti": secrets.token_hex(16),
        }
        return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

    def read_invite(self, token: str | None) -> tuple[str, str] | None:
        """(username, jti) of an unexpired invite token, or None."""
        payload = self.verify_token(token) if token else None
        if not payload or payload.get("type") != "invite":
            return None
        if not payload.get("sub") or not payload.get("jti"):
            return None
        return payload["sub"], payload["jti"]

    def verify_token(self, token: str) -> dict | None:
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

    def get_current_user(self, token: str) -> User | None:
        """
        Get current user from JWT token.

        Args:
            token: JWT token string

        Returns:
            User instance or None
        """
        payload = self.verify_token(token)
        if payload is None or payload.get("type") != "access":
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
