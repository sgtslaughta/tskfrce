"""
Authentication API router for TaaskMaaster.

This module contains API endpoints for authentication and authorization.
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import AuthService, get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
)

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


@router.post(
    "/login", response_model=LoginResponse, status_code=status.HTTP_200_OK
)
async def login(
    login_data: LoginRequest, db: Session = Depends(get_db_session)
):
    """
    Authenticate a user and return JWT tokens.

    Args:
        login_data: Login credentials
        db: Database session

    Returns:
        Login response with JWT tokens and user info

    Raises:
        HTTPException: If authentication fails
    """
    auth_service = AuthService(db)
    user = auth_service.authenticate_user(
        login_data.username, login_data.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    access_token_expires = timedelta(minutes=30)
    access_token = auth_service.create_access_token(
        data={
            "sub": str(user.id),
            "username": user.username,
            "email": user.email,
        },
        expires_delta=access_token_expires,
    )

    # Create refresh token
    refresh_token_expires = timedelta(days=7)
    refresh_token = auth_service.create_refresh_token(
        data={
            "sub": str(user.id),
            "username": user.username,
            "email": user.email,
        },
        expires_delta=refresh_token_expires,
    )

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=30 * 60,  # 30 minutes in seconds
        refresh_expires_in=7 * 24 * 60 * 60,  # 7 days in seconds
        user_id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
    )


@router.post(
    "/refresh",
    response_model=RefreshTokenResponse,
    status_code=status.HTTP_200_OK,
)
async def refresh_token(
    refresh_data: RefreshTokenRequest, db: Session = Depends(get_db_session)
):
    """
    Refresh an access token using a refresh token.

    Args:
        refresh_data: Refresh token data
        db: Database session

    Returns:
        New access token

    Raises:
        HTTPException: If refresh token is invalid
    """
    auth_service = AuthService(db)

    # Verify refresh token
    payload = auth_service.verify_token(refresh_data.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user from token
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = auth_service.user_service.get_user(int(user_id))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create new access token
    access_token_expires = timedelta(minutes=30)
    access_token = auth_service.create_access_token(
        data={
            "sub": str(user.id),
            "username": user.username,
            "email": user.email,
        },
        expires_delta=access_token_expires,
    )

    return RefreshTokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=30 * 60,  # 30 minutes in seconds
    )


@router.post(
    "/logout", response_model=LogoutResponse, status_code=status.HTTP_200_OK
)
async def logout(current_user: User = Depends(get_current_user)):
    """
    Logout the current user.

    Note: In a stateless JWT system, the client is responsible for removing
    the token. This endpoint can be used for logging purposes or to invalidate
    tokens in a token blacklist if implemented.

    Args:
        current_user: Current authenticated user

    Returns:
        Logout confirmation message
    """
    # In a real implementation, you might want to add the token to a blacklist
    # or implement token revocation logic here

    return LogoutResponse(
        message=f"Successfully logged out user {current_user.username}",
    )


@router.get("/me", response_model=dict, status_code=status.HTTP_200_OK)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """
    Get current user information.

    Args:
        current_user: Current authenticated user

    Returns:
        Current user information
    """
    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "is_superuser": current_user.is_superuser,
        "timezone": current_user.timezone,
        "created_at": (
            current_user.created_at.isoformat()
            if current_user.created_at
            else None
        ),
        "updated_at": (
            current_user.updated_at.isoformat()
            if current_user.updated_at
            else None
        ),
    }
