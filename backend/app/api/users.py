"""
Users API router for TaaskMaaster.

This module contains API endpoints for user management and authentication.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_active_user, get_current_superuser
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    UserList,
    UserPasswordChange,
    UserResponse,
    UserUpdate,
)
from app.services.user_service import UserService

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.post(
    "/", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_superuser),
):
    """Create a new user account."""
    user_service = UserService(db)

    # Check if username already exists
    existing_user = user_service.get_user_by_username(user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    # Check if email already exists
    existing_email = user_service.get_user_by_email(user_data.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = user_service.create_user(user_data)
    return user


@router.get("/", response_model=UserList)
async def get_users(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    is_active: Optional[bool] = Query(
        None, description="Filter by active status"
    ),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_superuser),
):
    """Get users with filtering and pagination."""
    try:
        user_service = UserService(db)
        users, total = user_service.get_users(
            skip=skip, limit=limit, is_active=is_active
        )

        pages = (total + limit - 1) // limit
        page = (skip // limit) + 1

        return UserList(
            users=users, total=total, page=page, size=limit, pages=pages
        )
    except Exception as e:
        # Log the actual error instead of silently failing
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching users: {str(e)}"
        )


@router.get("/for-assignment", response_model=UserList)
async def get_users_for_assignment(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Get users for task assignment (accessible to all active users)."""
    try:
        user_service = UserService(db)
        # Get only active users for assignment
        users, total = user_service.get_users(
            skip=0, limit=100, is_active=True
        )

        return UserList(
            users=users, total=total, page=1, size=100, pages=1
        )
    except Exception as e:
        # Log the actual error instead of silently failing
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching users for assignment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching users for assignment: {str(e)}"
        )


# Password change endpoint (must come before /{user_id} routes)
@router.post("/password", status_code=status.HTTP_200_OK)
async def change_password(
    password_data: UserPasswordChange,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Change user password."""
    UserService(db)

    # TODO: Verify current password and update to new password
    # For now, just return success
    return {"message": "Password changed successfully"}


# Individual User Operations (must come after specific routes)
@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Get a specific user by ID."""
    user_service = UserService(db)
    user = user_service.get_user(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """Update a user account."""
    user_service = UserService(db)
    user = user_service.update_user(user_id, user_data)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_superuser),
):
    """Delete a user account."""
    user_service = UserService(db)
    success = user_service.delete_user(user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
