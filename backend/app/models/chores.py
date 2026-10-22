"""Chore library: chores -> assignments -> runs (what / who+when / one day's work)."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base

assignment_kids = Table(
    "assignment_kids",
    Base.metadata,
    Column(
        "assignment_id",
        Integer,
        ForeignKey("chore_assignments.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("kid_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)

run_kids = Table(
    "run_kids",
    Base.metadata,
    Column("run_id", Integer, ForeignKey("chore_runs.id", ondelete="CASCADE"), primary_key=True),
    Column("kid_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Chore(Base):
    __tablename__ = "chores"
    __table_args__ = (CheckConstraint("points >= 0", name="ck_chore_points"),)

    id = Column(Integer, primary_key=True)
    title = Column(String(100), nullable=False)
    points = Column(Integer, nullable=False, default=10)
    needs_photo = Column(Boolean, nullable=False, default=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    archived_at = Column(DateTime, nullable=True)

    steps = relationship(
        "ChoreStep",
        order_by="ChoreStep.position",
        cascade="all, delete-orphan",
        back_populates="chore",
    )
    assignments = relationship(
        "ChoreAssignment", cascade="all, delete-orphan", back_populates="chore"
    )


class ChoreStep(Base):
    __tablename__ = "chore_steps"
    __table_args__ = (UniqueConstraint("chore_id", "position", name="uq_chore_step_pos"),)

    id = Column(Integer, primary_key=True)
    chore_id = Column(Integer, ForeignKey("chores.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, nullable=False, default=0)
    title = Column(String(100), nullable=False)

    chore = relationship("Chore", back_populates="steps")


class ChoreAssignment(Base):
    __tablename__ = "chore_assignments"
    __table_args__ = (
        CheckConstraint("mode IN ('each','race','team')", name="ck_assignment_mode"),
        CheckConstraint("repeat IN ('daily','weekly','once')", name="ck_assignment_repeat"),
        CheckConstraint("repeat != 'weekly' OR days IS NOT NULL", name="ck_assignment_days"),
        CheckConstraint("repeat != 'once' OR on_date IS NOT NULL", name="ck_assignment_on_date"),
    )

    id = Column(Integer, primary_key=True)
    chore_id = Column(Integer, ForeignKey("chores.id"), nullable=False, index=True)
    mode = Column(String(4), nullable=False, default="each")
    repeat = Column(String(6), nullable=False)
    days = Column(String(7), nullable=True)  # digits, 0=Mon (same format as time_windows)
    on_date = Column(Date, nullable=True)
    due_time = Column(String(5), nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    chore = relationship("Chore", back_populates="assignments")
    kids = relationship("User", secondary=assignment_kids)


class ChoreRun(Base):
    __tablename__ = "chore_runs"
    __table_args__ = (
        CheckConstraint("status IN ('todo','submitted','done','cancelled')", name="ck_run_status"),
        Index(
            "uq_run_kid_day",
            "assignment_id",
            "day",
            "kid_id",
            unique=True,
            sqlite_where=text("kid_id IS NOT NULL"),
        ),
        Index(
            "uq_run_shared_day",
            "assignment_id",
            "day",
            unique=True,
            sqlite_where=text("kid_id IS NULL"),
        ),
    )

    id = Column(Integer, primary_key=True)
    assignment_id = Column(Integer, ForeignKey("chore_assignments.id"), nullable=False, index=True)
    day = Column(Date, nullable=False, index=True)
    kid_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # NULL = shared
    status = Column(String(10), nullable=False, default="todo", index=True)
    attempt = Column(Integer, nullable=False, default=1)
    last_note = Column(String(500), nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    submitted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    assignment = relationship("ChoreAssignment")
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    kids = relationship("User", secondary=run_kids)
    ticks = relationship("RunStepTick", cascade="all, delete-orphan")


class RunStepTick(Base):
    __tablename__ = "run_step_ticks"

    run_id = Column(Integer, ForeignKey("chore_runs.id", ondelete="CASCADE"), primary_key=True)
    step_id = Column(Integer, ForeignKey("chore_steps.id", ondelete="CASCADE"), primary_key=True)
    done_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    done_at = Column(DateTime, nullable=True)
