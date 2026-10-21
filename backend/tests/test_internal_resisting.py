from datetime import UTC, datetime

from app.api.devices import device_out
from app.core.config import settings
from app.models.family import get_family
from app.models.lock import Device
from app.models.notification import Notification
from app.models.user import UserRole

from tests.conftest import _make_user

URL = "/api/v1/internal/devices/resisting"
MAC = "aa:bb:cc:dd:ee:01"


def tok():
    return {"X-Internal-Token": settings.INTERNAL_TOKEN}


def _count(db):
    return db.query(Notification).filter_by(type="device_resisting").count()


def _device(db):
    d = Device(mac=MAC, name="Pad", status="assigned")
    db.add(d)
    db.commit()
    return d


def test_flag_sets_since_and_notifies_each_parent_once(client, db, parent):
    _make_user(db, "dad", UserRole.PARENT)
    _make_user(db, "kid2", UserRole.KID)
    d = _device(db)
    r = client.post(URL, json={"resisting": [MAC.upper()]}, headers=tok())
    assert r.status_code == 200 and r.json() == {"flagged": 1, "cleared": 0}
    db.refresh(d)
    assert d.resisting_since is not None
    assert _count(db) == 2
    n = db.query(Notification).first()
    assert n.title == "Pad is getting around the block"
    assert n.action_url == "/manage/devices" and n.data == {"device_id": d.id}
    r = client.post(URL, json={"resisting": [MAC]}, headers=tok())
    assert r.json() == {"flagged": 0, "cleared": 0}
    assert _count(db) == 2


def test_absent_mac_clears_flag(client, db, parent):
    d = _device(db)
    client.post(URL, json={"resisting": [MAC]}, headers=tok())
    r = client.post(URL, json={"resisting": []}, headers=tok())
    assert r.json() == {"flagged": 0, "cleared": 1}
    db.refresh(d)
    assert d.resisting_since is None
    assert _count(db) == 1


def test_unknown_mac_ignored_bad_token_and_bad_mac(client, db):
    r = client.post(URL, json={"resisting": ["aa:bb:cc:dd:ee:ff"]}, headers=tok())
    assert r.json() == {"flagged": 0, "cleared": 0}
    assert client.post(URL, json={"resisting": []}).status_code == 403
    assert client.post(URL, json={"resisting": ["nope"]}, headers=tok()).status_code == 422


def test_device_out_includes_resisting(client, db, parent):
    d = _device(db)
    now = datetime.now(UTC)
    fam = get_family(db)
    assert device_out(db, d, fam, now)["resisting"] is False
    client.post(URL, json={"resisting": [MAC]}, headers=tok())
    db.refresh(d)
    assert device_out(db, d, fam, now)["resisting"] is True
