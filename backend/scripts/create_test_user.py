#!/usr/bin/env python3
"""
Script to create a test user for TaaskMaaster.

This script creates a test user with admin privileges for development and testing.
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.db.session import get_db_session
from app.schemas.user import UserCreate
from app.services.user_service import UserService
from app.models.user import UserRole


def create_test_users():
    """Create test users for development and testing."""

    # Test users data
    test_users_data = [
        {
            "user_data": UserCreate(
                username="admin",
                email="admin@taaskmaaster.com",
                full_name="Administrator",
                password="admin123",
                timezone="UTC",
                role=UserRole.ADMIN,
            ),
            "is_superuser": True,
            "is_active": True,
            "description": "Admin user with full privileges"
        },
        {
            "user_data": UserCreate(
                username="testuser",
                email="testuser@taaskmaaster.com",
                full_name="Test User",
                password="testuser123",
                timezone="UTC",
                role=UserRole.ORGANIZER,
            ),
            "is_superuser": False,
            "is_active": True,
            "description": "Organizer test user for messaging and notifications"
        }
    ]

    created_users = []
    
    try:
        # Get database session
        db = next(get_db_session())
        user_service = UserService(db)

        print("Creating test users...")
        print("=" * 50)

        for user_info in test_users_data:
            user_data = user_info["user_data"]
            
            # Check if user already exists
            existing_user = user_service.get_user_by_username(user_data.username)
            if existing_user:
                print(f"✓ User '{user_data.username}' already exists")
                print(f"   Email: {existing_user.email}")
                print(f"   Full Name: {existing_user.full_name}")
                print(f"   Is Superuser: {existing_user.is_superuser}")
                print(f"   User ID: {existing_user.id}")
                created_users.append(existing_user)
                print()
                continue

            # Create the user
            user = user_service.create_user(user_data)

            # Set user privileges
            user.is_superuser = user_info["is_superuser"]
            user.is_active = user_info["is_active"]
            db.commit()

            created_users.append(user)
            
            print(f"✅ Created {user_info['description']}")
            print(f"   Username: {user.username}")
            print(f"   Email: {user.email}")
            print(f"   Full Name: {user.full_name}")
            print(f"   Is Superuser: {user.is_superuser}")
            print(f"   Is Active: {user.is_active}")
            print(f"   User ID: {user.id}")
            print()

        print("=" * 50)
        print("✅ Test users setup completed!")
        print(f"Total users available: {len(created_users)}")
        print()
        print("Login credentials:")
        for user_info in test_users_data:
            user_data = user_info["user_data"]
            print(f"  {user_data.username}: {user_data.password}")

    except Exception as e:
        print(f"❌ Error creating test users: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    print("Creating test users for TaaskMaaster...")
    create_test_users()
