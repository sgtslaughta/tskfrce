from app.models.points import Points

URL = "/api/v1/kids/{}/points"


def test_bonus_validation(client, kid, parent_headers):
    u = URL.format(kid.id)
    for body in (
        {"amount": 0, "note": "x"},
        {"amount": 501, "note": "x"},
        {"amount": 5, "note": " "},
    ):
        assert client.post(u, json=body, headers=parent_headers).status_code == 422


def test_kid_cannot_give(client, kid, kid_headers):
    r = client.post(URL.format(kid.id), json={"amount": 5, "note": "x"}, headers=kid_headers)
    assert r.status_code == 403


def test_bonus_raises_balance_and_celebrates(client, db, kid, parent_headers, kid_headers):
    r = client.post(
        URL.format(kid.id), json={"amount": 25, "note": "Helped"}, headers=parent_headers
    )
    assert r.json() == {"balance": 25}
    p = db.query(Points).one()
    assert p.reason == "bonus" and p.description == "Helped"
    items = client.get("/api/v1/kid/celebrations", headers=kid_headers).json()
    b = [i for i in items if i["kind"] == "bonus"]
    assert b and b[0]["title"] == "+25 bonus points" and b[0]["detail"] == "Helped"
    assert (
        client.post(f"/api/v1/kid/celebrations/{b[0]['key']}/seen", headers=kid_headers).status_code
        == 204
    )
    items = client.get("/api/v1/kid/celebrations", headers=kid_headers).json()
    assert not [i for i in items if i["kind"] == "bonus"]


def test_deduct_takes_points_with_reason_never_below_zero(
    client, db, kid, parent_headers, kid_headers
):
    client.post(URL.format(kid.id), json={"amount": 15, "note": "Helped"}, headers=parent_headers)
    d = f"/api/v1/kids/{kid.id}/deduct"
    assert (
        client.post(d, json={"amount": 5, "note": " "}, headers=parent_headers).status_code == 422
    )
    assert client.post(d, json={"amount": 5, "note": "x"}, headers=kid_headers).status_code == 403
    r = client.post(
        d, json={"amount": 10, "note": "Left plates in the sink"}, headers=parent_headers
    )
    assert r.json() == {"balance": 5, "deducted": 10}
    p = db.query(Points).filter(Points.reason == "deduction").one()
    assert p.amount == -10 and p.description == "Left plates in the sink"
    r = client.post(d, json={"amount": 20, "note": "Again"}, headers=parent_headers)
    assert r.json() == {"balance": 0, "deducted": 5}
