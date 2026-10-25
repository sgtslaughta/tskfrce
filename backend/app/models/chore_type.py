"""Chore types (Cleaning, Pets, ...) and the quick-note presets kids can send."""

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class ChoreType(Base):
    __tablename__ = "chore_types"

    id = Column(Integer, primary_key=True)
    name = Column(String(40), nullable=False)
    glyph = Column(String(40), nullable=False)
    builtin = Column(Boolean, nullable=False, default=False)
    position = Column(Integer, nullable=False, default=0)

    notes = relationship(
        "ChoreTypeNote",
        order_by="ChoreTypeNote.position",
        cascade="all, delete-orphan",
        back_populates="type",
    )


class ChoreTypeNote(Base):
    __tablename__ = "chore_type_notes"

    id = Column(Integer, primary_key=True)
    type_id = Column(
        Integer, ForeignKey("chore_types.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label = Column(String(40), nullable=False)
    glyph = Column(String(40), nullable=False)
    position = Column(Integer, nullable=False, default=0)

    type = relationship("ChoreType", back_populates="notes")
