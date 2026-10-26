from datetime import UTC, datetime

import pytest

from .journey import (
    HTTPError,
    as_kid,
    award,
    balance,
    kid,
    make_chore,
    make_kid,
    on_cleanup,
    online,
    parent,
    reset_device,
    set_family,
    wait_for,
    wait_online,
)

pytestmark = pytest.mark.integration


def request_screen(k, minutes=15):
    return kid(
        k["host"], k["token"], "POST", "/redeem", {"kind": "screen_time", "minutes": minutes}
    )


def pending():
    return parent("GET", "/api/v1/redemptions")


def test_screen_time_request_deny_approve():
    set_family(points_unlock_early=True, screen_time_price=5)
    on_cleanup(lambda: reset_device("kid1"))
    a = make_kid("Screen", "1234", "kid1")
    award(a["id"], 20)
    make_chore([a["id"]])
    wait_online("kid1", False)
    r = request_screen(a)
    wait_online("kid1", False)  # asking is not receiving
    assert [p["id"] for p in pending()] == [r["id"]]
    parent("POST", f"/api/v1/redemptions/{r['id']}/deny")
    wait_online("kid1", False)
    assert balance(a) == 20
    r = request_screen(a)
    parent("POST", f"/api/v1/redemptions/{r['id']}/approve")
    wait_online("kid1", True)
    assert balance(a) == 15


def test_bedtime_beats_screen_time():
    set_family(points_unlock_early=True, screen_time_price=5)
    on_cleanup(lambda: reset_device("kid1"))
    a = make_kid("Bed", "1234", "kid1")
    award(a["id"], 20)
    h = datetime.now(UTC).hour  # lab family tz is UTC; keep the window inside one day
    s = h + 2 if h <= 20 else h - 3
    w = parent(
        "POST",
        "/api/v1/hours",
        {
            "name": "Lab hours",
            "category": "other",
            "kind": "allowed",
            "days": "0123456",
            "kid_ids": [a["id"]],
            "times": [{"start": f"{s:02d}:00", "end": f"{s + 1:02d}:00"}],
        },
    )
    on_cleanup(lambda: parent("DELETE", f"/api/v1/hours/{w['id']}"))
    make_chore([a["id"]])
    wait_online("kid1", False)
    r = request_screen(a)
    parent("POST", f"/api/v1/redemptions/{r['id']}/approve")
    assert balance(a) == 15  # paid, yet the window still wins
    assert not wait_for(lambda: online("kid1"), timeout=15)


def test_reward_celebration():
    a = make_kid("Prize", "1234", "kid1")
    rw = parent("POST", "/api/v1/rewards", {"name": "Pizza night", "price": 10})
    on_cleanup(lambda: parent("DELETE", f"/api/v1/rewards/{rw['id']}"))
    award(a["id"], 15)
    r = kid("kid1", a["token"], "POST", "/redeem", {"kind": "reward", "reward_id": rw["id"]})
    parent("POST", f"/api/v1/redemptions/{r['id']}/approve")
    items = kid("kid1", a["token"], "GET", "/celebrations")
    (big,) = [i for i in items if i["key"] == f"r:{r['id']}"]
    assert big["size"] == "big" and big["title"] == "Pizza night"
    kid("kid1", a["token"], "POST", f"/celebrations/{big['key']}/seen")
    assert all(i["key"] != big["key"] for i in kid("kid1", a["token"], "GET", "/celebrations"))
    assert balance(a) == 5


def test_level_up():
    a = make_kid("Level", "1234", "kid1")
    assert kid("kid1", a["token"], "GET", "/today")["progress"]["level"] == 1
    award(a["id"], 60)
    (lv,) = [i for i in kid("kid1", a["token"], "GET", "/celebrations") if i["kind"] == "level"]
    assert lv["title"].startswith("Level 2")
    assert kid("kid1", a["token"], "GET", "/today")["progress"]["level"] == 2


def test_chat_private_thread():
    a, b = make_kid("ChatA", "1234", "kid1"), make_kid("ChatB", "1234", "kid2")
    t = as_kid("kid1", a["token"], "GET", f"/api/v1/chat/threads/private/{a['id']}")
    as_kid(
        "kid1", a["token"], "POST", f"/api/v1/chat/threads/{t['id']}/messages", {"body": "hi mom"}
    )
    assert parent("GET", "/api/v1/chat/threads")["total"] >= 1
    with pytest.raises(HTTPError) as e:
        as_kid("kid2", b["token"], "GET", f"/api/v1/chat/threads/private/{a['id']}")
    assert e.value.status == 404
