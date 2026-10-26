"""Write notifications in the caller's transaction (no commit here)."""

from sqlalchemy.orm import Session

from app.models.inbox import Notification
from app.models.user import User, UserRole

KID_KINDS = frozenset(
    {
        "chore_new",
        "due_soon",
        "missed_deadline",
        "chore_approved",
        "chore_sent_back",
        "points_taken",
        "lock_warning",
        "chat_message",
        "redemption_decided",
        "badge_earned",
        "level_up",
    }
)


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
    dedup_key: str | None = None,
) -> int:
    """Add one row per recipient; returns rows added (dedup_key skips existing)."""
    n = 0
    for uid in user_ids:
        if dedup_key and (
            db.query(Notification.id).filter_by(user_id=uid, dedup_key=dedup_key).first()
        ):
            continue
        n += 1
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
                dedup_key=dedup_key,
            )
        )
        db.flush()
    return n
