"""Chore proof photos: re-encode (strips EXIF/GPS), shrink, store, thumbnail."""

import io
import uuid

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, ImageSequence, UnidentifiedImageError

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
# Animated GIFs (chat only): total decoded pixels across frames are capped the same way.
GIF_MAX_BYTES, GIF_MAX_FRAMES = 8 * 1024 * 1024, 300


def storage() -> LocalStorage:
    return LocalStorage(settings.DATA_DIR / "uploads")


def _jpeg(img: Image.Image, size: int) -> bytes:
    if max(img.size) > size:
        img = img.copy()
        img.thumbnail((size, size))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=85)  # no exif= argument: metadata is dropped
    return out.getvalue()


def encode(upload: UploadFile) -> tuple[bytes, bytes]:
    """Validate and re-encode an upload: (full-size jpeg, thumbnail jpeg)."""
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
    return _jpeg(img, FULL), _jpeg(img, THUMB)


def encode_gif(data: bytes) -> tuple[bytes, bytes]:
    """Validate and re-save an animated GIF: (clean gif, small animated gif thumbnail)."""
    if len(data) > GIF_MAX_BYTES:
        raise HTTPException(413, "That GIF is too big. The limit is 8 MB.")
    try:
        img = Image.open(io.BytesIO(data))  # lazy: header only
        if img.format != "GIF":
            raise UnidentifiedImageError("not a gif")
        n = getattr(img, "n_frames", 1)
        w, h = img.size
        if n > GIF_MAX_FRAMES or w * h * n > MAX_PIXELS:
            raise HTTPException(413, "That GIF is too long or too large. Try a shorter one.")
        frames, durations, total = [], [], 0
        for f in ImageSequence.Iterator(img):
            # header sizes are untrusted: enforce per frame, before decoding (convert)
            fw, fh = f.size
            total += fw * fh
            if fw > w or fh > h or fw * fh > MAX_PIXELS or total > MAX_PIXELS:
                raise HTTPException(413, "That GIF is too long or too large. Try a shorter one.")
            durations.append(f.info.get("duration", 100))
            c = f.convert("RGBA")
            c.info.clear()  # drops comment/extension metadata carried in frame info
            frames.append(c)
        small = []
        for c in frames:
            t = c.copy()
            t.thumbnail((THUMB, THUMB))
            small.append(t)
        return _gif(frames, durations), _gif(small, durations)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, EOFError):
        raise HTTPException(415, "We couldn't read that GIF. Try another one.") from None


def _gif(frames: list[Image.Image], durations: list[int]) -> bytes:
    out = io.BytesIO()
    # explicit save args only: comments and extension blocks are not carried over
    frames[0].save(
        out, "GIF", save_all=True, append_images=frames[1:], loop=0, duration=durations, disposal=2
    )
    return out.getvalue()


def put(
    store: LocalStorage, prefix: str, upload: UploadFile, *, gif: bool = False
) -> tuple[str, str]:
    """Encode and store under `prefix/`; returns (path, thumb_path).

    `gif=True` (chat only) also accepts animated GIFs, which are stored as .gif.
    """
    key = f"{prefix}/{uuid.uuid4().hex}"
    if gif and upload.content_type == "image/gif":
        data = upload.file.read(GIF_MAX_BYTES + 1)
        return put_gif(store, key, data)
    full, thumb = encode(upload)
    store.save(f"{key}.jpg", full, "image/jpeg")
    store.save(f"{key}_thumb.jpg", thumb, "image/jpeg")
    return f"{key}.jpg", f"{key}_thumb.jpg"


def put_gif(store: LocalStorage, key: str, data: bytes) -> tuple[str, str]:
    full, thumb = encode_gif(data)
    store.save(f"{key}.gif", full, "image/gif")
    store.save(f"{key}_thumb.gif", thumb, "image/gif")
    return f"{key}.gif", f"{key}_thumb.gif"


def chat_storage() -> LocalStorage:
    return LocalStorage(settings.DATA_DIR / "chat_photos")


def save_photo(upload: UploadFile, task: Task, user: User) -> ChorePhoto:
    path, thumb_path = put(storage(), f"chore/{task.id}", upload)
    return ChorePhoto(
        task_id=task.id,
        attempt=task.attempt or 1,
        uploaded_by_id=user.id,
        path=path,
        thumb_path=thumb_path,
    )
