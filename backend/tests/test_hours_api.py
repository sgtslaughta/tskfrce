from datetime import UTC, date, datetime

import pytest
from app.lock.state import tick
from app.models.family import get_family
from app.models.lock import Device

from tests.factories import make_rule, make_run
from tests.test_parent_api import setup_day

URL = "/api/v1/hours"


def body(**kw):
    b = {
        "name": "Homework time",
        "category": "other",
        "kind": "off",
        "days": "01234",
        "everyone": False,
        "kid_ids": [],
        "group_ids": [],
        "times": [{"start": "16:00", "end": "18:00"}],
    }
    return b | kw


def mkkid(db, name):
    from app.models.user import UserRole

    from tests.conftest import _make_user

    return _make_user(db, name, UserRole.KID)


def test_create_rule_many_targets(client, db, kid, parent_headers):
    b2 = mkkid(db, "bobby")
    g = client.post("/api/v1/groups", json={"name": "G"}, headers=parent_headers).json()
    r = client.post(
        URL, json=body(kid_ids=[kid.id, b2.id], group_ids=[g["id"]]), headers=parent_headers
    )
    assert r.status_code == 200, r.text
    got = client.get(URL, headers=parent_headers).json()["rules"]
    assert len(got) == 1 and got[0]["id"] == r.json()["id"]
    assert sorted(got[0]["kid_ids"]) == sorted([kid.id, b2.id]) and got[0]["group_ids"] == [g["id"]]
    assert got[0]["times"] == [{"start": "16:00", "end": "18:00"}]
    assert got[0]["start_date"] is None and got[0]["everyone"] is False


def test_put_rule_updates_every_target(client, db, parent, kid, parent_headers):
    b2 = mkkid(db, "bobby")
    setup_day(db)
    macs = []
    for i, k in enumerate((kid, b2)):
        d = Device(mac=f"aa:bb:cc:dd:ee:0{i}", name="T", status="assigned")
        d.owners = [k]
        db.add(d)
        make_run(db, parent, k, status="done", approved=True)
        macs.append(d.mac)
    db.commit()
    r = make_rule(db, kid_ids=[kid.id, b2.id])
    now = datetime(2026, 10, 20, 12, 0, tzinfo=UTC)
    assert not set(macs) & set(tick(db, now))
    hh = 2
    t = {"start": f"{hh:02d}:00", "end": f"{hh:02d}:30"}
    put = client.put(
        f"{URL}/{r.id}",
        json=body(kind="allowed", days="0123456", kid_ids=[kid.id, b2.id], times=[t]),
        headers=parent_headers,
    )
    assert put.status_code == 200, put.text
    assert set(macs) <= set(tick(db, now))


DATES = {"start_date": "2026-12-20", "end_date": "2027-01-03"}
CASES = [
    ({"category": "holiday"}, 422, "Holidays and summer need a first and last day."),
    ({"start_date": "2026-12-20"}, 422, "Give both a first and last day, or neither."),
    (
        {"start_date": "2027-01-03", "end_date": "2026-12-20"},
        422,
        "The last day can't be before the first day.",
    ),
    ({"everyone": True, "kid_ids": [1]}, 422, "Pick Everyone or some kids and groups, not both."),
    ({}, 422, "Pick who this is for."),
    ({"kid_ids": [9999]}, 404, "That kid doesn't exist. Pick a kid from the list."),
    ({"group_ids": [9999]}, 404, "That group doesn't exist. Pick a group from the list."),
    (
        {"everyone": True, "times": [{"start": "09:00", "end": "09:00"}]},
        422,
        "Start and end can't be the same.",
    ),
]


@pytest.mark.parametrize(("patch", "code", "detail"), CASES)
def test_rule_validation(client, parent_headers, patch, code, detail):
    r = client.post(URL, json=body(**patch), headers=parent_headers)
    assert r.status_code == code and r.json()["detail"] == detail


@pytest.mark.parametrize(
    "patch",
    [
        {"times": [{"start": "07:00\n", "end": "08:00"}]},
        {"times": [{"start": "07:00", "end": "25:00"}]},
        {"times": []},
        {"days": "0128"},
        {"days": ""},
        {"days": "00"},
        {"name": ""},
        {"category": "nope"},
        {"kind": "nope"},
    ],
)
def test_rule_bad_shape(client, parent_headers, patch):
    r = client.post(URL, json=body(everyone=True, **patch), headers=parent_headers)
    assert r.status_code == 422


def test_dedupes_targets(client, kid, parent_headers):
    r = client.post(URL, json=body(kid_ids=[kid.id, kid.id]), headers=parent_headers)
    assert r.status_code == 200 and r.json()["kid_ids"] == [kid.id]


def test_missing_rule_404(client, parent_headers):
    msg = "That rule doesn't exist. Refresh and try again."
    r = client.put(f"{URL}/99", json=body(everyone=True), headers=parent_headers)
    assert r.status_code == 404 and r.json()["detail"] == msg
    r = client.delete(f"{URL}/99", headers=parent_headers)
    assert r.status_code == 404 and r.json()["detail"] == msg


def test_delete_rule(client, db, parent_headers):
    r = make_rule(db, everyone=True)
    assert client.delete(f"{URL}/{r.id}", headers=parent_headers).json() == {"ok": True}
    assert client.get(URL, headers=parent_headers).json()["rules"] == []


def test_today_category(client, db, monkeypatch, parent_headers):
    now = datetime(2026, 10, 20, 16, 0, tzinfo=UTC)  # Tuesday

    class FrozenDT(datetime):
        @classmethod
        def now(cls, tz=None):
            return now

    monkeypatch.setattr("app.api.hours.datetime", FrozenDT)
    get_family(db)
    make_rule(db, category="school_night", days="01236", everyone=True)
    got = client.get(URL, headers=parent_headers).json()
    assert got["today"] == "school_night" and len(got["rules"]) == 1
    assert date(2026, 10, 20).weekday() == 1


def test_delete_target_keeps_rule(client, db, kid, parent_headers):
    b2 = mkkid(db, "bobby")
    make_rule(db, kid_ids=[kid.id, b2.id])
    client.delete(f"/api/v1/kids/{kid.id}", headers=parent_headers)
    rule = client.get(URL, headers=parent_headers).json()["rules"][0]
    assert rule["kid_ids"] == [b2.id]
    client.delete(f"/api/v1/kids/{b2.id}", headers=parent_headers)
    rule = client.get(URL, headers=parent_headers).json()["rules"][0]
    assert rule["kid_ids"] == [] and rule["everyone"] is False


def test_kid_cannot_edit_hours(client, kid_headers):
    assert client.get(URL, headers=kid_headers).status_code == 403
    assert client.post(URL, json=body(everyone=True), headers=kid_headers).status_code == 403
