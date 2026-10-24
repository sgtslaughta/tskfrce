"""One-time password reset links. Only the sha256 of the token is stored."""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.core.database import Base


class PasswordReset(Base):
    __tablename__ = "password_resets"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash = Column(String(64), unique=True, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
