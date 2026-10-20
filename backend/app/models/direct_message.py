"""
Direct Message model for TaaskMaaster.

This module defines the DirectMessage model for user-to-user messaging.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class DirectMessage(Base):
    """
    Direct message model for user-to-user messaging.
    """
    __tablename__ = "direct_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    reply_to_message_id = Column(Integer, ForeignKey("direct_messages.id"), nullable=True, index=True)
    is_edited = Column(Boolean, default=False, nullable=False)
    edited_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    reply_to_message = relationship("DirectMessage", remote_side=[id], back_populates="replies")
    replies = relationship("DirectMessage", back_populates="reply_to_message", cascade="all, delete-orphan")
    
    # Media attachments relationship
    media_attachments = relationship("DirectMessageMedia", back_populates="message", cascade="all, delete-orphan")
    
    # Reactions relationship
    reactions = relationship("MessageReaction", back_populates="message", cascade="all, delete-orphan")
    
    # Read receipts relationship
    read_receipts = relationship("MessageReadReceipt", back_populates="direct_message", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<DirectMessage(id={self.id}, conversation_id={self.conversation_id}, sender_id={self.sender_id})>"

    @property
    def is_read(self) -> bool:
        """Check if the message has been read."""
        return self.read_at is not None

    def can_be_edited_by(self, user_id: int) -> bool:
        """Check if a user can edit this message."""
        return self.sender_id == user_id

    def can_be_deleted_by(self, user_id: int) -> bool:
        """Check if a user can delete this message."""
        return self.sender_id == user_id


class MessageReaction(Base):
    """
    Message reaction model.
    """
    __tablename__ = "message_reactions"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("direct_messages.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reaction = Column(String(50), nullable=False)  # emoji or reaction type
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    message = relationship("DirectMessage", back_populates="reactions")
    user = relationship("User", back_populates="message_reactions")

    def __repr__(self):
        return f"<MessageReaction(id={self.id}, message_id={self.message_id}, reaction={self.reaction})>"



