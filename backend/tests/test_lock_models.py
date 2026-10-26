"""Lock models: devices, groups, overrides, rule targets."""

import pytest
from app.models.hours import HourRule, HourRuleTarget
from app.models.lock import Device, DeviceGroup
from app.models.user import User
from sqlalchemy.exc import IntegrityError


def _user(db, n="u"):
    u = User(username=n, email=f"{n}@example.com", hashed_password="x")
    db.add(u)
    db.commit()
    return u


def test_device_mac_unique(db):
    db.add(Device(mac="AA:BB:CC:DD:EE:FF", name="a"))
    db.commit()
    assert db.query(Device).one().mac == "aa:bb:cc:dd:ee:ff"
    db.add(Device(mac="aa:bb:cc:dd:ee:ff", name="b"))
    with pytest.raises(IntegrityError):
        db.commit()


@pytest.mark.parametrize("kid,group", [(True, True), (False, False)])
def test_rule_target_requires_exactly_one(db, kid, group):
    k = _user(db)
    g = DeviceGroup(name="g")
    db.add(g)
    db.commit()
    r = HourRule(name="r", kind="allowed", days="01234")
    db.add(r)
    db.commit()
    db.add(
        HourRuleTarget(rule_id=r.id, kid_id=k.id if kid else None, group_id=g.id if group else None)
    )
    with pytest.raises(IntegrityError):
        db.commit()


def test_rule_target_one_ok(db):
    k = _user(db)
    r = HourRule(name="r", kind="free", days="5")
    db.add(r)
    db.commit()
    db.add(HourRuleTarget(rule_id=r.id, kid_id=k.id))
    db.commit()


def test_device_owners_many_to_many(db):
    a, b = _user(db, "a"), _user(db, "b")
    d1 = Device(mac="aa:bb:cc:dd:ee:01", name="1")
    d2 = Device(mac="aa:bb:cc:dd:ee:02", name="2")
    d1.owners = [a, b]
    d2.owners = [a]
    db.add_all([d1, d2])
    db.commit()
    assert {o.username for o in d1.owners} == {"a", "b"}
    assert {d.name for d in a.devices} == {"1", "2"}
    assert d1.status == "unassigned"
