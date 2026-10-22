#!/usr/bin/env python3
"""Seed the Rivera demo family on top of a fresh setup, for guide screenshots.

Run AFTER the setup wizard created parent "sam" (see scripts/capture_screenshots.py),
kids Maya, Leo, Ava and devices (reported to /internal/devices/seen with
INTERNAL_TOKEN; "Maya's iPhone" must have ip 127.0.0.1 so this script acts as
that device when it logs in as a kid).

    python3 scripts/seed_demo.py http://127.0.0.1:8777 <path to task4ce.db> <password>
"""

import io
import json
import sqlite3
import sys
import urllib.error
import urllib.request
import uuid
from datetime import date, timedelta

from PIL import Image, ImageDraw

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8777"
DB = sys.argv[2] if len(sys.argv) > 2 else "task4ce.db"
PW = sys.argv[3] if len(sys.argv) > 3 else "rivera-demo-2026"


def call(path, method="GET", body=None, token=None, files=None):
    headers, data = {}, None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if files:
        b = uuid.uuid4().hex
        headers["Content-Type"] = f"multipart/form-data; boundary={b}"
        name, blob = files
        data = (
            f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\n'
            f"Content-Type: image/jpeg\r\n\r\n"
        ).encode() + blob + f"\r\n--{b}--\r\n".encode()
    elif body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    elif method == "POST":
        data = b""
    req = urllib.request.Request(BASE + "/api/v1" + path, data, headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path} -> {e.code} {e.read().decode()}")


def photo(kind):
    """A small flat-colour illustration standing in for a camera photo."""
    im = Image.new("RGB", (640, 480), (236, 228, 210) if kind == "notes" else (205, 222, 235))
    d = ImageDraw.Draw(im)
    if kind == "notes":
        for y in range(60, 440, 36):
            d.line([(50, y), (590, y)], fill=(150, 170, 200), width=2)
        d.line([(90, 0), (90, 480)], fill=(220, 120, 120), width=3)
        for y in (50, 120, 190, 260):
            d.line([(110, y + 30), (110 + 280 + y % 90, y + 30)], fill=(40, 50, 120), width=5)
    else:
        d.rectangle([0, 340, 640, 480], fill=(190, 150, 110))
        d.rectangle([60, 250, 320, 340], fill=(220, 90, 90))
        d.rectangle([360, 280, 560, 340], fill=(90, 160, 120))
        d.ellipse([430, 200, 500, 280], fill=(250, 200, 70))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=80)
    return (f"{kind}.jpg", buf.getvalue())


def kid_token(parent, dev_id, kid_id):
    call(f"/devices/{dev_id}", "PATCH", {"status": "assigned", "owner_ids": [kid_id]}, parent)
    return call("/kid/login", "POST", {"kid_id": kid_id})["access_token"]


def main():
    tok = call("/auth/login", "POST", {"username": "sam", "password": PW})["access_token"]
    kids = {k["full_name"]: k["id"] for k in call("/kids", token=tok)}
    maya, leo, ava = kids["Maya"], kids["Leo"], kids["Ava"]
    devs = {d["name"]: d["id"] for d in call("/devices", token=tok)}
    phone, switch = devs["Maya's iPhone"], devs["Leo's Switch"]

    call("/family", "PATCH", {"points_unlock_early": True, "screen_time_price": 10}, tok)
    for k, n in ((maya, 950), (leo, 330), (ava, 90)):
        while n > 0:
            call(f"/kids/{k}/points", "POST", {"amount": min(n, 500), "note": "Great month"}, tok)
            n -= 500
    for name, price, icon in (("Pick the movie", 60, "🎬"), ("Ice cream trip", 120, "🍦"), ("Stay up 30 min late", 90, "🌙")):
        call("/rewards", "POST", {"name": name, "price": price, "icon": icon}, tok)
    rewards = {r["name"]: r["id"] for r in call("/rewards", token=tok)}

    def chore(title, points, kid_ids, photo_needed=False, steps=()):
        c = call("/chores/", "POST", {"title": title, "points": points, "needs_photo": photo_needed, "steps": list(steps)}, tok)
        a = call(f"/chores/{c['id']}/assignments", "POST",
                 {"kid_ids": kid_ids, "mode": "each", "repeat": {"type": "daily", "days": []}, "on_date": None, "due_time": None}, tok)
        return a["id"]

    asg = {
        "dog": chore("Feed the dog", 10, [maya, leo]),
        "dish": chore("Unload the dishwasher", 15, [maya]),
        "hw": chore("Homework", 20, [maya], True),
        "piano": chore("Practice piano", 10, [maya]),
        "tidy": chore("Tidy the playroom", 15, [leo, ava], True),
        "rec": chore("Take out the recycling", 12, [leo]),
        "desk": chore("Clean your desk", 15, [leo], True, ["Clear the clutter", "Wipe it down", "Put books away"]),
        "plants": chore("Water the plants", 8, [ava]),
    }

    # past days all done: streaks (Maya 6 days, Leo 3). Today's runs are created by the app.
    db = sqlite3.connect(DB)
    for kid, n, ids in ((maya, 6, ("dog", "dish", "hw", "piano")), (leo, 3, ("dog", "tidy", "rec", "desk"))):
        for back in range(1, n + 1):
            for key in ids:
                db.execute(
                    "INSERT INTO chore_runs (assignment_id, day, kid_id, status, attempt) VALUES (?,?,?,'done',1)",
                    (asg[key], (date.today() - timedelta(days=back)).isoformat(), kid),
                )
    db.commit()
    db.close()

    def runs(token_):
        return {c["title"]: c["id"] for c in call("/kid/today", token=token_)["chores"]}

    # Maya: two chores approved, homework with a photo waiting, a reward request
    mt = kid_token(tok, phone, maya)
    r = runs(mt)
    for t in ("Feed the dog", "Unload the dishwasher"):
        call(f"/kid/chores/{r[t]}/done", "POST", token=mt)
        call(f"/chores/{r[t]}/approve", "POST", token=tok)
    call(f"/kid/chores/{r['Homework']}/photos", "POST", token=mt, files=photo("notes"))
    call(f"/kid/chores/{r['Homework']}/done", "POST", token=mt)
    call("/kid/redeem", "POST", {"kind": "reward", "reward_id": rewards["Ice cream trip"]}, mt)

    # Leo: tidy sent back once and resubmitted, a screen time request, desk half ticked
    lt = kid_token(tok, phone, leo)
    r = runs(lt)
    tidy = r["Tidy the playroom"]
    call(f"/kid/chores/{tidy}/photos", "POST", token=lt, files=photo("room"))
    call(f"/kid/chores/{tidy}/done", "POST", token=lt)
    call(f"/chores/{tidy}/send-back", "POST", {"note": "Toys are still under the couch. Check there too!"}, tok)
    th = call(f"/chat/threads/chore/{tidy}", token=lt)["id"]
    call(f"/chat/threads/{th}/messages", "POST", {"body": "Oops, got it. Doing it now!"}, lt)
    call(f"/kid/chores/{tidy}/photos", "POST", token=lt, files=photo("room"))
    call(f"/kid/chores/{tidy}/done", "POST", token=lt)
    call(f"/chat/threads/{th}/messages", "POST", {"body": "Much better, thank you! Approving soon."}, tok)
    desk = next(c for c in call("/kid/today", token=lt)["chores"] if c["title"] == "Clean your desk")
    call(f"/kid/chores/{desk['id']}/subtasks/{desk['subtasks'][0]['id']}", "POST", {"done": True}, lt)
    call("/kid/redeem", "POST", {"kind": "screen_time", "minutes": 30}, lt)

    # Devices page: Leo's Switch paused; the 127.0.0.1 phone is handed to a kid per shot
    call(f"/devices/{switch}", "PATCH", {"status": "assigned", "owner_ids": [leo]}, tok)
    call(f"/devices/{switch}/override", "POST", {"action": "lock", "minutes": 60}, tok)
    print("seeded; maya", maya, "leo", leo, "phone", phone, "tidy run", tidy)


if __name__ == "__main__":
    main()
