"""Per-kid screen-time purchase limits."""

from sqlalchemy import Column, ForeignKey, Integer

from app.core.database import Base


class ScreenTimeLimit(Base):
    __tablename__ = "screen_time_limits"

    kid_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    max_minutes = Column(Integer, nullable=True)
    min_points = Column(Integer, nullable=True)
