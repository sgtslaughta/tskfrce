"""Manual lock/unlock overrides on devices."""

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.lock import Override


def clear_override(db: Session, device_ids: list[int]) -> None:
    """Drop manual overrides on these devices. Caller commits."""
    if device_ids:
        db.query(Override).filter(
            Override.device_id.in_(device_ids), Override.source == "manual"
        ).delete(synchronize_session=False)


def set_override(
    db: Session, device_ids: list[int], action: str, minutes: int | None, user_id: int
) -> None:
    """Replace manual overrides on these devices. Caller commits."""
    clear_override(db, device_ids)
    now = datetime.now(UTC).replace(tzinfo=None)
    expires = now + timedelta(minutes=minutes) if minutes else None
    for did in device_ids:
        db.add(
            Override(
                device_id=did,
                action=action,
                source="manual",
                expires_at=expires,
                created_at=now,
                created_by_id=user_id,
            )
        )
