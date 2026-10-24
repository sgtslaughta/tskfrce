"""Per-run chore proof photos."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import backref, relationship

from app.core.database import Base


class ChorePhoto(Base):
    __tablename__ = "chore_photos"

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("chore_runs.id"), nullable=True, index=True)
    attempt = Column(Integer, nullable=False, default=1)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    path = Column(String(255), nullable=False)
    thumb_path = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    run = relationship("ChoreRun", backref=backref("photos", cascade="all, delete-orphan"))
