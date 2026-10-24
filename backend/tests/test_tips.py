"""Tests for the tips API."""

import pytest

from app.models.tips import DismissedTip
from app.models.user import UserRole
from tests.conftest import _headers, _make_user


def test_get_dismissed_tips_empty(client, db, parent, parent_headers):
    """Test getting dismissed tips when none are set."""
    res = client.get("/api/v1/me/tips", headers=parent_headers)
    assert res.status_code == 200
    assert res.json() == {"dismissed": []}


def test_dismiss_tip(client, db, parent, parent_headers):
    """Test dismissing a tip."""
    res = client.post("/api/v1/me/tips/devices.name/dismiss", headers=parent_headers)
    assert res.status_code == 200
    assert res.json() == {"dismissed": "devices.name"}

    # Verify it was saved
    tip = db.query(DismissedTip).filter_by(user_id=parent.id, tip_key="devices.name").first()
    assert tip is not None


def test_dismiss_tip_idempotent(client, db, parent, parent_headers):
    """Test dismissing the same tip twice is idempotent."""
    client.post("/api/v1/me/tips/devices.name/dismiss", headers=parent_headers)
    res = client.post("/api/v1/me/tips/devices.name/dismiss", headers=parent_headers)
    assert res.status_code == 200

    # Should still be only one record
    tips = db.query(DismissedTip).filter_by(user_id=parent.id).all()
    assert len(tips) == 1


def test_get_dismissed_tips_after_dismiss(client, db, parent, parent_headers):
    """Test getting dismissed tips after dismissing some."""
    client.post("/api/v1/me/tips/devices.name/dismiss", headers=parent_headers)
    client.post("/api/v1/me/tips/kids.steps/dismiss", headers=parent_headers)

    res = client.get("/api/v1/me/tips", headers=parent_headers)
    assert res.status_code == 200
    keys = set(res.json()["dismissed"])
    assert keys == {"devices.name", "kids.steps"}


def test_dismiss_tip_invalid_key(client, parent_headers):
    """Test dismissing a tip with invalid key format."""
    # Key with uppercase
    res = client.post("/api/v1/me/tips/Invalid.Key/dismiss", headers=parent_headers)
    assert res.status_code == 400

    # Key with spaces
    res = client.post("/api/v1/me/tips/devices name/dismiss", headers=parent_headers)
    assert res.status_code == 400

    # Key too long (65 chars)
    long_key = "a" * 65
    res = client.post(f"/api/v1/me/tips/{long_key}/dismiss", headers=parent_headers)
    assert res.status_code == 400


def test_reset_tips(client, db, parent, parent_headers):
    """Test resetting all dismissed tips."""
    client.post("/api/v1/me/tips/devices.name/dismiss", headers=parent_headers)
    client.post("/api/v1/me/tips/kids.steps/dismiss", headers=parent_headers)

    res = client.delete("/api/v1/me/tips", headers=parent_headers)
    assert res.status_code == 200
    assert res.json() == {"dismissed": []}

    # Verify they're gone
    tips = db.query(DismissedTip).filter_by(user_id=parent.id).all()
    assert len(tips) == 0


def test_tips_per_user(client, db, parent, parent_headers):
    """Test that tips are tracked per user."""
    other = _make_user(db, "other_parent", UserRole.PARENT)
    other_headers = _headers(db, other)

    # Parent dismisses a tip
    client.post("/api/v1/me/tips/devices.name/dismiss", headers=parent_headers)

    # Other user sees no dismissed tips
    res = client.get("/api/v1/me/tips", headers=other_headers)
    assert res.json() == {"dismissed": []}

    # Other user dismisses same tip
    client.post("/api/v1/me/tips/devices.name/dismiss", headers=other_headers)

    # Both users see their own tip
    res = client.get("/api/v1/me/tips", headers=parent_headers)
    assert res.json() == {"dismissed": ["devices.name"]}

    res = client.get("/api/v1/me/tips", headers=other_headers)
    assert res.json() == {"dismissed": ["devices.name"]}


def test_tips_requires_auth(client):
    """Test that tips endpoints require authentication."""
    res = client.get("/api/v1/me/tips")
    assert res.status_code == 401

    res = client.post("/api/v1/me/tips/test.tip/dismiss")
    assert res.status_code == 401

    res = client.delete("/api/v1/me/tips")
    assert res.status_code == 401
