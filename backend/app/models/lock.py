"""Lock models: devices, groups, time windows, overrides."""

from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
)
from sqlalchemy.orm import relationship, validates

from app.core.database import Base

device_owners = Table(
    "device_owners",
    Base.metadata,
    Column("device_id", ForeignKey("devices.id"), primary_key=True),
    Column("user_id", ForeignKey("users.id"), primary_key=True),
)

device_group_members = Table(
    "device_group_members",
    Base.metadata,
    Column("device_id", ForeignKey("devices.id"), primary_key=True),
    Column("group_id", ForeignKey("device_groups.id"), primary_key=True),
)


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (
        CheckConstraint("status IN ('unassigned','assigned','guest')", name="ck_device_status"),
    )

    id = Column(Integer, primary_key=True)
    mac = Column(String(17), nullable=False, unique=True, index=True)
    name = Column(String(100), nullable=False)
    vendor = Column(String(100), nullable=True)
    hostname = Column(String(255), nullable=True)
    ip = Column(String(45), nullable=True)
    ipv6 = Column(JSON, nullable=True)
    status = Column(String(20), nullable=False, default="unassigned")
    first_seen = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_seen = Column(DateTime, nullable=True)

    owners = relationship("User", secondary=device_owners, backref="devices")
    groups = relationship("DeviceGroup", secondary=device_group_members, backref="devices")

    @validates("mac")
    def _lower_mac(self, _key, value):
        return value.lower()


class DeviceGroup(Base):
    __tablename__ = "device_groups"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)


class TimeWindow(Base):
    __tablename__ = "time_windows"
    __table_args__ = (
        CheckConstraint("kind IN ('allowed','free')", name="ck_window_kind"),
        CheckConstraint("(kid_id IS NULL) != (group_id IS NULL)", name="ck_window_one_target"),
    )

    id = Column(Integer, primary_key=True)
    kind = Column(String(10), nullable=False)
    days = Column(String(7), nullable=False)  # digits 0=Mon..6=Sun
    start = Column(String(5), nullable=False)  # HH:MM
    end = Column(String(5), nullable=False)  # HH:MM
    kid_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    group_id = Column(Integer, ForeignKey("device_groups.id"), nullable=True)


class Override(Base):
    __tablename__ = "overrides"
    __table_args__ = (
        CheckConstraint("action IN ('lock','unlock')", name="ck_override_action"),
        CheckConstraint("source IN ('manual','bonus')", name="ck_override_source"),
    )

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    action = Column(String(10), nullable=False)
    source = Column(String(10), nullable=False)
    expires_at = Column(DateTime, nullable=True)  # UTC
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
