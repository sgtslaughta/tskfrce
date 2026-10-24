from app.lock import blocker_client
from app.models.lock import Device

OK = {"reason": "device", "offline": False, "router_resisted": False, "message": "x"}


def _dev(db):
    d = Device(mac="aa:bb:cc:dd:ee:01", name="Pad", status="assigned")
    db.add(d)
    db.commit()
    return d


def test_passthrough(client, db, parent_headers, monkeypatch):
    d = _dev(db)
    seen = []
    monkeypatch.setattr(blocker_client, "test_block", lambda mac: seen.append(mac) or OK)
    r = client.post(f"/api/v1/devices/{d.id}/test-block", headers=parent_headers)
    assert r.status_code == 200 and r.json() == OK
    assert seen == [d.mac]


def test_blocker_down_503(client, db, parent_headers, monkeypatch):
    d = _dev(db)
    monkeypatch.setattr(blocker_client, "test_block", lambda mac: None)
    r = client.post(f"/api/v1/devices/{d.id}/test-block", headers=parent_headers)
    assert r.status_code == 503
    assert r.json()["detail"] == "The home box didn't answer. Is it plugged in?"


def test_kid_forbidden(client, db, kid_headers):
    d = _dev(db)
    assert client.post(f"/api/v1/devices/{d.id}/test-block", headers=kid_headers).status_code == 403
