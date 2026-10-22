"""Chat: chore, private and family threads (polled by clients)."""

import uuid
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, StringConstraints, model_validator
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.chat import ChatPhoto, Thread, ThreadMessage
from app.models.family import get_family
from app.models.user import User, UserRole
from app.schemas.lock import utc_z
from app.services import chat, giphy
from app.services.photos import chat_storage, put, put_gif

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])

PAGE = 50
DELETE_WINDOW = timedelta(minutes=5)
NOT_FOUND = "We couldn't find that conversation."


class MessageIn(BaseModel):
    body: Annotated[str | None, StringConstraints(strip_whitespace=True, max_length=2000)] = None
    photo_id: int | None = None

    @model_validator(mode="after")
    def _something(self):
        if not self.body:
            self.body = None
        if self.body is None and self.photo_id is None:
            raise ValueError("Write a message or add a photo.")
        return self


def _thread(db: Session, user: User, thread_id: int) -> Thread:
    t = db.get(Thread, thread_id)
    if t is None or not chat.can_access(db, user, t):
        raise HTTPException(404, NOT_FOUND)
    return t


def _msg(t: Thread, m: ThreadMessage) -> dict:
    return {
        "id": m.id,
        "author_id": m.author_id,
        "author_name": (m.author.full_name or m.author.username) if m.author else None,
        "kind": m.kind,
        "body": m.body,
        "photo_url": chat.photo_url(t, m),
        "created_at": utc_z(m.created_at),
    }


@router.get("/threads")
def threads(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    out = chat.unread(db, user)
    fam = get_family(db)
    out["gifs_enabled"] = bool(fam.gifs_enabled and fam.giphy_api_key)
    db.commit()
    return out


@router.get("/threads/{kind}/{ref}")
def thread(
    kind: str,
    ref: str,
    before: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    t = chat.resolve(db, user, kind, ref)
    if t is None:
        raise HTTPException(404, NOT_FOUND)
    q = db.query(ThreadMessage).filter(ThreadMessage.thread_id == t.id)
    if before is not None:
        q = q.filter(ThreadMessage.id < before)
    rows = q.order_by(ThreadMessage.id.desc()).limit(PAGE + 1).all()
    out = {
        "id": t.id,
        "kind": t.kind,
        "title": chat.title(db, t),
        "messages": [_msg(t, m) for m in reversed(rows[:PAGE])],
        "has_more": len(rows) > PAGE,
    }
    db.commit()  # lazily created thread
    return out


@router.post("/threads/{thread_id}/messages")
def send(
    thread_id: int,
    body: MessageIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    t = _thread(db, user, thread_id)
    if body.photo_id is not None and not chat.photo_ok(db, t, body.photo_id):
        raise HTTPException(422, "We couldn't find that photo. Add it again.")
    m = chat.post(db, t, user, body.body, body.photo_id)
    db.commit()
    return _msg(t, m)


@router.post("/threads/{thread_id}/photos")
def add_photo(
    thread_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    t = _thread(db, user, thread_id)
    # always a chat photo, never chore proof (proof goes through /kid/chores/{id}/photos)
    path, thumb = put(chat_storage(), f"thread/{t.id}", file, gif=True)
    p = ChatPhoto(thread_id=t.id, uploaded_by_id=user.id, path=path, thumb_path=thumb)
    db.add(p)
    db.commit()
    return {"photo_id": p.id}


class GifIn(BaseModel):
    gif_id: str


def _gif_settings(db: Session):
    fam = get_family(db)
    if not (fam.gifs_enabled and fam.giphy_api_key):
        raise HTTPException(404, "GIFs are turned off.")
    return fam


@router.get("/gifs")
def gif_search(
    q: str = "",
    offset: int = Query(0, ge=0, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    fam = _gif_settings(db)
    return giphy.search(fam.giphy_api_key, fam.gif_rating, q, offset)


@router.get("/gifs/{gif_id}/preview")
def gif_preview(
    gif_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    _gif_settings(db)
    data = giphy.fetch_media(gif_id, "200w.gif", giphy.PREVIEW_MAX)
    return Response(
        data, media_type="image/gif", headers={"Cache-Control": "private, max-age=86400"}
    )


@router.post("/threads/{thread_id}/gifs")
def add_gif(
    thread_id: int,
    body: GifIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    t = _thread(db, user, thread_id)
    _gif_settings(db)
    data = giphy.fetch_media(body.gif_id, "giphy.gif", giphy.FULL_MAX)
    path, thumb = put_gif(chat_storage(), f"thread/{t.id}/{uuid.uuid4().hex}", data)
    p = ChatPhoto(thread_id=t.id, uploaded_by_id=user.id, path=path, thumb_path=thumb)
    db.add(p)
    db.commit()
    return {"photo_id": p.id}


@router.post("/threads/{thread_id}/read")
def read(
    thread_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    chat.mark_read(db, _thread(db, user, thread_id), user)
    db.commit()
    return {"ok": True}


@router.delete("/messages/{message_id}", status_code=204, response_class=Response)
def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    m = db.get(ThreadMessage, message_id)
    if m is None or not chat.can_access(db, user, db.get(Thread, m.thread_id)):
        raise HTTPException(404, "We couldn't find that message.")
    if user.role != UserRole.PARENT and (
        m.author_id != user.id or datetime.utcnow() - m.created_at > DELETE_WINDOW
    ):
        raise HTTPException(403, "You can only delete your own messages for 5 minutes.")
    db.delete(m)
    db.commit()
    return Response(status_code=204)


@router.get("/photos/{photo_id}")
def photo(
    photo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    return _file(db, user, photo_id, False)


@router.get("/photos/{photo_id}/thumb")
def thumb(
    photo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    return _file(db, user, photo_id, True)


def _file(db: Session, user: User, photo_id: int, thumb: bool) -> FileResponse:
    p = db.get(ChatPhoto, photo_id)
    t = db.get(Thread, p.thread_id) if p else None
    if t is None or not chat.can_access(db, user, t):
        raise HTTPException(404, "We couldn't find that photo.")
    try:
        path = chat_storage().open(p.thumb_path if thumb else p.path)
    except FileNotFoundError:
        raise HTTPException(404, "We couldn't find that photo.") from None
    kind = "image/gif" if not thumb and p.path.endswith(".gif") else "image/jpeg"
    return FileResponse(path, media_type=kind, headers={"Cache-Control": "private"})
