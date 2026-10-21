from collections import Counter

from app.flair.catalog import BY_ID, CATALOG, SLOTS
from app.models.gamification import Points, PointsType


def _xp(db, kid, n):
    db.add(Points(user_id=kid.id, amount=n, points_type=PointsType.TASK_COMPLETION))
    db.commit()


def _put(client, h, slot, id_):
    return client.put("/api/v1/kid/flair", json={"slot": slot, "id": id_}, headers=h)


def test_catalog_shape():
    assert len(BY_ID) == len(CATALOG)
    for s in SLOTS:
        assert any(f.slot == s and f.unlock_level <= 5 for f in CATALOG) or s == "name"
    for lvl, n in Counter(f.unlock_level for f in CATALOG).items():
        assert 3 <= n <= 6, lvl
    assert all(f.emblem for f in CATALOG if f.slot == "emblem")


def test_get_lists_only_level_one_unlocked(client, kid_headers):
    d = client.get("/api/v1/kid/flair", headers=kid_headers).json()
    assert d["level"] == 1 and set(d["equipped"]) == set(SLOTS)
    assert all(v is None for v in d["equipped"].values())
    assert {i["id"] for i in d["items"] if i["unlocked"]} == {
        f.id for f in CATALOG if f.unlock_level == 1
    }


def test_equip_awards_drip_once(client, kid_headers):
    r = _put(client, kid_headers, "emblem", "emblem-star").json()
    assert r["equipped"]["emblem"] == "emblem-star"
    assert [b["key"] for b in r["new_badges"]] == ["drip"]
    r = _put(client, kid_headers, "title", "title-basic").json()
    assert r["new_badges"] == []


def test_locked_item_403_and_unchanged(client, kid_headers):
    r = _put(client, kid_headers, "card", "card-sheen")
    assert r.status_code == 403 and "level 25" in r.json()["detail"]
    d = client.get("/api/v1/kid/flair", headers=kid_headers).json()
    assert d["equipped"]["card"] is None


def test_wrong_slot_unknown_and_bad_slot_400(client, kid_headers):
    assert _put(client, kid_headers, "ring", "card-sheen").status_code == 400
    assert _put(client, kid_headers, "ring", "nope").status_code == 400
    assert _put(client, kid_headers, "hat", None).status_code == 400


def test_unequip(client, kid_headers):
    _put(client, kid_headers, "emblem", "emblem-star")
    r = _put(client, kid_headers, "emblem", None).json()
    assert r["equipped"]["emblem"] is None


def test_unknown_stored_id_ignored_then_dropped(client, db, kid, kid_headers):
    kid.flair = {"card": "card-gone", "title": "title-basic"}
    db.commit()
    eq = client.get("/api/v1/kid/flair", headers=kid_headers).json()["equipped"]
    assert eq["card"] is None and eq["title"] == "title-basic"
    _put(client, kid_headers, "emblem", "emblem-star")
    db.refresh(kid)
    assert kid.flair == {"title": "title-basic", "emblem": "emblem-star"}


def test_parent_cannot_equip(client, parent_headers):
    assert _put(client, parent_headers, "emblem", "emblem-star").status_code == 403


def test_high_level_unlocks(client, db, kid, kid_headers):
    _xp(db, kid, 100000)
    assert _put(client, kid_headers, "card", "card-sheen").status_code == 200


def test_identity_payloads_include_flair(client, db, kid, kid_headers, parent_headers):
    _put(client, kid_headers, "emblem", "emblem-star")
    want = "emblem-star"
    assert (
        client.get("/api/v1/kid/today", headers=kid_headers).json()["progress"]["flair"]["emblem"]
        == want
    )
    rows = client.get("/api/v1/leaderboard", headers=kid_headers).json()["rows"]
    assert rows[0]["flair"]["emblem"] == want
    p = client.get(f"/api/v1/profiles/{kid.id}", headers=parent_headers).json()
    assert p["flair"]["emblem"] == want
    kids = client.get("/api/v1/today", headers=parent_headers).json()["kids"]
    assert kids[0]["progress"]["flair"]["emblem"] == want
