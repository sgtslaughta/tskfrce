"""
Conversation model for TaaskMaaster.

This module defines the Conversation model for managing user conversations.
"""

from datetime import datetime
from typing import List
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import relationship

from app.core.database import Base

# Association table for conversation participants
conversation_participants = Table(
    'conversation_participants',
    Base.metadata,
    Column('conversation_id', Integer, ForeignKey('conversations.id'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('joined_at', DateTime, default=datetime.utcnow, nullable=False),
    Column('left_at', DateTime, nullable=True),
    Column('is_muted', Boolean, default=False, nullable=False),
    Column('muted_until', DateTime, nullable=True)
)


class Conversation(Base):
    """
    Conversation model for managing user conversations.
    """
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(20), nullable=False, default="direct")  # 'direct' or 'group'
    title = Column(String(255), nullable=True)  # For group conversations
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    creator = relationship("User", foreign_keys=[creator_id], back_populates="created_conversations")
    participants = relationship(
        "User", 
        secondary=conversation_participants, 
        back_populates="conversations"
    )
    messages = relationship("DirectMessage", back_populates="conversation", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Conversation(id={self.id}, type={self.type}, creator_id={self.creator_id})>"

    @property
    def last_message(self):
        """Get the last message in the conversation."""
        if self.messages:
            return sorted(self.messages, key=lambda m: m.created_at, reverse=True)[0]
        return None

    @property
    def participant_count(self) -> int:
        """Get the number of participants in the conversation."""
        return len(self.participants) if self.participants else 0

    def get_unread_count_for_user(self, user_id: int) -> int:
        """Get the number of unread messages for a specific user."""
        if not self.messages:
            return 0
        
        # Find the last message the user has read
        user_messages = [m for m in self.messages if m.sender_id != user_id]
        unread_messages = [m for m in user_messages if not m.read_at]
        
        return len(unread_messages)

    def is_participant(self, user_id: int) -> bool:
        """Check if a user is a participant in this conversation."""
        return any(p.id == user_id for p in self.participants)

    def get_other_participant(self, user_id: int):
        """Get the other participant in a direct conversation."""
        if self.type == "direct" and len(self.participants) == 2:
            return next((p for p in self.participants if p.id != user_id), None)
        return None

    def can_be_accessed_by(self, user_id: int) -> bool:
        """Check if a user can access this conversation."""
        return self.is_participant(user_id)

    def can_be_modified_by(self, user_id: int) -> bool:
        """Check if a user can modify this conversation."""
        return self.creator_id == user_id or self.is_participant(user_id)


class ConversationSettings(Base):
    """
    User-specific conversation settings.
    """
    __tablename__ = "conversation_settings"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    notifications_enabled = Column(Boolean, default=True, nullable=False)
    sound_enabled = Column(Boolean, default=True, nullable=False)
    desktop_notifications = Column(Boolean, default=True, nullable=False)
    email_notifications = Column(Boolean, default=False, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    custom_ringtone = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    conversation = relationship("Conversation")
    user = relationship("User", back_populates="conversation_settings")

    def __repr__(self):
        return f"<ConversationSettings(id={self.id}, conversation_id={self.conversation_id}, user_id={self.user_id})>"
