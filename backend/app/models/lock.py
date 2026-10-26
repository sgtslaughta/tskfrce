"""Lock models: devices, groups, time windows, overrides."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
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
    status = Column(String(20), nullable=False, default="unassigned")
    first_seen = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_seen = Column(DateTime, nullable=True)
    resisting_since = Column(DateTime, nullable=True)
    blocked_since = Column(DateTime, nullable=True)
    exempt = Column(Boolean, nullable=False, default=False, server_default="0")  # never locked

    ipv6_rows = relationship("DeviceIPv6", cascade="all, delete-orphan")
    owners = relationship("User", secondary=device_owners, backref="devices")
    groups = relationship("DeviceGroup", secondary=device_group_members, backref="devices")

    @property
    def ipv6(self) -> list[str]:
        return [r.address for r in self.ipv6_rows]

    @ipv6.setter
    def ipv6(self, addresses) -> None:
        want = list(dict.fromkeys(addresses or []))
        self.ipv6_rows = [r for r in self.ipv6_rows if r.address in want] + [
            DeviceIPv6(address=a) for a in want if a not in self.ipv6
        ]

    @validates("mac")
    def _lower_mac(self, _key, value):
        return value.lower()


class DeviceIPv6(Base):
    __tablename__ = "device_ipv6"

    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True)
    address = Column(String(45), primary_key=True)


class DeviceGroup(Base):
    __tablename__ = "device_groups"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    icon = Column(String(40), nullable=False, default="devices", server_default="devices")
    chore_lock = Column(Boolean, nullable=False, default=True, server_default="1")


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
