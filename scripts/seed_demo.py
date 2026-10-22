#!/usr/bin/env python3
"""Seed a realistic demo family through the public API."""

import sys
import json
import urllib.request
import urllib.error
import base64
from datetime import datetime, timedelta

BASE_URL = "http://10.99.0.3:8000"


def api(path, method="GET", body=None, token=None, content_type="application/json"):
    """Make an API request."""
    url = f"{BASE_URL}{path}"
    headers = {}
    if content_type:
        headers["Content-Type"] = content_type
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = None
    if body:
        if isinstance(body, dict):
            data = json.dumps(body).encode()
        else:
            data = body

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
            if resp.headers.get("content-type", "").startswith("application/json"):
                return json.loads(content)
            return content
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return json.loads(body)
        except:
            return body


def setup_family():
    """Run setup to create parent."""
    print("Setting up family...")
    result = api(
        "/api/v1/setup",
        method="POST",
        body={
            "family_name": "The Riveras",
            "timezone": "UTC",
            "parent": {
                "username": "sam",
                "password": "password123",
                "full_name": "Sam Rivera",
            },
        },
    )
    if "access_token" not in result:
        print(f"Setup failed: {result}")
        sys.exit(1)
    return result["access_token"]


def create_kid(token, name, avatar=None, pin=None):
    """Create a kid."""
    print(f"Creating kid: {name}")
    result = api(
        "/api/v1/kids",
        method="POST",
        token=token,
        body={
            "full_name": name,
            "avatar": avatar,
            "pin": pin,
        },
    )
    return result["id"]


def create_chore(token, title, points=10, needs_photo=False, steps=None):
    """Create a chore."""
    print(f"Creating chore: {title}")
    result = api(
        "/api/v1/chores/",
        method="POST",
        token=token,
        body={
            "title": title,
            "points": points,
            "needs_photo": needs_photo,
            "steps": steps or [],
        },
    )
    return result["id"]


def assign_chore(token, chore_id, kid_ids, repeat_type="daily", due_time=None):
    """Assign a chore to kids."""
    print(f"Assigning chore {chore_id} to kids {kid_ids}")
    result = api(
        f"/api/v1/chores/{chore_id}/assignments",
        method="POST",
        token=token,
        body={
            "kid_ids": kid_ids,
            "mode": "each",
            "repeat": {
                "type": repeat_type,
                "days": [0, 1, 2, 3, 4, 5, 6] if repeat_type == "weekly" else [],
            },
            "due_time": due_time,
        },
    )
    return result["id"]


def get_devices(token):
    """Get all devices."""
    result = api("/api/v1/devices", token=token)
    return result


def assign_device_to_kid(token, device_id, kid_ids, name=None):
    """Assign device to kids."""
    print(f"Assigning device {device_id} to kids {kid_ids}")
    body = {
        "owner_ids": kid_ids,
        "status": "assigned" if kid_ids else "guest",
    }
    if name:
        body["name"] = name
    result = api(
        f"/api/v1/devices/{device_id}",
        method="PATCH",
        token=token,
        body=body,
    )
    return result


def get_today_chores(token):
    """Get today's chores."""
    return api("/api/v1/chores/today", token=token)


def give_points(token, kid_id, amount, note="Bonus"):
    """Give bonus points to a kid."""
    print(f"Giving {amount} points to kid {kid_id}")
    return api(
        f"/api/v1/kids/{kid_id}/points",
        method="POST",
        token=token,
        body={"amount": amount, "note": note},
    )


def main():
    """Main seed script."""
    if len(sys.argv) > 1:
        global BASE_URL
        BASE_URL = sys.argv[1]

    print(f"Seeding demo family at {BASE_URL}")

    # Setup family and get token
    token = setup_family()
    print(f"Parent created")

    # Create kids with different levels
    # Maya: Level 7 (high points)
    maya_id = create_kid(token, "Maya", avatar="👧", pin="1234")
    # Leo: Level 4 (medium points)
    leo_id = create_kid(token, "Leo", avatar="👦", pin="5678")
    # Ava: Level 2 (low points)
    ava_id = create_kid(token, "Ava", avatar="👧")

    print(f"Kids created: Maya={maya_id}, Leo={leo_id}, Ava={ava_id}")

    # Give kids points to set their levels
    give_points(token, maya_id, 500, "Starting bonus for level 7")
    give_points(token, leo_id, 250, "Starting bonus for level 4")
    give_points(token, ava_id, 100, "Starting bonus for level 2")

    # Create chores
    chore_feed = create_chore(token, "Feed the dog", points=10)
    chore_dishwasher = create_chore(token, "Unload dishwasher", points=15)
    chore_bed = create_chore(token, "Make bed", points=8, steps=["Lay out blankets", "Arrange pillows", "Tuck corners"])
    chore_homework = create_chore(token, "Homework", points=20, needs_photo=True)
    chore_recycling = create_chore(token, "Take out recycling", points=12)
    chore_tidy = create_chore(token, "Tidy playroom", points=15)
    chore_piano = create_chore(token, "Practice piano", points=10)
    chore_plants = create_chore(token, "Water plants", points=8)

    # Assign chores to kids
    assign_chore(token, chore_feed, [maya_id, leo_id])
    assign_chore(token, chore_dishwasher, [maya_id])
    assign_chore(token, chore_bed, [leo_id, ava_id])
    assign_chore(token, chore_homework, [maya_id, leo_id], due_time="15:00")
    assign_chore(token, chore_recycling, [maya_id, leo_id])
    assign_chore(token, chore_tidy, [leo_id, ava_id])
    assign_chore(token, chore_piano, [maya_id])
    assign_chore(token, chore_plants, [ava_id])

    # Get devices and assign to kids
    devices = get_devices(token)
    print(f"Found {len(devices)} devices")

    if len(devices) >= 3:
        # Assign devices to kids
        assign_device_to_kid(token, devices[0]["id"], [maya_id], "Maya's iPhone")
        assign_device_to_kid(token, devices[1]["id"], [leo_id], "Leo's Switch")
        assign_device_to_kid(token, devices[2]["id"], [leo_id, ava_id], "Family iPad")

    print("Demo family seeded successfully!")


if __name__ == "__main__":
    main()
