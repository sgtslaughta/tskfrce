"""Test helpers: build chores, assignments and runs in the DB or through the API."""

from datetime import date, datetime

from app.models.chores import Chore, ChoreAssignment, ChoreRun, ChoreStep

DAY = date(2026, 10, 20)  # a Tuesday


def make_chore(
    db,
    parent,
    title="Dishes",
    points=10,
    kids=(),
    mode="each",
    repeat="daily",
    days=None,
    on_date=None,
    due_time=None,
    steps=(),
    needs_photo=False,
):
    """A chore with one assignment (no runs yet)."""
    c = Chore(title=title, points=points, needs_photo=needs_photo, created_by_id=parent.id)
    c.steps = [ChoreStep(title=s, position=i) for i, s in enumerate(steps)]
    a = ChoreAssignment(
        chore=c, mode=mode, repeat=repeat, days=days, on_date=on_date, due_time=due_time
    )
    a.kids = list(kids)
    db.add_all([c, a])
    db.commit()
    return c, a


def make_run(
    db,
    parent,
    kid=None,
    *,
    kids=None,
    status="todo",
    approved=False,
    title="x",
    points=3,
    day=DAY,
    mode="each",
    due_time=None,
    steps=(),
    needs_photo=False,
    submitted_at=None,
    submitted_by=None,
    attempt=1,
):
    """One run (shared when `kids` is given) on a one-time assignment for `day`."""
    members = list(kids or [kid])
    _, a = make_chore(
        db,
        parent,
        title,
        points,
        members,
        mode,
        "once",
        on_date=day,
        due_time=due_time,
        steps=steps,
        needs_photo=needs_photo,
    )
    r = ChoreRun(
        assignment=a,
        day=day,
        kid_id=None if kids else kid.id,
        status=status,
        attempt=attempt,
        submitted_at=submitted_at,
        submitted_by_id=submitted_by.id if submitted_by else None,
        approved_by_id=parent.id if approved else None,
        created_at=datetime(2026, 10, 20, 0, 0),
    )
    if kids:
        r.kids = members
    db.add(r)
    db.commit()
    return r


def api_chore(client, ph, kids, mode="each", repeat=None, title="Trash", points=25, **kw):
    """Create a chore and one assignment through the API; returns (chore, assignment) JSON."""
    body = {"title": title, "points": points}
    for k in ("steps", "needs_photo"):
        if k in kw:
            body[k] = kw.pop(k)
    r = client.post("/api/v1/chores/", json=body, headers=ph)
    assert r.status_code == 200, r.text
    chore = r.json()
    a = {"kid_ids": [k.id for k in kids], "mode": mode, "repeat": repeat or {"type": "daily"}, **kw}
    r = client.post(f"/api/v1/chores/{chore['id']}/assignments", json=a, headers=ph)
    assert r.status_code == 200, r.text
    return chore, r.json()
