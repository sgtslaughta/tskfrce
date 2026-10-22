import io

import pytest
from app.services import giphy, photos
from PIL import Image

C = "/api/v1/chat"
F = "/api/v1/family"


def _gif(frames=3, size=(20, 20), comment=None):
    imgs = [Image.new("RGB", size, (i * 60, 0, 0)) for i in range(frames)]
    out = io.BytesIO()
    kw = {"comment": comment} if comment else {}
    imgs[0].save(out, "GIF", save_all=True, append_images=imgs[1:], duration=80, loop=0, **kw)
    return out.getvalue()


def _thread(client, h):
    return client.get(f"{C}/threads/family/family", headers=h).json()["id"]


def _on(client, ph, **kw):
    body = {"gifs_enabled": True, "giphy_api_key": "k123", **kw}
    assert client.patch(F, json=body, headers=ph).status_code == 200


def _up(client, h, tid, data, ctype="image/gif"):
    return client.post(
        f"{C}/threads/{tid}/photos", files={"file": ("a.gif", data, ctype)}, headers=h
    )


def test_disabled_is_404(client, parent_headers):
    assert client.get(f"{C}/gifs", headers=parent_headers).status_code == 404
    r = client.get(f"{C}/threads", headers=parent_headers).json()
    assert r["gifs_enabled"] is False
    tid = _thread(client, parent_headers)
    r = client.post(f"{C}/threads/{tid}/gifs", json={"gif_id": "abc"}, headers=parent_headers)
    assert r.status_code == 404 and r.json()["detail"] == "GIFs are turned off."


def test_key_never_returned_and_clearable(client, parent_headers):
    _on(client, parent_headers)
    r = client.get(F, headers=parent_headers).json()
    assert r["giphy_key_set"] is True and "k123" not in str(r) and "giphy_api_key" not in r
    patched = client.patch(F, json={"gif_rating": "pg"}, headers=parent_headers).json()
    assert patched["gif_rating"] == "pg" and patched["giphy_key_set"] is True
    r = client.patch(F, json={"giphy_api_key": ""}, headers=parent_headers).json()
    assert r["giphy_key_set"] is False


def test_rating_validation(client, parent_headers):
    assert client.patch(F, json={"gif_rating": "r"}, headers=parent_headers).status_code == 422


def test_search_passes_params_and_hides_giphy(client, parent_headers, kid_headers, monkeypatch):
    _on(client, parent_headers, gif_rating="pg")
    seen = {}

    class R:
        content = b""

        def raise_for_status(self):
            pass

        def json(self):
            return {
                "data": [
                    {
                        "id": "abc123",
                        "images": {"fixed_width_small": {"width": "100", "height": "80"}},
                    }
                ]
            }

    def fake(url, **kw):
        seen.update(url=url, **kw["params"])
        return R()

    monkeypatch.setattr(giphy.httpx, "get", fake)
    r = client.get(f"{C}/gifs", params={"q": "x" * 80, "offset": 24}, headers=kid_headers)
    assert r.json() == [
        {"id": "abc123", "width": 100, "height": 80, "preview_url": "/chat/gifs/abc123/preview"}
    ]
    assert seen["url"].endswith("/search") and seen["rating"] == "pg" and seen["limit"] == 24
    assert seen["api_key"] == "k123" and len(seen["q"]) == 50 and seen["offset"] == 24
    seen.clear()
    client.get(f"{C}/gifs", headers=kid_headers)
    assert seen["url"].endswith("/trending") and "q" not in seen
    assert client.get(f"{C}/threads", headers=kid_headers).json()["gifs_enabled"] is True


def test_giphy_down_is_502(client, parent_headers, monkeypatch):
    _on(client, parent_headers)

    def boom(*a, **k):
        raise giphy.httpx.ConnectError("x")

    monkeypatch.setattr(giphy.httpx, "get", boom)
    r = client.get(f"{C}/gifs", headers=parent_headers)
    assert r.status_code == 502 and "GIPHY" in r.json()["detail"]


def test_preview_rejects_bad_id(client, parent_headers):
    _on(client, parent_headers)
    for bad in ("a.b", "x%2F..%2Fy", "a" * 41):
        assert client.get(f"{C}/gifs/{bad}/preview", headers=parent_headers).status_code == 404


def test_pick_gif_stores_animated_photo(client, parent_headers, kid_headers, monkeypatch):
    _on(client, parent_headers)
    monkeypatch.setattr(giphy, "fetch_media", lambda i, n, c: _gif())
    tid = _thread(client, kid_headers)
    pid = client.post(
        f"{C}/threads/{tid}/gifs", json={"gif_id": "abc"}, headers=kid_headers
    ).json()["photo_id"]
    m = client.post(
        f"{C}/threads/{tid}/messages", json={"photo_id": pid}, headers=kid_headers
    ).json()
    r = client.get(m["photo_url"], headers=parent_headers)
    assert r.headers["content-type"] == "image/gif"
    assert Image.open(io.BytesIO(r.content)).n_frames == 3
    t = client.get(m["photo_url"] + "/thumb", headers=parent_headers)
    assert t.headers["content-type"] == "image/jpeg"


def test_gif_upload_keeps_frames_strips_comment(client, kid_headers):
    tid = _thread(client, kid_headers)
    r = _up(client, kid_headers, tid, _gif(4, comment=b"secret-gps"))
    assert r.status_code == 200
    m = client.post(
        f"{C}/threads/{tid}/messages", json={"photo_id": r.json()["photo_id"]}, headers=kid_headers
    ).json()
    out = client.get(m["photo_url"], headers=kid_headers).content
    img = Image.open(io.BytesIO(out))
    assert img.n_frames == 4 and b"secret-gps" not in out and "comment" not in img.info


def test_gif_caps(client, kid_headers, monkeypatch):
    tid = _thread(client, kid_headers)
    monkeypatch.setattr(photos, "GIF_MAX_FRAMES", 2)
    r = _up(client, kid_headers, tid, _gif(3))
    assert r.status_code == 413 and "too long" in r.json()["detail"]
    monkeypatch.setattr(photos, "GIF_MAX_FRAMES", 300)
    monkeypatch.setattr(photos, "MAX_PIXELS", 1000)
    assert _up(client, kid_headers, tid, _gif(3)).status_code == 413
    monkeypatch.setattr(photos, "MAX_PIXELS", 40_000_000)
    monkeypatch.setattr(photos, "GIF_MAX_BYTES", 50)
    assert _up(client, kid_headers, tid, _gif(3)).status_code == 413
    assert _up(client, kid_headers, tid, b"not a gif").status_code in (413, 415)
    monkeypatch.setattr(photos, "GIF_MAX_BYTES", 8 * 1024 * 1024)
    assert _up(client, kid_headers, tid, b"not a gif").status_code == 415


@pytest.mark.parametrize("ctype", ["image/gif"])
def test_chore_proof_still_rejects_gif(client, db, parent_headers, ctype):
    from tests.test_chore_proof import _setup
    from tests.test_chore_proof import _up as proof_up

    k, h, cid = _setup(db, client, parent_headers)
    assert proof_up(client, h, cid, _gif(), ctype).status_code == 415
