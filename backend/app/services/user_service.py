"""
User service for TaaskMaaster.

This module contains business logic for user management and authentication.
"""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import asc
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate

logger = get_logger(__name__)


class UserService:
    """Service for user management operations."""

    def __init__(self, db: Session):
        """Initialize user service with database session."""
        self.db = db

    def create_user(self, user_data: UserCreate) -> User:
        """
        Create a new user.

        Args:
            user_data: User creation data

        Returns:
            Created user instance
        """
        # Import here to avoid circular import
        from app.core.auth import pwd_context

        # Hash the password
        hashed_password = pwd_context.hash(user_data.password)

        user = User(
            username=user_data.username,
            email=user_data.email,
            full_name=user_data.full_name,
            timezone=user_data.timezone,
            hashed_password=hashed_password,
            role=user_data.role if user_data.role else None,
        )

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        logger.info(f"Created user {user.id} with username {user.username}")
        return user

    def get_user(self, user_id: int) -> Optional[User]:
        """
        Get a user by ID.

        Args:
            user_id: User ID

        Returns:
            User instance or None
        """
        return self.db.query(User).filter(User.id == user_id).first()

    def get_user_by_username(self, username: str) -> Optional[User]:
        """
        Get a user by username.

        Args:
            username: Username

        Returns:
            User instance or None
        """
        return self.db.query(User).filter(User.username == username).first()

    def get_user_by_email(self, email: str) -> Optional[User]:
        """
        Get a user by email.

        Args:
            email: Email address

        Returns:
            User instance or None
        """
        return self.db.query(User).filter(User.email == email).first()

    def get_users(
        self, skip: int = 0, limit: int = 100, is_active: Optional[bool] = None
    ) -> tuple[List[User], int]:
        """
        Get users with filtering and pagination.

        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            is_active: Filter by active status

        Returns:
            Tuple of (users, total_count)
        """
        query = self.db.query(User)

        if is_active is not None:
            query = query.filter(User.is_active == is_active)

        total = query.count()
        users = (
            query.order_by(asc(User.username)).offset(skip).limit(limit).all()
        )

        return users, total

    def update_user(
        self, user_id: int, user_data: UserUpdate
    ) -> Optional[User]:
        """
        Update a user.

        Args:
            user_id: User ID
            user_data: User update data

        Returns:
            Updated user instance or None
        """
        user = self.get_user(user_id)
        if not user:
            return None

        # Update fields
        update_data = user_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)

        user.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(user)

        logger.info(f"Updated user {user_id}")
        return user

    def delete_user(self, user_id: int) -> bool:
        """
        Delete a user.

        Args:
            user_id: User ID

        Returns:
            True if deleted, False otherwise
        """
        user = self.get_user(user_id)
        if not user:
            return False

        self.db.delete(user)
        self.db.commit()

        logger.info(f"Deleted user {user_id}")
        return True

    def authenticate_user(
        self, username: str, password: str
    ) -> Optional[User]:
        """
        Authenticate a user.

        Args:
            username: Username or email
            password: Password

        Returns:
            User instance if authenticated, None otherwise
        """
        # Import here to avoid circular import
        from app.core.auth import pwd_context

        # Try to find user by username or email
        user = self.get_user_by_username(username)
        if not user:
            user = self.get_user_by_email(username)

        if not user:
            return None

        # Verify password
        if not pwd_context.verify(password, user.hashed_password):
            return None

        if not user.is_active:
            return None

        logger.info(f"User {user.id} authenticated successfully")
        return user
