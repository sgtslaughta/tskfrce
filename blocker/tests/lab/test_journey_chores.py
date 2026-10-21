import pytest

from .journey import (
    JPEG,
    HTTPError,
    balance,
    chore_of,
    kid,
    kid_login,
    make_chore,
    make_kid,
    needs_you,
    parent,
    submit,
    wait_online,
)

pytestmark = pytest.mark.integration


def status_of(fn, *a, **k) -> int:
    with pytest.raises(HTTPError) as e:
        fn(*a, **k)
    return e.value.status


def photo(k, chore_id):
    return kid(k["host"], k["token"], "POST", f"/chores/{chore_id}/photos", files={"file": JPEG})


def test_chore_gate():
    a = make_kid("Gate", "1234", "kid1")
    with pytest.raises(HTTPError) as e:
        kid_login("kid1", a["id"], "0000")
    assert e.value.status == 401
    c = make_chore([a["id"]], points=7)
    wait_online("kid1", False)
    submit(a, c["id"])
    wait_online("kid1", False)  # waiting for a parent is not enough
    parent("POST", f"/api/v1/chores/{c['id']}/approve")
    wait_online("kid1", True)
    assert balance(a) == 7


def test_subtasks_photo_and_send_back():
    a = make_kid("Photo", "1234", "kid1")
    c = make_chore([a["id"]], title="Room", subtasks=["Bed", "Floor"], needs_photo=True)
    wait_online("kid1", False)
    assert status_of(submit, a, c["id"]) == 409  # steps not ticked
    for s in chore_of(a, c["id"])["subtasks"]:
        kid("kid1", a["token"], "POST", f"/chores/{c['id']}/subtasks/{s['id']}", {"done": True})
    assert status_of(submit, a, c["id"]) == 409  # no photo yet
    photo(a, c["id"])
    submit(a, c["id"])
    assert [n["type"] for n in needs_you() if n["id"] == c["id"]] == ["chore"]
    parent("POST", f"/api/v1/chores/{c['id']}/send-back", {"note": "Under the bed too"})
    mine = chore_of(a, c["id"])
    assert mine["last_note"] == "Under the bed too" and mine["state"] == "todo"
    wait_online("kid1", False)
    assert status_of(submit, a, c["id"]) == 409  # attempt 2 needs its own photo
    photo(a, c["id"])
    submit(a, c["id"])
    (n,) = [n for n in needs_you() if n["id"] == c["id"]]
    assert n["type"] == "redo" and n["attempt"] == 2
    parent("POST", f"/api/v1/chores/{c['id']}/approve")
    wait_online("kid1", True)


def test_race_frees_both_kids():
    a, b = make_kid("RaceA", "1234", "kid1"), make_kid("RaceB", "1234", "kid2")
    c = make_chore([a["id"], b["id"]], mode="race", points=8)
    wait_online("kid1", False)
    wait_online("kid2", False)
    submit(b, c["id"])
    parent("POST", f"/api/v1/chores/{c['id']}/approve")
    wait_online("kid1", True)
    wait_online("kid2", True)
    assert chore_of(a, c["id"])["taken_by"] == "RaceB"
    assert (balance(a), balance(b)) == (0, 8)


def test_team_splits_points():
    a, b = make_kid("TeamA", "1234", "kid1"), make_kid("TeamB", "1234", "kid2")
    c = make_chore([a["id"], b["id"]], mode="team", points=30)
    submit(a, c["id"])
    parent("POST", f"/api/v1/chores/{c['id']}/approve")
    assert (balance(a), balance(b)) == (15, 15)
