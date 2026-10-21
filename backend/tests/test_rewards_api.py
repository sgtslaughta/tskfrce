from app.models.reward import Redemption


def _mk(client, h, **kw):
    body = {"name": "Pizza", "price": 50, "icon": "🍕", **kw}
    return client.post("/api/v1/rewards", json=body, headers=h)


def test_create_list_patch(client, parent_headers):
    r = _mk(client, parent_headers)
    assert r.status_code == 200
    rid = r.json()["id"]
    p = client.patch(f"/api/v1/rewards/{rid}", json={"price": 60}, headers=parent_headers)
    assert p.json() == {"id": rid, "name": "Pizza", "price": 60, "icon": "🍕"}
    lst = client.get("/api/v1/rewards", headers=parent_headers).json()
    assert [x["id"] for x in lst] == [rid]


def test_validation(client, parent_headers):
    assert _mk(client, parent_headers, price=0).status_code == 422
    assert _mk(client, parent_headers, name="x" * 101).status_code == 422
    assert _mk(client, parent_headers, icon="x" * 9).status_code == 422


def test_kid_forbidden(client, kid_headers):
    assert _mk(client, kid_headers).status_code == 403
    assert client.get("/api/v1/rewards", headers=kid_headers).status_code == 403


def test_delete_hides_and_denies_pending(client, db, kid, parent_headers):
    rid = _mk(client, parent_headers).json()["id"]
    db.add(Redemption(kid_id=kid.id, kind="reward", reward_id=rid, cost=50, status="pending"))
    db.commit()
    assert client.delete(f"/api/v1/rewards/{rid}", headers=parent_headers).status_code == 204
    assert client.get("/api/v1/rewards", headers=parent_headers).json() == []
    assert db.query(Redemption).one().status == "denied"
