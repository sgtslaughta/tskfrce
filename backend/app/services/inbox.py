"""Write notifications in the caller's transaction (no commit here)."""

from sqlalchemy.orm import Session

from app.models.inbox import Notification
from app.models.user import User, UserRole


def parents(db: Session) -> list[int]:
    return [
        i for (i,) in db.query(User.id).filter(User.role == UserRole.PARENT, User.is_active).all()
    ]


def notify(
    db: Session,
    user_ids: list[int],
    kind: str,
    title: str,
    body: str | None = None,
    *,
    run_id: int | None = None,
    redemption_id: int | None = None,
    device_id: int | None = None,
    thread_id: int | None = None,
) -> None:
    for uid in user_ids:
        db.add(
            Notification(
                user_id=uid,
                kind=kind,
                title=title[:120],
                body=body[:300] if body else None,
                run_id=run_id,
                redemption_id=redemption_id,
                device_id=device_id,
                thread_id=thread_id,
            )
        )
