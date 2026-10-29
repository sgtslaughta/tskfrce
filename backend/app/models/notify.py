"""Apprise notification places and pings held for quiet hours."""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from app.core.database import Base


class NotifyPlace(Base):
    __tablename__ = "notify_places"

    id = Column(Integer, primary_key=True)
    name = Column(String(60), nullable=False)
    url_enc = Column(Text, nullable=False)  # sealed Apprise URL
    url_mask = Column(String(80), nullable=False)
    enabled = Column(Boolean, nullable=False, default=True, server_default="1")
    events = Column(String(200), nullable=False)  # comma-separated event keys
    created_at = Column(DateTime, default=datetime.utcnow)


class NotifyHeld(Base):
    __tablename__ = "notify_held"

    id = Column(Integer, primary_key=True)
    place_id = Column(
        Integer, ForeignKey("notify_places.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title = Column(String(120), nullable=False)
    body = Column(String(300), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
