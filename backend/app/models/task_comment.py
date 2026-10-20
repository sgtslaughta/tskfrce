"""
Task Comment model for TaaskMaaster.

This module defines the TaskComment model for handling comments on tasks.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class TaskComment(Base):
    """
    Task comment model.
    """
    __tablename__ = "task_comments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    parent_comment_id = Column(Integer, ForeignKey("task_comments.id"), nullable=True, index=True)
    is_system_generated = Column(Boolean, default=False, nullable=False)
    is_edited = Column(Boolean, default=False, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    pinned_at = Column(DateTime, nullable=True)
    pinned_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    edited_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    task = relationship("Task", back_populates="comments")
    user = relationship("User", foreign_keys=[user_id], back_populates="comments")
    parent_comment = relationship("TaskComment", remote_side=[id], back_populates="replies")
    replies = relationship("TaskComment", back_populates="parent_comment", cascade="all, delete-orphan")
    pinned_by_user = relationship("User", foreign_keys=[pinned_by_user_id])
    
    # Media attachments relationship
    media_attachments = relationship("CommentMediaAttachment", back_populates="comment", cascade="all, delete-orphan")
    
    # Reactions relationship
    reactions = relationship("CommentReaction", back_populates="comment", cascade="all, delete-orphan")
    
    # Mentions relationship
    mentions = relationship("CommentMention", back_populates="comment", cascade="all, delete-orphan")
    
    # Audit trail relationship
    audit_trail = relationship("CommentAuditTrail", back_populates="comment", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<TaskComment(id={self.id}, task_id={self.task_id}, user_id={self.user_id})>"

    @property
    def reply_count(self) -> int:
        """Get the number of replies to this comment."""
        return len(self.replies) if self.replies else 0

    @property
    def mentioned_users(self) -> List["User"]:
        """Get list of users mentioned in this comment."""
        return [mention.mentioned_user for mention in self.mentions] if self.mentions else []

    def can_be_edited_by(self, user_id: int) -> bool:
        """Check if a user can edit this comment."""
        return self.user_id == user_id and not self.is_system_generated

    def can_be_deleted_by(self, user_id: int) -> bool:
        """Check if a user can delete this comment."""
        return self.user_id == user_id and not self.is_system_generated

    def can_be_pinned_by(self, user_id: int) -> bool:
        """Check if a user can pin this comment."""
        # Only task creator or assignee can pin comments
        return (self.task.created_by_id == user_id or 
                self.task.assigned_to_id == user_id)


class CommentReaction(Base):
    """
    Comment reaction model.
    """
    __tablename__ = "comment_reactions"

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("task_comments.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reaction = Column(String(50), nullable=False)  # emoji or reaction type
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    comment = relationship("TaskComment", back_populates="reactions")
    user = relationship("User", back_populates="comment_reactions")

    def __repr__(self):
        return f"<CommentReaction(id={self.id}, comment_id={self.comment_id}, reaction={self.reaction})>"


class CommentMention(Base):
    """
    Comment mention model for @username functionality.
    """
    __tablename__ = "comment_mentions"

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("task_comments.id"), nullable=False, index=True)
    mentioned_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    mentioned_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    comment = relationship("TaskComment", back_populates="mentions")
    mentioned_user = relationship("User", foreign_keys=[mentioned_user_id], back_populates="comment_mentions_received")
    mentioned_by_user = relationship("User", foreign_keys=[mentioned_by_user_id], back_populates="comment_mentions_made")

    def __repr__(self):
        return f"<CommentMention(id={self.id}, comment_id={self.comment_id}, mentioned_user_id={self.mentioned_user_id})>"


class CommentMediaAttachment(Base):
    """
    Comment media attachment model.
    """
    __tablename__ = "comment_media_attachments"

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("task_comments.id"), nullable=False, index=True)
    media_id = Column(Integer, ForeignKey("media_attachments.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    comment = relationship("TaskComment", back_populates="media_attachments")
    media = relationship("MediaAttachment", back_populates="comment_attachments")

    def __repr__(self):
        return f"<CommentMediaAttachment(id={self.id}, comment_id={self.comment_id}, media_id={self.media_id})>"
