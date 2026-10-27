from app.models.points import Points, PointsType


def test_points_history_newest_first_with_sign(client, db, kid, parent_headers, kid_headers):
    db.add(
        Points(
            user_id=kid.id,
            points_type=PointsType.BONUS,
            amount=25,
            reason="bonus",
            description="Helped",
        )
    )
    db.commit()
    assert (
        client.post(
            f"/api/v1/kids/{kid.id}/deduct",
            json={"amount": 10, "note": "Late"},
            headers=parent_headers,
        ).status_code
        == 200
    )
    r = client.get(f"/api/v1/kids/{kid.id}/points", headers=parent_headers)
    assert r.status_code == 200
    rows = r.json()
    assert [(x["amount"], x["label"], x["reason"]) for x in rows] == [
        (-10, "Late", "deduction"),
        (25, "Helped", "bonus"),
    ]
    assert rows[0]["at"].endswith("Z")
    assert client.get(f"/api/v1/kids/{kid.id}/points", headers=kid_headers).status_code == 403
