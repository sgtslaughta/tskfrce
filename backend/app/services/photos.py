"""Chore proof photos: re-encode (strips EXIF/GPS), shrink, store, thumbnail."""

import io
import uuid

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings
from app.models.chore_extra import ChorePhoto
from app.models.task import Task
from app.models.user import User
from app.services.local_storage import LocalStorage

TYPES = {"image/jpeg", "image/png", "image/webp"}
FULL, THUMB = 1600, 320
# Byte caps don't bound decoded size: a tiny PNG can expand to gigabytes.
# 40 MP covers any phone camera (12-48 MP sensors bin to <= ~24 MP output).
MAX_PIXELS = 40_000_000


def storage() -> LocalStorage:
    return LocalStorage(settings.DATA_DIR / "uploads")


def _jpeg(img: Image.Image, size: int) -> bytes:
    if max(img.size) > size:
        img = img.copy()
        img.thumbnail((size, size))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=85)  # no exif= argument: metadata is dropped
    return out.getvalue()


def save_photo(upload: UploadFile, task: Task, user: User) -> ChorePhoto:
    if upload.content_type not in TYPES:
        raise HTTPException(415, "Please add a JPEG, PNG or WebP photo.")
    data = upload.file.read(settings.MAX_UPLOAD_SIZE + 1)
    if len(data) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(413, "That photo is too big. The limit is 10 MB.")
    try:
        img = Image.open(io.BytesIO(data))  # lazy: reads the header only
        w, h = img.size
        if w * h > MAX_PIXELS:
            raise HTTPException(413, "That photo is too large. Try a smaller one.")
        img.draft("RGB", (FULL, FULL))  # JPEG: decode at reduced scale
        img.thumbnail((FULL, FULL))  # shrink before any full-size copy
        img = ImageOps.exif_transpose(img).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(415, "We couldn't read that photo. Try another one.") from None
    key = f"chore/{task.id}/{uuid.uuid4().hex}"
    store = storage()
    store.save(f"{key}.jpg", _jpeg(img, FULL), "image/jpeg")
    store.save(f"{key}_thumb.jpg", _jpeg(img, THUMB), "image/jpeg")
    return ChorePhoto(
        task_id=task.id,
        attempt=task.attempt or 1,
        uploaded_by_id=user.id,
        path=f"{key}.jpg",
        thumb_path=f"{key}_thumb.jpg",
    )
