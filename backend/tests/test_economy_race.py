"""Concurrent spends must not overdraw: balance check + debit are serialized."""

import threading
import time

import pytest
from app.api.deps import get_db
from app.core.database import Base, _import_all_models, get_db_session
from app.main import app, fastapi_app
from app.models.family import get_family
from app.models.lock import Device
from app.models.points import Points, PointsType
from app.models.reward import Redemption, Reward
from app.models.user import UserRole
from app.services import economy
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from .conftest import _headers, _make_user


@pytest.fixture
def env(tmp_path, monkeypatch):
    """File-backed WAL DB; every request gets its own session (like production)."""
    _import_all_models()
    eng = create_engine(f"sqlite:///{tmp_path / 't.db'}", connect_args={"timeout": 10})

    def pragmas(c, _r):
        c.execute("PRAGMA journal_mode=WAL")
        c.execute("PRAGMA busy_timeout=10000")

    event.listen(eng, "connect", pragmas)
    Base.metadata.create_all(eng)
    Session = sessionmaker(bind=eng, autoflush=False)

    def dep():
        s = Session()
        try:
            yield s
        finally:
            s.close()

    fastapi_app.dependency_overrides[get_db] = dep
    fastapi_app.dependency_overrides[get_db_session] = dep
    setup = Session()
    get_family(setup)  # seed the singleton so threads do not race to create it
    parent = _make_user(setup, "mom", UserRole.PARENT)
    kid = _make_user(setup, "timmy", UserRole.KID)
    ph, kh = _headers(setup, parent), _headers(setup, kid)
    setup.add(Points(user_id=kid.id, points_type=PointsType.BONUS, amount=100, description="t"))
    setup.commit()
    real = economy.balance

    def slow_balance(db, kid_id):  # widen the check-to-spend window
        v = real(db, kid_id)
        time.sleep(0.3)
        return v

    monkeypatch.setattr(economy, "balance", slow_balance)
    try:
        yield setup, kid, ph, kh
    finally:
        setup.close()
        fastapi_app.dependency_overrides.clear()
        eng.dispose()


def _race(calls):
    barrier, out = threading.Barrier(len(calls)), []

    def run(fn):
        barrier.wait()
        out.append(fn(TestClient(app, base_url="http://localhost")))

    ts = [threading.Thread(target=run, args=(c,)) for c in calls]
    [t.start() for t in ts]
    [t.join() for t in ts]
    return out


def _total(db, kid):
    db.expire_all()
    return db.query(Points).filter(Points.user_id == kid.id).with_entities(Points.amount).all()


def test_instant_reward_cannot_double_spend(env):
    db, kid, ph, kh = env
    db.add(Reward(name="Candy", price=60, icon="x", needs_approval=False))
    db.commit()
    body = {"kind": "reward", "reward_id": 1}
    out = _race([lambda c: c.post("/api/v1/kid/redeem", json=body, headers=kh)] * 2)
    assert sorted(r.status_code for r in out) == [200, 409]
    assert sum(a for (a,) in _total(db, kid)) == 40


def test_parent_approve_two_pending_only_one_wins(env):
    db, kid, ph, kh = env
    db.add(Reward(name="Movie", price=60, icon="x"))
    db.commit()
    for _ in range(2):
        db.add(Redemption(kid_id=kid.id, kind="reward", reward_id=1, cost=60))
    db.commit()
    out = _race(
        [lambda c, i=i: c.post(f"/api/v1/redemptions/{i}/approve", headers=ph) for i in (1, 2)]
    )
    assert sorted(r.status_code for r in out) == [200, 409]
    assert sum(a for (a,) in _total(db, kid)) == 40


def test_daily_cap_cannot_be_beaten_by_two_buys(env):
    db, kid, ph, kh = env
    fam = get_family(db)
    fam.points_unlock_early, fam.screen_max_minutes = True, 20  # two 15s exceed 20
    fam.screen_only_allowed_hours = False
    d = Device(mac="aa:bb:cc:dd:ee:01", name="Phone", status="assigned")
    d.owners.append(kid)
    db.add(d)
    db.commit()
    body = {"kind": "screen_time", "minutes": 15}  # 20 points each, 100 available
    out = _race([lambda c: c.post("/api/v1/kid/redeem", json=body, headers=kh)] * 2)
    assert sorted(r.status_code for r in out) == [200, 409]
