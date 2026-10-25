"""Chat threads: lazy creation, access rules, posting and unread counts."""

from datetime import datetime

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.chat import ChatPhoto, MessageReaction, Thread, ThreadMessage, ThreadRead
from app.models.chores import ChoreAssignment, ChoreRun
from app.models.user import User, UserRole
from app.schemas.lock import utc_z
from app.services.chores import chore_of, clear_note, kid_runs_filter, run_kid_ids


def _target_ok(db: Session, user: User, kind: str, run_id: int | None, kid_id: int | None) -> bool:
    """Does the target exist, and may `user` see it?"""
    parent = user.role == UserRole.PARENT
    if kind == "family":
        return True
    if kind == "private":
        if parent:
            return (
                db.query(User.id).filter(User.id == kid_id, User.role == UserRole.KID).first()
                is not None
            )
        return kid_id == user.id
    if kind == "chore":
        q = db.query(ChoreRun.id).filter(ChoreRun.id == run_id)
        if not parent:
            q = q.filter(kid_runs_filter(user.id))
        return q.first() is not None
    return False


def can_access(db: Session, user: User, thread: Thread) -> bool:
    return _target_ok(db, user, thread.kind, thread.run_id, thread.kid_id)


def find(
    db: Session, kind: str, *, run_id: int | None = None, kid_id: int | None = None
) -> Thread | None:
    q = db.query(Thread).filter(Thread.kind == kind)
    if kind == "chore":
        q = q.filter(Thread.run_id == run_id)
    elif kind == "private":
        q = q.filter(Thread.kid_id == kid_id)
    return q.first()


def thread_for(
    db: Session, kind: str, *, run_id: int | None = None, kid_id: int | None = None
) -> Thread:
    """Get or create. Flushes, never commits."""
    t = find(db, kind, run_id=run_id, kid_id=kid_id)
    if t is None:
        t = Thread(kind=kind, run_id=run_id, kid_id=kid_id)
        db.add(t)
        db.flush()
    return t


def resolve(db: Session, user: User, kind: str, ref: str) -> Thread | None:
    """Thread for a URL (kind + ref) if it exists and the user may see it, else None."""
    run_id = kid_id = None
    if kind in ("chore", "private"):
        if not ref.isdigit():
            return None
        run_id, kid_id = (int(ref), None) if kind == "chore" else (None, int(ref))
    elif kind != "family" or ref != "family":
        return None
    if not _target_ok(db, user, kind, run_id, kid_id):
        return None
    return thread_for(db, kind, run_id=run_id, kid_id=kid_id)


def post(
    db: Session,
    thread: Thread,
    author: User | None,
    body: str | None,
    photo_id: int | None = None,
    kind: str = "user",
    note_label: str | None = None,
    step_id: int | None = None,
) -> ThreadMessage:
    """Add a message. Flushes, never commits. A parent's chore-thread message clears the note."""
    m = ThreadMessage(
        thread_id=thread.id,
        author_id=author.id if author else None,
        kind=kind,
        body=body,
        photo_id=photo_id,
        note_label=note_label,
        step_id=step_id,
    )
    db.add(m)
    if author and author.role == UserRole.PARENT and thread.kind == "chore":
        run = db.get(ChoreRun, thread.run_id)
        if run:
            clear_note(run)
    db.flush()
    return m


def resync_note(db: Session, thread: Thread) -> None:
    """After a note message is deleted: flag the run from the latest remaining note, else clear."""
    run = db.get(ChoreRun, thread.run_id) if thread.kind == "chore" else None
    if run is None:
        return
    last = (
        db.query(ThreadMessage)
        .filter(ThreadMessage.thread_id == thread.id, ThreadMessage.note_label.isnot(None))
        .order_by(ThreadMessage.id.desc())
        .first()
    )
    if last is None:
        clear_note(run)
    else:
        run.note_label, run.note_at = last.note_label, last.created_at


def system(db: Session, run: ChoreRun, body: str, photo_id: int | None = None) -> None:
    """System line in the run's thread; `photo_id` is a ChorePhoto (proof)."""
    post(db, thread_for(db, "chore", run_id=run.id), None, body, photo_id, kind="system")


def step_ok(db: Session, thread: Thread, step_id: int) -> bool:
    """A step of the chore this chore thread is about."""
    run = db.get(ChoreRun, thread.run_id) if thread.kind == "chore" else None
    return run is not None and any(s.id == step_id for s in chore_of(run).steps)


def photo_ok(db: Session, thread: Thread, photo_id: int) -> bool:
    # People attach chat photos only. Proof photos enter a chore thread solely
    # through system messages, so chat can never add or alter proof.
    return (
        db.query(ChatPhoto.id)
        .filter(ChatPhoto.id == photo_id, ChatPhoto.thread_id == thread.id)
        .first()
        is not None
    )


def photo_url(thread: Thread, msg: ThreadMessage) -> str | None:
    if msg.photo_id is None:
        return None
    proof = thread.kind == "chore" and msg.kind == "system"
    base = "chore-photos" if proof else "chat/photos"
    return f"/api/v1/{base}/{msg.photo_id}"


def mark_read(db: Session, thread: Thread, user: User) -> None:
    r = db.get(ThreadRead, (thread.id, user.id))
    now = datetime.utcnow()
    if r is None:
        db.add(ThreadRead(thread_id=thread.id, user_id=user.id, last_read_at=now))
    else:
        r.last_read_at = now


def _title(
    db: Session, t: Thread, names: dict[int, str], chores: dict[int, str] | None = None
) -> str:
    if t.kind == "family":
        return "Family"
    if t.kind == "private":
        return names.get(t.kid_id, "Kid")
    if chores is not None:
        return chores.get(t.run_id, "Chore")
    run = db.get(ChoreRun, t.run_id)
    return run.assignment.chore.title if run else "Chore"


def _ensure_private(db: Session, kid_ids: list[int]) -> None:
    """Create any missing private threads (one lookup for all kids). Flushes, never commits."""
    have = {r[0] for r in db.query(Thread.kid_id).filter(Thread.kind == "private")}
    for i in kid_ids:
        if i not in have:
            db.add(Thread(kind="private", kid_id=i))
    db.flush()


def title(db: Session, t: Thread) -> str:
    kid = db.get(User, t.kid_id) if t.kind == "private" else None
    return _title(db, t, {kid.id: kid.full_name or kid.username} if kid else {})


def who(db: Session, t: Thread) -> str | None:
    """Kids a chore thread is about ("Bobby", "Bobby & Susan"); None for other threads."""
    run = db.get(ChoreRun, t.run_id) if t.kind == "chore" else None
    if run is None:
        return None
    kids = db.query(User).filter(User.id.in_(run_kid_ids(run))).order_by(User.id)
    return " & ".join(k.full_name or k.username for k in kids) or None


def _preview(m: ThreadMessage | None) -> dict:
    """Newest message of a thread for list rows: when, who, and a one-line text."""
    if m is None:
        return {"last_message_at": None, "last_author": None, "last_text": None}
    who = (
        None
        if m.kind == "system"
        else (m.author.full_name or m.author.username if m.author else None)
    )
    return {
        "last_message_at": utc_z(m.created_at),
        "last_author": who,
        "last_text": (m.body or "").strip()[:140]
        or m.note_label
        or ("Photo" if m.photo_id else None),
    }


def unread(db: Session, user: User) -> dict:
    """Threads the user can see (with messages, plus family/private) and unread counts."""
    parent = user.role == UserRole.PARENT
    thread_for(db, "family")
    kids = db.query(User).filter(User.role == UserRole.KID).all() if parent else [user]
    _ensure_private(db, [k.id for k in kids])
    names = {k.id: k.full_name or k.username for k in kids}
    has_msgs = db.query(ThreadMessage.thread_id).filter(ThreadMessage.thread_id == Thread.id)
    q = db.query(Thread).filter(or_(Thread.kind != "chore", has_msgs.exists()))
    if not parent:
        q = q.filter(
            or_(
                Thread.kind == "family",
                (Thread.kind == "private") & (Thread.kid_id == user.id),
                (Thread.kind == "chore")
                & Thread.run_id.in_(db.query(ChoreRun.id).filter(kid_runs_filter(user.id))),
            )
        )
    threads = q.order_by(Thread.id).all()
    counts = dict(
        db.query(ThreadMessage.thread_id, func.count(ThreadMessage.id))
        .outerjoin(
            ThreadRead,
            (ThreadRead.thread_id == ThreadMessage.thread_id) & (ThreadRead.user_id == user.id),
        )
        .filter(
            or_(
                ThreadRead.last_read_at.is_(None),
                ThreadMessage.created_at > ThreadRead.last_read_at,
            ),
            or_(ThreadMessage.author_id.is_(None), ThreadMessage.author_id != user.id),
        )
        .group_by(ThreadMessage.thread_id)
        .all()
    )
    newest = (
        db.query(func.max(ThreadMessage.id)).group_by(ThreadMessage.thread_id).scalar_subquery()
    )
    latest = {
        m.thread_id: m
        for m in db.query(ThreadMessage)
        .filter(ThreadMessage.id.in_(newest))
        .options(joinedload(ThreadMessage.author))
    }
    run_ids = [t.run_id for t in threads if t.kind == "chore"]
    chores, run_kids = {}, {}
    if run_ids:
        runs = (
            db.query(ChoreRun)
            .filter(ChoreRun.id.in_(run_ids))
            .options(
                joinedload(ChoreRun.assignment).joinedload(ChoreAssignment.chore),
                selectinload(ChoreRun.kids),
            )
            .all()
        )
        chores = {r.id: r.assignment.chore.title for r in runs}
        run_kids = {r.id: run_kid_ids(r) for r in runs}
    out = [
        {
            **_preview(latest.get(t.id)),
            "id": t.id,
            "kind": t.kind,
            "task_id": t.run_id,  # key kept for the frontend; it is the run id
            "kid_id": t.kid_id,
            "kid_ids": run_kids.get(t.run_id, []) if t.kind == "chore" else [],
            "title": _title(db, t, names, chores),
            "unread": counts.get(t.id, 0),
        }
        for t in threads
    ]
    return {"total": sum(r["unread"] for r in out), "threads": out}


def purge_kid(db: Session, kid_id: int) -> None:
    """Remove a deleted kid's private thread and reads; keep their other messages."""
    for t in db.query(Thread).filter(Thread.kind == "private", Thread.kid_id == kid_id):
        db.query(ThreadRead).filter(ThreadRead.thread_id == t.id).delete()
        db.delete(t)
    db.query(ThreadRead).filter(ThreadRead.user_id == kid_id).delete()
    db.query(MessageReaction).filter(MessageReaction.user_id == kid_id).delete()
    db.query(ThreadMessage).filter(ThreadMessage.author_id == kid_id).update({"author_id": None})
    db.query(ChatPhoto).filter(ChatPhoto.uploaded_by_id == kid_id).update({"uploaded_by_id": None})


def toggle_reaction(db: Session, m: ThreadMessage, user: User, emoji: str) -> None:
    """Add `user`'s `emoji` to `m`, or take it off if already there. Flushes, never commits."""
    q = db.query(MessageReaction).filter_by(message_id=m.id, user_id=user.id, emoji=emoji)
    if not q.delete():
        db.add(MessageReaction(message_id=m.id, user_id=user.id, emoji=emoji))
    db.flush()


def reactions(db: Session, message_ids: list[int], me: User) -> dict[int, list[dict]]:
    """{message id: [{emoji, count, mine, names}]} for a page of messages, in one query."""
    rows = (
        db.query(
            MessageReaction.message_id,
            MessageReaction.emoji,
            User.id,
            User.full_name,
            User.username,
        )
        .join(User, User.id == MessageReaction.user_id)
        .filter(MessageReaction.message_id.in_(message_ids))
        .order_by(MessageReaction.id)
        .all()
    )
    out: dict[int, dict[str, dict]] = {}
    for mid, emoji, uid, full, username in rows:
        r = out.setdefault(mid, {}).setdefault(
            emoji, {"emoji": emoji, "count": 0, "mine": False, "names": []}
        )
        r["count"] += 1
        r["mine"] = r["mine"] or uid == me.id
        r["names"].append(full or username)
    return {mid: list(by.values()) for mid, by in out.items()}
