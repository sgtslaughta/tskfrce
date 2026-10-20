"""
User model for TaaskMaaster.

This module contains the User model for authentication and user management.
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserRole(str, Enum):
    """User roles for RBAC."""
    
    USER = "user"  # Basic user - can only view their own tasks
    ORGANIZER = "organizer"  # Can create and manage tasks, view all tasks
    ADMIN = "admin"  # Full system access


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

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(SQLEnum(UserRole), default=UserRole.USER, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    profile_picture = Column(String(500), nullable=True)
    timezone = Column(String(50), default="UTC")
    preferences = Column(Text, nullable=True)  # JSON string

    # Relationships
    tasks = relationship(
        "Task",
        back_populates="assigned_to",
        foreign_keys="Task.assigned_to_id",
    )
    created_tasks = relationship(
        "Task", back_populates="created_by", foreign_keys="Task.created_by_id"
    )
    goals = relationship("Goal", back_populates="user")
    achievements = relationship("UserAchievement", back_populates="user")
    points = relationship("Points", back_populates="user")
    created_lists = relationship("TaskList", back_populates="created_by")
    
    # Comment relationships
    comments = relationship("TaskComment", back_populates="user", foreign_keys="TaskComment.user_id")
    comment_reactions = relationship("CommentReaction", back_populates="user")
    comment_mentions_received = relationship("CommentMention", back_populates="mentioned_user", foreign_keys="CommentMention.mentioned_user_id")
    comment_mentions_made = relationship("CommentMention", back_populates="mentioned_by_user", foreign_keys="CommentMention.mentioned_by_user_id")
    comment_audit_entries = relationship("CommentAuditTrail", back_populates="user")
    
    # Messaging relationships
    sent_messages = relationship("DirectMessage", back_populates="sender", foreign_keys="DirectMessage.sender_id")
    message_reactions = relationship("MessageReaction", back_populates="user")
    created_conversations = relationship("Conversation", back_populates="creator", foreign_keys="Conversation.creator_id")
    conversations = relationship("Conversation", secondary="conversation_participants", back_populates="participants")
    conversation_settings = relationship("ConversationSettings", back_populates="user")
    
    # Notification relationships
    notifications = relationship("Notification", back_populates="user")

    def __repr__(self) -> str:
        """String representation of User."""
        return (
            f"<User(id={self.id}, username='{self.username}', "
            f"email='{self.email}', role='{self.role}')>"
        )
