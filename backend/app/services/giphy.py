"""GIPHY via the home box: kids' devices never talk to GIPHY directly."""

import re
import time

import httpx
from fastapi import HTTPException

API = "https://api.giphy.com/v1/gifs"
MEDIA = "https://media.giphy.com/media"
ID_RE = re.compile(r"^[A-Za-z0-9]{1,40}$")
TIMEOUT = 5.0
LIMIT = 24
PREVIEW_MAX, FULL_MAX = 3 * 1024 * 1024, 8 * 1024 * 1024
DOWN = "Couldn't reach GIPHY. Try again in a bit."


def check_id(gif_id: str) -> str:
    if not ID_RE.match(gif_id or ""):
        raise HTTPException(404, "We couldn't find that GIF.")
    return gif_id


def _get(url: str, **kw) -> httpx.Response:
    try:
        r = httpx.get(url, timeout=TIMEOUT, follow_redirects=False, **kw)
        r.raise_for_status()
        return r
    except httpx.HTTPError:
        raise HTTPException(502, DOWN) from None


def search(key: str, rating: str, q: str, offset: int) -> list[dict]:
    q = q.strip()[:50]
    params = {"api_key": key, "limit": LIMIT, "offset": max(0, offset), "rating": rating}
    if q:
        params["q"] = q
    data = _get(f"{API}/{'search' if q else 'trending'}", params=params).json().get("data", [])
    out = []
    for g in data:
        gid = str(g.get("id", ""))
        img = (g.get("images") or {}).get("fixed_width_small") or {}
        if ID_RE.match(gid):
            out.append(
                {
                    "id": gid,
                    "width": int(img.get("width") or 100),
                    "height": int(img.get("height") or 100),
                    "preview_url": f"/chat/gifs/{gid}/preview",
                }
            )
    return out


_OK: dict[tuple[str, str], float] = {}  # (rating, id) -> expiry
OK_TTL = 3600
ALLOWED = {"g": {"g", "y"}, "pg": {"g", "y", "pg"}}


def rating_ok(fam, gif_id: str) -> bool:
    """Server-side check that a GIF id fits the family rating (clients can send any id)."""
    key = (fam.gif_rating, check_id(gif_id))
    now = time.monotonic()
    # ponytail: per-process cache; each worker looks up once per hour
    if _OK.get(key, 0) > now:
        return True
    data = _get(f"{API}/{key[1]}", params={"api_key": fam.giphy_api_key}).json().get("data")
    rating = str((data or {}).get("rating", "")).lower() if isinstance(data, dict) else ""
    if rating not in ALLOWED.get(fam.gif_rating, set()):
        return False
    _OK[key] = now + OK_TTL
    return True


def fetch_media(gif_id: str, name: str, cap: int) -> bytes:
    """Download a fixed GIPHY media file (host is hard-coded, id is validated)."""
    buf = bytearray()
    try:
        with httpx.stream(
            "GET", f"{MEDIA}/{check_id(gif_id)}/{name}", timeout=TIMEOUT, follow_redirects=False
        ) as r:
            r.raise_for_status()
            for chunk in r.iter_bytes():
                buf += chunk
                if len(buf) > cap:
                    raise HTTPException(413, "That GIF is too big.")
    except httpx.HTTPError:
        raise HTTPException(502, DOWN) from None
    return bytes(buf)
