"""
Notification database model for TaaskMaaster.

This module contains the SQLAlchemy model for storing user notifications
in the database, enabling offline notification delivery.
"""

from datetime import datetime
from typing import Dict, Any

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.core.database import Base


class Notification(Base):
    """
    Notification model for storing user notifications.
    
    This model stores notifications that can be delivered to users
    both in real-time (via WebSocket) and when they return online.
    """
    
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    action_url = Column(String(500), nullable=True)
    data = Column(JSON, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    read_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="notifications")

    def __repr__(self) -> str:
        """String representation of notification."""
        return f"<Notification(id={self.id}, user_id={self.user_id}, type='{self.type}', is_read={self.is_read})>"

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert notification to dictionary format.
        
        Returns:
            Dictionary representation of the notification
        """
        return {
            "id": self.id,
            "user_id": self.user_id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "action_url": self.action_url,
            "data": self.data,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None,
        }
