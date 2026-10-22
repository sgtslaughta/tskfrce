"""Per-instance chore extras: ordered subtasks and proof photos."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import backref, relationship

from app.core.database import Base


class ChoreSubtask(Base):
    __tablename__ = "chore_subtasks"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)
    position = Column(Integer, nullable=False, default=0)
    title = Column(String(100), nullable=False)
    done_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    done_at = Column(DateTime, nullable=True)

    task = relationship(
        "Task",
        backref=backref(
            "chore_subtasks", order_by="ChoreSubtask.position", cascade="all, delete-orphan"
        ),
    )


class ChorePhoto(Base):
    __tablename__ = "chore_photos"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True, index=True)  # legacy
    run_id = Column(Integer, ForeignKey("chore_runs.id"), nullable=True, index=True)
    attempt = Column(Integer, nullable=False, default=1)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    path = Column(String(255), nullable=False)
    thumb_path = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", backref=backref("chore_photos", cascade="all, delete-orphan"))
    run = relationship("ChoreRun", backref=backref("photos", cascade="all, delete-orphan"))
