"""Write notifications in the caller's transaction (no commit here)."""

from sqlalchemy.orm import Session

from app.models.inbox import Notification
from app.models.user import User, UserRole
from app.services import notify as _notify


def is_pending_note(run) -> bool:
    """A kid note still waiting on a parent (the one definition, bell and Today)."""
    return run.note_label is not None and run.status == "todo"


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
    from app.services import push  # lazy: push imports inbox

    n = 0
    for uid in user_ids:
        if dedup_key and (
            db.query(Notification.id).filter_by(user_id=uid, dedup_key=dedup_key).first()
        ):
            continue
        n += 1
        row = Notification(
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
        db.add(row)
        db.flush()
        push.queue(db, uid, kind, title, body, row=row)
    return n


def path_for(kind: str, *, run_id=None, redemption_id=None, device_id=None) -> str:
    if device_id is not None:
        return f"/devices?item={device_id}"
    if run_id is not None:
        return f"/?chore={run_id}"
    if kind == "redemption_request":
        return "/?tab=needs"
    if kind == "redemption_decided":
        return "/kids?section=rewards&item=history"
    return "/devices" if kind == "box_offline" else "/"


def notify_parents(
    db: Session,
    kind: str,
    title: str,
    body: str | None = None,
    *,
    run_id: int | None = None,
    redemption_id: int | None = None,
    device_id: int | None = None,
    thread_id: int | None = None,
) -> None:
    """Bell rows for every parent, plus the Apprise ping (leaves after commit)."""
    refs = dict(run_id=run_id, redemption_id=redemption_id, device_id=device_id)
    notify(db, parents(db), kind, title, body, thread_id=thread_id, **refs)
    if kind in _notify.KIND_EVENT:
        _notify.ping(db, _notify.KIND_EVENT[kind], title[:120], body, path_for(kind, **refs))
