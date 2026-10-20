import pytest
from app.api.deps import get_current_active_user
from app.core.config import settings
from app.main import fastapi_app
from app.models.user import User


@pytest.fixture(autouse=True)
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DATA_DIR", tmp_path)


@pytest.fixture
def user(db):
    u = User(id=1, username="u", email="u@example.com", hashed_password="x")
    db.add(u)
    db.commit()
    return u


@pytest.fixture
def authed(client, user):
    fastapi_app.dependency_overrides[get_current_active_user] = lambda: user
    return client


def _upload(c, name="a.txt", data=b"hello", ctype="text/plain"):
    return c.post("/api/v1/media/upload", files={"file": (name, data, ctype)})


def test_upload_then_download(authed):
    r = _upload(authed)
    assert r.status_code == 201
    att = r.json()
    url = authed.get(f"/api/v1/media/attachments/{att['id']}/download-url").json()["download_url"]
    assert url == f"/api/v1/media/files/{att['file_path']}"
    assert authed.get(url).content == b"hello"


def test_file_route_rejects_unknown_and_traversal(authed):
    assert authed.get("/api/v1/media/files/nope.txt").status_code == 404
    assert authed.get("/api/v1/media/files/..%2F..%2Fetc%2Fpasswd").status_code == 404


def test_upload_html_rejected(authed):
    for name in ("x.html", "x.svg", "x.exe", "x"):
        r = _upload(authed, name, b"<script>1</script>", "text/html")
        assert r.status_code == 400, name


def test_file_served_with_nosniff_and_attachment(authed):
    key = _upload(authed).json()["file_path"]
    r = authed.get(f"/api/v1/media/files/{key}")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["content-disposition"].startswith("attachment")
    png = _upload(authed, "p.png", b"\x89PNG", "image/png").json()["file_path"]
    r = authed.get(f"/api/v1/media/files/{png}")
    assert r.headers["content-disposition"].startswith("inline")
    assert r.headers["content-type"] == "image/png"


def test_get_file_requires_auth(client):
    assert client.get("/api/v1/media/files/1/a.txt").status_code in (401, 403)


def test_upload_over_limit_413(authed, monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE", 10)
    assert _upload(authed, data=b"x" * 11).status_code == 413
