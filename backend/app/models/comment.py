"""
Comment and messaging models for TaaskMaaster.

This module contains models for task comments, direct messages, task chat,
status history, and related functionality for the workflow enhancement system.
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base



class TaskStatusHistory(Base):
    """
    Task status change history for workflow tracking.
    
    Attributes:
        id: Primary key
        task_id: Associated task
        user_id: User who made the change
        previous_status: Previous task status
        new_status: New task status
        comment: Optional comment with status change
        created_at: When the change occurred
    """
    
    __tablename__ = "task_status_history"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    previous_status = Column(String(50), nullable=True)  # Store as string for flexibility
    new_status = Column(String(50), nullable=False)
    comment = Column(Text, nullable=True)  # Optional comment with status change
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    task = relationship("Task", back_populates="status_history")
    user = relationship("User")
    
    def __repr__(self) -> str:
        """String representation of TaskStatusHistory."""
        return (
            f"<TaskStatusHistory(id={self.id}, task_id={self.task_id}, "
            f"{self.previous_status} -> {self.new_status})>"
        )






class TaskChatMessage(Base):
    """
    Chat messages for task-specific conversations.
    
    Attributes:
        id: Primary key
        task_id: Associated task
        from_user_id: User sending the message
        content: Message content
        content_type: Content format (text, markdown)
        parent_message_id: Parent message for replies
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    
    __tablename__ = "task_chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    content_type = Column(String(50), default="text")  # text, markdown
    parent_message_id = Column(Integer, ForeignKey("task_chat_messages.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    task = relationship("Task", back_populates="chat_messages")
    from_user = relationship("User")
    parent_message = relationship("TaskChatMessage", remote_side=[id])
    replies = relationship("TaskChatMessage", back_populates="parent_message")
    media_attachments = relationship("TaskChatMessageMedia", back_populates="message", cascade="all, delete-orphan")
    read_receipts = relationship("MessageReadReceipt", back_populates="task_chat_message", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        """String representation of TaskChatMessage."""
        return (
            f"<TaskChatMessage(id={self.id}, task_id={self.task_id}, "
            f"from_user_id={self.from_user_id})>"
        )


class MessageReadReceipt(Base):
    """
    Read receipts for messages.
    
    Attributes:
        id: Primary key
        direct_message_id: Associated direct message (nullable)
        task_chat_message_id: Associated task chat message (nullable)
        user_id: User who read the message
        read_at: When message was read
    """
    
    __tablename__ = "message_read_receipts"
    
    id = Column(Integer, primary_key=True, index=True)
    direct_message_id = Column(Integer, ForeignKey("direct_messages.id"), nullable=True)
    task_chat_message_id = Column(Integer, ForeignKey("task_chat_messages.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    read_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    direct_message = relationship("DirectMessage", back_populates="read_receipts")
    task_chat_message = relationship("TaskChatMessage", back_populates="read_receipts")
    user = relationship("User")
    
    def __repr__(self) -> str:
        """String representation of MessageReadReceipt."""
        return (
            f"<MessageReadReceipt(id={self.id}, user_id={self.user_id})>"
        )


class DirectMessageMedia(Base):
    """
    Junction table for direct message media attachments.
    
    Attributes:
        id: Primary key
        message_id: Associated direct message
        media_attachment_id: Associated media attachment
        created_at: When attachment was added
    """
    
    __tablename__ = "direct_message_media"
    
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("direct_messages.id"), nullable=False)
    media_attachment_id = Column(Integer, ForeignKey("media_attachments.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    message = relationship("DirectMessage", back_populates="media_attachments")
    media_attachment = relationship("MediaAttachment")
    
    def __repr__(self) -> str:
        """String representation of DirectMessageMedia."""
        return (
            f"<DirectMessageMedia(message_id={self.message_id}, "
            f"media_id={self.media_attachment_id})>"
        )


class TaskChatMessageMedia(Base):
    """
    Junction table for task chat message media attachments.
    
    Attributes:
        id: Primary key
        message_id: Associated task chat message
        media_attachment_id: Associated media attachment
        created_at: When attachment was added
    """
    
    __tablename__ = "task_chat_message_media"
    
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("task_chat_messages.id"), nullable=False)
    media_attachment_id = Column(Integer, ForeignKey("media_attachments.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    message = relationship("TaskChatMessage", back_populates="media_attachments")
    media_attachment = relationship("MediaAttachment")
    
    def __repr__(self) -> str:
        """String representation of TaskChatMessageMedia."""
        return (
            f"<TaskChatMessageMedia(message_id={self.message_id}, "
            f"media_id={self.media_attachment_id})>"
        )


class UserStatus(Base):
    """
    User online status and presence information.
    
    Attributes:
        id: Primary key
        user_id: Associated user
        status: Current status (online, away, busy, offline)
        last_seen: Last activity timestamp
        custom_message: Optional custom status message
        updated_at: Last status update timestamp
    """
    
    __tablename__ = "user_status"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    status = Column(String(20), default="offline", index=True)  # online, away, busy, offline
    last_seen = Column(DateTime, default=datetime.utcnow, index=True)
    custom_message = Column(String(255), nullable=True)  # Optional status message
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    
    def __repr__(self) -> str:
        """String representation of UserStatus."""
        return (
            f"<UserStatus(user_id={self.user_id}, status='{self.status}')>"
        )


class CommentAuditTrail(Base):
    """
    Audit trail for comment changes.
    
    Tracks all modifications to comments for accountability and history.
    """
    
    __tablename__ = "comment_audit_trail"

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("task_comments.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # created, updated, soft_deleted, hard_deleted
    original_content = Column(Text, nullable=True)
    new_content = Column(Text, nullable=True)
    edit_reason = Column(Text, nullable=True)
    deletion_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    comment = relationship("TaskComment", back_populates="audit_trail")
    user = relationship("User", back_populates="comment_audit_entries")

    def __repr__(self) -> str:
        """String representation of CommentAuditTrail."""
        return f"<CommentAuditTrail(id={self.id}, comment_id={self.comment_id}, action='{self.action}')>"
