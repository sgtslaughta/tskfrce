"""Regression: SQL statements per request stay bounded for a 4-kid family (no N+1)."""

from datetime import UTC, datetime, timedelta

import pytest
from app.api.deps import get_db
from app.core.database import get_db_session
from app.main import fastapi_app
from app.models.chat import Thread, ThreadMessage
from app.models.chore_extra import ChorePhoto
from app.models.chores import ChoreRun
from app.models.family import get_family
from app.models.lock import Device
from app.models.user import UserRole
from sqlalchemy import event
from sqlalchemy.orm import sessionmaker

from tests.conftest import _headers, _make_user
from tests.factories import DAY, api_chore

LIMIT = 16  # +1 batched deductions
LIMITS = {
    "/api/v1/today": 22,  # per-device lock facts and per-kid progress are batched; +1 reward prices, +1 deductions, +3 photo/message counts and earned
    "/api/v1/kid/today": 19,  # +1 seen set, +1 own allowed windows (locks_at), +1 held points
}


class QueryCounter:
    def __init__(self, engine):
        self.engine, self.statements = engine, []

    def _hook(self, conn, cursor, statement, *a):
        self.statements.append(statement)

    def __enter__(self):
        event.listen(self.engine, "before_cursor_execute", self._hook)
        return self

    def __exit__(self, *exc):
        event.remove(self.engine, "before_cursor_execute", self._hook)


@pytest.fixture
def family(client, db, parent_headers):
    get_family(db).last_reset_date = DAY
    db.commit()
    kids = [_make_user(db, f"kid{i}", UserRole.KID) for i in range(4)]
    for i, k in enumerate(kids):
        for j, mode in enumerate(("each", "race", "team", "each", "each")):
            api_chore(
                client,
                parent_headers,
                [k, kids[(i + 1) % 4]] if mode != "each" else [k],
                mode,
                title=f"c{i}{j}",
                steps=["a", "b"] if j % 2 else [],
                needs_photo=j == 0,
            )
    kid_h = _headers(db, kids[0])
    for k in kids:
        r = client.get("/api/v1/kid/today", headers=_headers(db, k)).json()["chores"]
        for c in r[:2]:
            client.post(f"/api/v1/kid/chores/{c['id']}/done", headers=_headers(db, k))
    now = datetime.now(UTC).replace(tzinfo=None)
    for run in db.query(ChoreRun).limit(8):
        db.add(
            ChorePhoto(
                run_id=run.id, uploaded_by_id=kids[0].id, path="p", thumb_path="t", created_at=now
            )
        )
        t = Thread(kind="chore", run_id=run.id)
        t.messages = [
            ThreadMessage(author_id=kids[i % 4].id, body=f"m{i}", created_at=now) for i in range(4)
        ]
        db.add(t)
    for k in kids:
        db.add(Thread(kind="private", kid_id=k.id))
    for i in range(3):
        d = Device(mac=f"aa:bb:cc:dd:ee:0{i}", name=f"D{i}", status="assigned")
        d.last_seen = now - timedelta(minutes=i)
        d.owners.append(kids[i])
        db.add(d)
    db.commit()
    return {"kid": kid_h, "parent": parent_headers}


@pytest.mark.parametrize(
    "who,path",
    [
        ("parent", "/api/v1/today"),
        ("kid", "/api/v1/kid/today"),
        ("kid", "/api/v1/profiles"),
        ("kid", "/api/v1/leaderboard"),
        ("kid", "/api/v1/kid/celebrations"),
        ("kid", "/api/v1/chat/threads"),
        ("parent", "/api/v1/chat/threads"),
        ("parent", "/api/v1/notifications"),
        ("parent", "/api/v1/chores/"),
    ],
)
def test_query_count(client, db, family, who, path):
    """Each request gets a fresh session, like production (no warm identity map)."""

    def fresh():
        s = sessionmaker(bind=db.get_bind(), autoflush=False)()
        try:
            yield s
        finally:
            s.close()

    fastapi_app.dependency_overrides[get_db] = fresh
    fastapi_app.dependency_overrides[get_db_session] = fresh
    with QueryCounter(db.get_bind()) as q:
        r = client.get(path, headers=family[who])
    assert r.status_code == 200, r.text
    limit = LIMITS.get(path, LIMIT)
    if len(q.statements) > limit:
        import collections

        c = collections.Counter(s.split(" FROM ")[-1][:90] for s in q.statements)
        pytest.fail(f"{len(q.statements)} queries > {limit}: {c.most_common(12)}")
