"""
User model for TaaskMaaster.

This module contains the User model for authentication and user management.
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserRole(str, Enum):
    """User roles for RBAC."""

    PARENT = "parent"
    KID = "kid"
    # ponytail: aliases keep v1 code compiling; remove as code is touched
    ADMIN = "parent"
    ORGANIZER = "parent"
    USER = "kid"


class User(Base):
    """
    User model for authentication and user management.

    Attributes:
        id: Primary key
        username: Unique username
        email: Unique email address
        hashed_password: Hashed password
        full_name: User's full name
        role: User role for RBAC (user, organizer, admin)
        is_active: Whether user account is active
        is_superuser: Whether user has superuser privileges
        created_at: Account creation timestamp
        updated_at: Last update timestamp
        profile_picture: URL to profile picture
        timezone: User's timezone
        preferences: JSON string of user preferences
    """

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("age_group IN ('little','kid','teen')", name="ck_user_age_group"),
    )

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(SQLEnum(UserRole), default=UserRole.KID, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    profile_picture = Column(String(500), nullable=True)
    timezone = Column(String(50), default="UTC")
    preferences = Column(Text, nullable=True)  # JSON string
    pin_hash = Column(String(255), nullable=True)
    avatar = Column(String(255), nullable=True)
    celebrated_level = Column(Integer, nullable=False, default=1, server_default="1")
    age_group = Column(String(6), nullable=False, default="kid", server_default="kid")
    push_topic = Column(String(40), nullable=True, unique=True)

    # Relationships
    points = relationship("Points", back_populates="user", foreign_keys="Points.user_id")

    def __repr__(self) -> str:
        """String representation of User."""
        return (
            f"<User(id={self.id}, username='{self.username}', "
            f"email='{self.email}', role='{self.role}')>"
        )


class UsedInvite(Base):
    """Redeemed parent-invite token ids; the primary key makes each invite single-use."""

    __tablename__ = "used_invites"

    jti = Column(String(64), primary_key=True)
    used_at = Column(DateTime, default=datetime.utcnow, nullable=False)
