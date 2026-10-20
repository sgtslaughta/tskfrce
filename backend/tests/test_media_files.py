import pytest
from app.core.config import settings


@pytest.fixture(autouse=True)
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DATA_DIR", tmp_path)


def test_upload_then_download(client, db):
    from app.models.user import User

    db.add(User(id=1, username="u", email="u@example.com", hashed_password="x"))
    db.commit()
    r = client.post("/api/v1/media/upload", files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 201
    att = r.json()
    url = client.get(f"/api/v1/media/attachments/{att['id']}/download-url").json()["download_url"]
    assert url == f"/api/v1/media/files/{att['file_path']}"
    assert client.get(url).content == b"hello"


def test_file_route_rejects_unknown_and_traversal(client):
    assert client.get("/api/v1/media/files/nope.txt").status_code == 404
    assert client.get("/api/v1/media/files/..%2F..%2Fetc%2Fpasswd").status_code == 404
