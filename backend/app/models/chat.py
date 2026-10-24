"""Chat: one thread per chore instance, one private thread per kid, one family thread."""

from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import backref, relationship

from app.core.database import Base


class Thread(Base):
    __tablename__ = "threads"
    __table_args__ = (
        CheckConstraint(
            "(kind = 'chore' AND run_id IS NOT NULL) OR (kind = 'private' AND kid_id IS NOT NULL)"
            " OR kind = 'family'",
            name="ck_thread_kind",
        ),
    )

    id = Column(Integer, primary_key=True)
    kind = Column(String(10), nullable=False, index=True)  # chore | private | family
    run_id = Column(Integer, ForeignKey("chore_runs.id"), nullable=True, index=True)
    kid_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    run = relationship("ChoreRun", backref=backref("threads", cascade="all, delete-orphan"))
    messages = relationship("ThreadMessage", cascade="all, delete-orphan")
    photos = relationship("ChatPhoto", cascade="all, delete-orphan")


class ThreadMessage(Base):
    __tablename__ = "thread_messages"
    __table_args__ = (CheckConstraint("kind IN ('user','system')", name="ck_message_kind"),)

    id = Column(Integer, primary_key=True)
    thread_id = Column(Integer, ForeignKey("threads.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # NULL = system
    kind = Column(String(10), nullable=False, default="user")  # user | system
    body = Column(Text, nullable=True)
    # chore threads: chore_photos.id; private/family threads: chat_photos.id
    photo_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    author = relationship("User", foreign_keys=[author_id])


class ThreadRead(Base):
    __tablename__ = "thread_reads"

    thread_id = Column(Integer, ForeignKey("threads.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    last_read_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class ChatPhoto(Base):
    """Photos posted in private/family threads (chore threads use chore_photos)."""

    __tablename__ = "chat_photos"

    id = Column(Integer, primary_key=True)
    thread_id = Column(Integer, ForeignKey("threads.id"), nullable=False, index=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    path = Column(String(255), nullable=False)
    thumb_path = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
