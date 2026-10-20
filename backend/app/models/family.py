"""Family settings (single row, id=1)."""

from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String
from sqlalchemy.orm import Session

from app.core.database import Base


class FamilySettings(Base):
    __tablename__ = "family_settings"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, default="My Family")
    timezone = Column(String(50), nullable=False, default="UTC")
    reset_time = Column(String(5), nullable=False, default="06:00")
    new_devices_blocked = Column(Boolean, nullable=False, default=True)
    points_unlock_early = Column(Boolean, nullable=False, default=False)
    last_reset_date = Column(Date, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)


def get_family(db: Session) -> FamilySettings:
    """Return the family row, creating it if missing."""
    fam = db.get(FamilySettings, 1)
    if fam is None:
        fam = FamilySettings(id=1, name="My Family")
        db.add(fam)
        db.commit()
        db.refresh(fam)
    return fam
