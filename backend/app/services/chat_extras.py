"""Chat members, @mentions and message search."""

import re

from sqlalchemy.orm import Session

from app.models.chat import Thread, ThreadMessage
from app.models.chores import ChoreRun
from app.models.user import User, UserRole
from app.services.chat import can_access
from app.services.chores import run_kid_ids

SEARCH_WINDOW = 200


def first_name(u: User) -> str:
    parts = (u.full_name or u.username).split()
    return parts[0] if parts else u.username


def members(db: Session, t: Thread) -> list[User]:
    """Active parents plus the kids the thread is about."""
    q = db.query(User).filter(User.is_active)
    if t.kind == "family":
        cond = User.role.in_([UserRole.PARENT, UserRole.KID])
    else:
        kid_ids: list[int] = []
        if t.kind == "private":
            kid_ids = [t.kid_id]
        else:
            run = db.get(ChoreRun, t.run_id)
            kid_ids = run_kid_ids(run) if run else []
        cond = (User.role == UserRole.PARENT) | User.id.in_(kid_ids)
    return q.filter(cond).order_by(User.id).all()


def mentioned(users: list[User], body: str | None, author_id: int) -> list[int]:
    names = {n.lower() for n in re.findall(r"@(\w+)", body or "")}
    if not names:
        return []
    return [u.id for u in users if u.id != author_id and first_name(u).lower() in names]


def search(db: Session, user: User, q: str) -> list[int]:
    esc = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    rows = (
        db.query(ThreadMessage.thread_id)
        .filter(ThreadMessage.kind == "user", ThreadMessage.body.ilike(f"%{esc}%", escape="\\"))
        .order_by(ThreadMessage.id.desc())
        .limit(SEARCH_WINDOW)
        .all()
    )
    ids = list(dict.fromkeys(r[0] for r in rows))
    out = []
    for tid in ids:
        t = db.get(Thread, tid)
        if t is not None and can_access(db, user, t):
            out.append(tid)
    return out
