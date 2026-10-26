"""Kid-facing alerts for parent actions. Writes in the caller's transaction (no commit)."""

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.chat import Thread
from app.models.chores import ChoreAssignment, ChoreRun
from app.models.points import Points
from app.models.user import User, UserRole
from app.services import chores as svc
from app.services import inbox


def chore_decided(db: Session, run: ChoreRun, approved: bool, note: str | None = None) -> None:
    title = svc.chore_of(run).title
    if not approved:
        inbox.notify(
            db,
            svc.run_kid_ids(run),
            "chore_sent_back",
            f"{title} was sent back",
            note or "Take another look.",
            run_id=run.id,
        )
        return
    for kid_id in svc.run_kid_ids(run):
        pts = (
            db.query(func.coalesce(func.sum(Points.amount), 0))
            .filter(Points.run_id == run.id, Points.user_id == kid_id, Points.amount > 0)
            .scalar()
        )
        inbox.notify(
            db, [kid_id], "chore_approved", f"{title} approved", f"+{pts} points", run_id=run.id
        )


def chore_new(db: Session, assignment: ChoreAssignment) -> None:
    body = None
    if assignment.due_time:
        h, m = map(int, assignment.due_time.split(":"))
        body = f"Due {h % 12 or 12}:{m:02d} {'AM' if h < 12 else 'PM'}"
    inbox.notify(
        db,
        [k.id for k in assignment.kids],
        "chore_new",
        f"New chore: {assignment.chore.title}",
        body,
    )


def points_taken(db: Session, kid_id: int, amount: int, note: str, by_id: int) -> None:
    by = db.get(User, by_id)
    inbox.notify(
        db,
        [kid_id],
        "points_taken",
        f"{by.full_name if by else 'A parent'} took {amount} points",
        note,
    )


def parent_reply(db: Session, thread: Thread, author: User | None, body: str | None) -> None:
    if author is None or author.role != UserRole.PARENT:
        return
    text = (body or "")[:120] or "Sent a photo"
    if thread.kind == "chore":
        run = db.get(ChoreRun, thread.run_id)
        if run:
            title = f"{author.full_name} replied on {svc.chore_of(run).title}"
            inbox.notify(
                db,
                svc.run_kid_ids(run),
                "chat_message",
                title,
                text,
                run_id=run.id,
                thread_id=thread.id,
            )
    elif thread.kind == "private":
        inbox.notify(
            db,
            [thread.kid_id],
            "chat_message",
            f"{author.full_name} sent you a message",
            text,
            thread_id=thread.id,
        )
