from datetime import UTC, date, datetime, timedelta

from app.models.chores import ChoreSeen
from app.models.family import get_family
from app.models.lock import TimeWindow
from app.models.user import UserRole

from tests.conftest import _headers, _make_user
from tests.factories import make_run

DAY = date(2026, 10, 20)  # a Tuesday
NOON = datetime(2026, 10, 20, 12, 0, tzinfo=UTC)


def _fixed_now(monkeypatch):
    class Fake(datetime):
        @classmethod
        def now(cls, tz=None):
            return NOON

    monkeypatch.setattr("app.api.kid.datetime", Fake)


def _today(client, kh):
    return client.get("/api/v1/kid/today", headers=kh).json()


def _run(db, parent, kid, **kw):
    get_family(db).last_reset_date = DAY
    r = make_run(db, parent, kid, **kw)
    db.commit()
    return r


def test_today_has_age_group_and_locks_at(client, db, parent, kid, kid_headers, monkeypatch):
    _fixed_now(monkeypatch)
    kid.age_group = "teen"
    db.add(TimeWindow(kind="allowed", days="0123456", start="00:00", end="21:00", kid_id=kid.id))
    db.commit()
    j = _today(client, kid_headers)
    assert j["age_group"] == "teen"
    assert j["locks_at"] == "2026-10-20T21:00:00Z"


def test_new_until_seen(client, db, parent, kid, kid_headers):
    r = _run(db, parent, kid)
    assert _today(client, kid_headers)["chores"][0]["new"] is True
    for _ in range(2):
        assert (
            client.post(f"/api/v1/kid/chores/{r.id}/seen", headers=kid_headers).status_code == 204
        )
    assert _today(client, kid_headers)["chores"][0]["new"] is False
    assert db.query(ChoreSeen).count() == 1


def test_old_assignment_not_new(client, db, parent, kid, kid_headers):
    r = _run(db, parent, kid)
    r.assignment.created_at = datetime.utcnow() - timedelta(hours=25)
    db.commit()
    assert _today(client, kid_headers)["chores"][0]["new"] is False


def test_seen_other_kids_run_404(client, db, parent, kid, kid_headers):
    sis = _make_user(db, "sis", UserRole.KID)
    r = _run(db, parent, sis)
    res = client.post(f"/api/v1/kid/chores/{r.id}/seen", headers=kid_headers)
    assert res.status_code == 404 and res.json()["detail"] == "We couldn't find that chore."
    assert (
        client.post(f"/api/v1/kid/chores/{r.id}/seen", headers=_headers(db, sis)).status_code == 204
    )


def test_done_at_after_submit(client, db, parent, kid, kid_headers):
    _run(db, parent, kid)
    assert _today(client, kid_headers)["chores"][0]["done_at"] is None
    rid = _today(client, kid_headers)["chores"][0]["id"]
    assert client.post(f"/api/v1/kid/chores/{rid}/done", headers=kid_headers).status_code == 200
    assert _today(client, kid_headers)["chores"][0]["done_at"].endswith("Z")
