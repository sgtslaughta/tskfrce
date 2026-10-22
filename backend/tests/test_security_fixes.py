"""Test security fixes for IDOR and password change endpoints."""

import pytest
from sqlalchemy.orm import Session

from app.core.auth import AuthService
from app.models.user import User, UserRole


@pytest.fixture
def parent_and_kid(db: Session):
    """Create a parent and kid for testing."""
    auth = AuthService(db)

    parent = User(
        username="secparent",
        email="secparent@family.local",
        hashed_password=auth.get_password_hash("password123"),
        full_name="Security Parent",
        role=UserRole.PARENT,
        is_superuser=True,
    )
    kid = User(
        username="seckid1",
        email="seckid1@family.local",
        hashed_password=auth.get_password_hash("kidpass123"),
        full_name="Security Kid One",
        role=UserRole.KID,
    )
    db.add_all([parent, kid])
    db.commit()
    return parent, kid


def test_password_change_requires_current_password(client, db: Session, parent_and_kid):
    """Test that password change requires correct current password."""
    parent, kid = parent_and_kid

    # Login as parent
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "secparent", "password": "password123"},
    )
    assert login_response.status_code == 200, f"Login failed: {login_response.json()}"
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Try to change password with wrong current password
    response = client.post(
        "/api/v1/users/password",
        json={
            "current_password": "wrongpassword",
            "new_password": "newpassword123",
        },
        headers=headers,
    )
    assert response.status_code == 401
    assert "incorrect" in response.json()["detail"].lower()

    # Try to change password with correct current password
    response = client.post(
        "/api/v1/users/password",
        json={
            "current_password": "password123",
            "new_password": "newpassword123",
        },
        headers=headers,
    )
    assert response.status_code == 200

    # Verify new password works
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "secparent", "password": "newpassword123"},
    )
    assert login_response.status_code == 200


def test_kid_cannot_view_other_kids_profile(client, db: Session, parent_and_kid):
    """Test that kids cannot view other kids' profiles (IDOR fix)."""
    parent, kid = parent_and_kid

    # Create another kid
    auth = AuthService(db)
    kid2 = User(
        username="seckid2",
        email="seckid2@family.local",
        hashed_password=auth.get_password_hash("kidpass456"),
        full_name="Security Kid Two",
        role=UserRole.KID,
    )
    db.add(kid2)
    db.commit()

    # Login as kid1
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "seckid1", "password": "kidpass123"},
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Kid1 can view their own profile
    response = client.get(f"/api/v1/users/{kid.id}", headers=headers)
    assert response.status_code == 200

    # Kid1 cannot view kid2's profile
    response = client.get(f"/api/v1/users/{kid2.id}", headers=headers)
    assert response.status_code == 403


def test_parent_can_view_any_profile(client, db: Session, parent_and_kid):
    """Test that parents can view any user profile."""
    parent, kid = parent_and_kid

    # Login as parent
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "secparent", "password": "password123"},
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Parent can view kid's profile
    response = client.get(f"/api/v1/users/{kid.id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["id"] == kid.id

    # Parent can view their own profile
    response = client.get(f"/api/v1/users/{parent.id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["id"] == parent.id
