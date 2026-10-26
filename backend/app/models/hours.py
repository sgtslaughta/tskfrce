"""Named hour rules: when a kid's or group's devices may be online."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class HourRule(Base):
    __tablename__ = "hour_rules"
    __table_args__ = (
        CheckConstraint(
            "category IN ('holiday','summer','weekend','school_night','other')",
            name="ck_rule_category",
        ),
        CheckConstraint("kind IN ('allowed','free','off')", name="ck_rule_kind"),
    )

    id = Column(Integer, primary_key=True)
    name = Column(String(60), nullable=False)
    category = Column(String(14), nullable=False, default="other")
    kind = Column(String(10), nullable=False)
    days = Column(String(7), nullable=False)  # digits 0=Mon..6=Sun
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    everyone = Column(Boolean, nullable=False, default=False, server_default="0")

    times = relationship(
        "HourRuleTime",
        order_by="HourRuleTime.start",
        cascade="all, delete-orphan",
    )
    targets = relationship("HourRuleTarget", cascade="all, delete-orphan")

    @property
    def kid_ids(self) -> list[int]:
        return [t.kid_id for t in self.targets if t.kid_id is not None]

    @property
    def group_ids(self) -> list[int]:
        return [t.group_id for t in self.targets if t.group_id is not None]


class HourRuleTime(Base):
    __tablename__ = "hour_rule_times"

    id = Column(Integer, primary_key=True)
    rule_id = Column(Integer, ForeignKey("hour_rules.id", ondelete="CASCADE"), nullable=False)
    start = Column(String(5), nullable=False)  # HH:MM
    end = Column(String(5), nullable=False)  # HH:MM


class HourRuleTarget(Base):
    __tablename__ = "hour_rule_targets"
    __table_args__ = (
        CheckConstraint("(kid_id IS NULL) != (group_id IS NULL)", name="ck_rule_target_one"),
        UniqueConstraint("rule_id", "kid_id", "group_id", name="uq_rule_target"),
    )

    id = Column(Integer, primary_key=True)
    rule_id = Column(Integer, ForeignKey("hour_rules.id", ondelete="CASCADE"), nullable=False)
    kid_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    group_id = Column(Integer, ForeignKey("device_groups.id", ondelete="CASCADE"), nullable=True)
