from app.models.family import get_family
from app.models.inbox import KINDS
from app.models.notify import NotifyHeld, NotifyPlace


def test_place_and_held_cascade(db):
    p = NotifyPlace(name="Signal", url_enc="x", url_mask="signal://••••", events="chore_ok")
    db.add(p)
    db.flush()
    db.add(NotifyHeld(place_id=p.id, title="t"))
    db.commit()
    assert p.enabled is True
    db.delete(p)
    db.commit()
    assert db.query(NotifyHeld).count() == 0


def test_family_defaults_and_kinds(db):
    fam = get_family(db)
    db.commit()
    assert fam.quiet_security is True and fam.blocker_alerted is False and fam.quiet_start is None
    assert {"device_bypass", "box_offline"} <= set(KINDS)
