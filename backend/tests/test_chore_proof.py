import io
from datetime import date

from app.models.chore_extra import ChorePhoto
from app.models.family import get_family
from app.models.task import Task, TaskStatus
from app.models.user import UserRole
from app.services.photos import storage
from PIL import Image

from tests.conftest import _headers, _make_user

DAY = date(2026, 10, 20)


def _jpeg(exif=False, size=(40, 30)) -> bytes:
    img = Image.new("RGB", size, "red")
    out = io.BytesIO()
    if exif:
        ex = Image.Exif()
        ex[0x010F] = "Cam"  # Make
        ex.get_ifd(0x8825)[1] = "N"  # GPS latitude ref
        img.save(out, "JPEG", exif=ex)
    else:
        img.save(out, "JPEG")
    return out.getvalue()


def _setup(db, client, ph, **kw):
    get_family(db).last_reset_date = DAY
    db.commit()
    k = _make_user(db, "leo", UserRole.KID)
    body = {"title": "Room", "repeat": {"type": "daily"}, "kid_ids": [k.id], **kw}
    assert client.post("/api/v1/chores/", json=body, headers=ph).status_code == 200
    t = db.query(Task).filter(Task.is_recurring.is_(False)).one()
    return k, _headers(db, k), t.id


def _up(client, h, cid, data=None, ctype="image/jpeg"):
    data = data or _jpeg()
    return client.post(
        f"/api/v1/kid/chores/{cid}/photos", files={"file": ("a.jpg", data, ctype)}, headers=h
    )


def _done(client, h, cid):
    return client.post(f"/api/v1/kid/chores/{cid}/done", headers=h)


def test_subtasks_copied_in_order_and_ticked(client, db, parent_headers):
    k, h, cid = _setup(db, client, parent_headers, subtasks=["a", "b", "c"])
    t = db.get(Task, cid)
    assert [s.title for s in t.chore_subtasks] == ["a", "b", "c"]
    ids = [s.id for s in t.chore_subtasks]
    for i in ids:
        assert (
            client.post(
                f"/api/v1/kid/chores/{cid}/subtasks/{i}", json={"done": True}, headers=h
            ).status_code
            == 200
        )
    db.expire_all()
    assert all(s.done_at for s in db.get(Task, cid).chore_subtasks)
    client.post(f"/api/v1/kid/chores/{cid}/subtasks/{ids[0]}", json={"done": False}, headers=h)
    db.expire_all()
    assert db.get(Task, cid).chore_subtasks[0].done_at is None


def test_done_needs_every_step(client, db, parent_headers):
    k, h, cid = _setup(db, client, parent_headers, subtasks=["a", "b"])
    sid = db.get(Task, cid).chore_subtasks[0].id
    client.post(f"/api/v1/kid/chores/{cid}/subtasks/{sid}", json={"done": True}, headers=h)
    r = _done(client, h, cid)
    assert r.status_code == 409 and r.json()["detail"] == "Tick every step first."


def test_done_needs_photo(client, db, parent_headers):
    k, h, cid = _setup(db, client, parent_headers, needs_photo=True)
    r = _done(client, h, cid)
    assert r.status_code == 409 and r.json()["detail"] == "Add a photo first."
    assert _up(client, h, cid).status_code == 200
    assert _done(client, h, cid).status_code == 200


def test_photo_strips_exif(client, db, parent_headers):
    k, h, cid = _setup(db, client, parent_headers)
    assert _up(client, h, cid, _jpeg(exif=True)).status_code == 200
    p = db.query(ChorePhoto).one()
    for key in (p.path, p.thumb_path):
        img = Image.open(storage().open(key))
        assert len(img.getexif()) == 0
    assert len(Image.open(io.BytesIO(_jpeg(exif=True))).getexif()) > 0


def test_photo_limits(client, db, parent_headers):
    k, h, cid = _setup(db, client, parent_headers)
    assert _up(client, h, cid, b"x" * (10 * 1024 * 1024 + 1)).status_code == 413
    assert _up(client, h, cid, b"hello", "text/plain").status_code == 415
    assert _up(client, h, cid, b"not an image").status_code == 415


def test_photo_access(client, db, parent_headers):
    k, h, cid = _setup(db, client, parent_headers)
    pid = _up(client, h, cid).json()["id"]
    other = _headers(db, _make_user(db, "zed", UserRole.KID))
    for suffix in ("", "/thumb"):
        url = f"/api/v1/chore-photos/{pid}{suffix}"
        assert client.get(url, headers=h).status_code == 200
        assert client.get(url, headers=parent_headers).status_code == 200
        assert client.get(url, headers=other).status_code == 404
        assert client.get(url).status_code == 401
    assert _up(client, other, cid).status_code == 404


def test_send_back(client, db, parent_headers):
    k, h, cid = _setup(db, client, parent_headers, needs_photo=True, subtasks=["a"])
    sid = db.get(Task, cid).chore_subtasks[0].id
    client.post(f"/api/v1/kid/chores/{cid}/subtasks/{sid}", json={"done": True}, headers=h)
    _up(client, h, cid)
    assert _done(client, h, cid).status_code == 200
    url = f"/api/v1/chores/{cid}/send-back"
    assert client.post(url, json={}, headers=parent_headers).status_code == 422
    assert client.post(url, json={"note": "  "}, headers=parent_headers).status_code == 422
    r = client.post(url, json={"note": "Under the bed too"}, headers=parent_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "todo" and r.json()["attempt"] == 2
    assert r.json()["last_note"] == "Under the bed too"
    db.expire_all()
    t = db.get(Task, cid)
    assert t.status == TaskStatus.TODO and t.chore_subtasks[0].done_at is not None
    assert _done(client, h, cid).json()["detail"] == "Add a photo first."
    # not submitted any more
    assert client.post(url, json={"note": "x"}, headers=parent_headers).status_code == 409


def test_race_send_back_clears_submitter(client, db, parent_headers):
    get_family(db).last_reset_date = DAY
    db.commit()
    a = _make_user(db, "leo", UserRole.KID)
    b = _make_user(db, "maya", UserRole.KID)
    body = {"title": "T", "repeat": {"type": "daily"}, "kid_ids": [a.id, b.id], "mode": "race"}
    client.post("/api/v1/chores/", json=body, headers=parent_headers)
    cid = db.query(Task).filter(Task.is_recurring.is_(False)).one().id
    client.post(f"/api/v1/kid/chores/{cid}/done", headers=_headers(db, b))
    r = client.post(
        f"/api/v1/chores/{cid}/send-back", json={"note": "again"}, headers=parent_headers
    )
    assert r.status_code == 200 and r.json()["submitted_by_id"] is None


def test_tick_when_submitted_conflicts(client, db, parent_headers):
    k, h, cid = _setup(db, client, parent_headers)
    _done(client, h, cid)
    assert _up(client, h, cid).status_code == 409


def test_pixel_bomb_rejected_before_decoding(client, db, parent_headers):
    # 48 MP of 1-bit pixels compresses to a few KB but would decode to ~150 MB RGB
    k, h, cid = _setup(db, client, parent_headers)
    out = io.BytesIO()
    Image.new("1", (8000, 6000)).save(out, "PNG")
    assert len(out.getvalue()) < 1024 * 1024
    assert _up(client, h, cid, out.getvalue(), "image/png").status_code == 413


def test_large_normal_photo_is_shrunk(client, db, parent_headers):
    k, h, cid = _setup(db, client, parent_headers)
    assert _up(client, h, cid, _jpeg(size=(4000, 3000))).status_code in (200, 201)
    p = db.query(ChorePhoto).one()
    full = Image.open(storage().open(p.path))
    assert max(full.size) <= 1600
