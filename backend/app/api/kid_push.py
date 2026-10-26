"""Parent API: set up a kid's phone for ntfy alerts (QR + link)."""

import io
import secrets
from urllib.parse import quote_plus, urlparse

import segno
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_parent
from app.api.kids import _kid
from app.services import push

router = APIRouter(prefix="/api/v1/kids", tags=["kids"], dependencies=[Depends(require_parent)])


def _out(db: Session, kid, reset: bool = False) -> dict:
    if not push.enabled():
        return dict.fromkeys(("server", "topic", "link", "qr_svg")) | {"enabled": False}
    if reset or not kid.push_topic:
        kid.push_topic = secrets.token_urlsafe(18)
        db.commit()
    server = push.public_url()
    u = urlparse(server)
    link = f"ntfy://{u.netloc}/{kid.push_topic}?display={quote_plus(kid.full_name + ' chores')}"
    if u.scheme == "http":
        link += "&secure=false"
    buf = io.BytesIO()
    segno.make(link).save(buf, kind="svg", scale=6, border=2, xmldecl=False)
    return {
        "enabled": True,
        "server": server,
        "topic": kid.push_topic,
        "link": link,
        "qr_svg": buf.getvalue().decode(),
    }


@router.get("/{kid_id}/push")
def get_push(kid_id: int, db: Session = Depends(get_db)):
    return _out(db, _kid(db, kid_id))


@router.post("/{kid_id}/push/reset")
def reset_push(kid_id: int, db: Session = Depends(get_db)):
    return _out(db, _kid(db, kid_id), reset=True)
