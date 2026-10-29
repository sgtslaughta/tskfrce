"""Equipped flair: one row per kid per slot."""

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, String

from app.core.database import Base


class KidFlair(Base):
    __tablename__ = "kid_flair"
    __table_args__ = (
        CheckConstraint("slot IN ('card','ring','name','emblem','title')", name="ck_flair_slot"),
    )

    kid_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    slot = Column(String(10), primary_key=True)
    item_id = Column(String(40), nullable=False)
