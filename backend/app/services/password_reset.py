"""Create and redeem one-time password reset links (30 min, single use, hash-only storage)."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.auth import AuthService
from app.models.password_reset import PasswordReset
from app.models.user import User, UserRole

RESET_TTL = timedelta(minutes=30)
EXPIRED = "That reset link has expired. Ask for a new one."


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)  # DB columns are naive UTC


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_reset(db: Session, user: User, created_by: User | None) -> str:
    """Void the user's older unused links, store a new one, return the raw token."""
    now = _now()
    for old in (
        db.query(PasswordReset)
        .filter(PasswordReset.user_id == user.id, PasswordReset.used_at.is_(None))
        .all()
    ):
        old.used_at = now
    token = secrets.token_urlsafe(32)
    db.add(
        PasswordReset(
            user_id=user.id,
            token_hash=_hash(token),
            created_by_id=created_by.id if created_by else None,
            expires_at=now + RESET_TTL,
        )
    )
    db.commit()
    return token


def redeem_reset(db: Session, token: str, password: str) -> bool:
    """Set the new password if the token is valid; False if bad, expired or used."""
    row = db.query(PasswordReset).filter(PasswordReset.token_hash == _hash(token)).first()
    now = _now()
    if row is None or row.used_at is not None or row.expires_at <= now:
        return False
    user = db.get(User, row.user_id)
    if user is None or user.role != UserRole.PARENT or not user.is_active:
        return False
    user.hashed_password = AuthService(db).get_password_hash(password)
    row.used_at = now
    db.commit()
    return True
