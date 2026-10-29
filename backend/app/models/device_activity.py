"""Device activity: alert/history events and 10-minute presence slots."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)

from app.core.database import Base

KINDS = (
    "bypass",
    "new_address",
    "outside_hours",
    "locked_try",
    "left_wifi",
    "sign_in",
    "address_change",
    "locked",
    "unlocked",
)
ALERT_KINDS = KINDS[:6]
FILTERS = {
    "bypass": ("bypass", "new_address"),
    "locked": ("locked_try", "outside_hours", "left_wifi"),
    "sign_in": ("sign_in",),
}


class DeviceEvent(Base):
    __tablename__ = "device_events"
    __table_args__ = (
        CheckConstraint(
            "kind IN (" + ",".join(f"'{k}'" for k in KINDS) + ")", name="ck_device_event_kind"
        ),
    )

    id = Column(Integer, primary_key=True)
    device_id = Column(
        Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind = Column(String(16), nullable=False)
    at = Column(DateTime, nullable=False, index=True)  # naive UTC
    last_at = Column(DateTime, nullable=True)
    count = Column(Integer, nullable=False, default=1, server_default="1")
    reason = Column(String(16), nullable=True)
    kid_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    other_device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    minutes = Column(Integer, nullable=True)
    detail = Column(String(120), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)


class DevicePresence(Base):
    __tablename__ = "device_presence"

    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True)
    slot = Column(DateTime, primary_key=True)  # naive UTC, 10-minute slot start
    locked = Column(Boolean, nullable=False, default=False, server_default="0")
