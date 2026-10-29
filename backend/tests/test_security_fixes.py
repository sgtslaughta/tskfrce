"""Test security fixes and nudges for shared devices without PINs."""

import pytest
from app.core.auth import AuthService
from app.models.user import User, UserRole
from sqlalchemy.orm import Session


@pytest.fixture
def parent_and_kids(db: Session):
    """Create a parent and multiple kids for testing."""
    auth = AuthService(db)

    parent = User(
        username="secparent",
        email="secparent@family.local",
        hashed_password=auth.get_password_hash("password123"),
        full_name="Security Parent",
        role=UserRole.PARENT,
        is_superuser=True,
    )
    kid1 = User(
        username="seckid1",
        email="seckid1@family.local",
        hashed_password=auth.get_password_hash("kidpass123"),
        full_name="Leo",
        role=UserRole.KID,
    )
    kid2 = User(
        username="seckid2",
        email="seckid2@family.local",
        hashed_password=auth.get_password_hash("kidpass456"),
        full_name="Maya",
        role=UserRole.KID,
        pin_hash=auth.get_password_hash("1234"),  # kid2 has a PIN
    )
    db.add_all([parent, kid1, kid2])
    db.commit()
    return parent, kid1, kid2


def test_password_change_requires_current_password(client, db: Session, parent_and_kids):
    """Test that password change requires correct current password."""
    parent, kid1, kid2 = parent_and_kids

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


def test_kid_cannot_view_other_kids_profile(client, db: Session, parent_and_kids):
    """Test that kids cannot view other kids' profiles (IDOR fix)."""
    parent, kid1, kid2 = parent_and_kids

    # Login as kid1
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "seckid1", "password": "kidpass123"},
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Kid1 can view their own profile
    response = client.get(f"/api/v1/users/{kid1.id}", headers=headers)
    assert response.status_code == 200

    # Kid1 cannot view kid2's profile
    response = client.get(f"/api/v1/users/{kid2.id}", headers=headers)
    assert response.status_code == 403


def test_parent_can_view_any_profile(client, db: Session, parent_and_kids):
    """Test that parents can view any user profile."""
    parent, kid1, kid2 = parent_and_kids

    # Login as parent
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "secparent", "password": "password123"},
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Parent can view kid1's profile
    response = client.get(f"/api/v1/users/{kid1.id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["id"] == kid1.id

    # Parent can view their own profile
    response = client.get(f"/api/v1/users/{parent.id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["id"] == parent.id
