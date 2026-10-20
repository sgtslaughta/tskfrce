"""
Authentication schemas for TaaskMaaster.

This module contains Pydantic schemas for authentication-related API operations.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field
from app.models.user import UserRole


class Token(BaseModel):
    """Schema for JWT token response."""

    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(
        ..., description="Token expiration time in seconds"
    )


class TokenData(BaseModel):
    """Schema for JWT token payload data."""

    user_id: Optional[int] = None
    username: Optional[str] = None
    email: Optional[str] = None


class LoginRequest(BaseModel):
    """Schema for login request."""

    username: str = Field(..., description="Username or email")
    password: str = Field(..., description="Password")


class LoginResponse(BaseModel):
    """Schema for login response."""

    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(
        ..., description="Access token expiration time in seconds"
    )
    refresh_expires_in: int = Field(
        ..., description="Refresh token expiration time in seconds"
    )
    user_id: int = Field(..., description="User ID")
    username: str = Field(..., description="Username")
    email: str = Field(..., description="Email")
    full_name: Optional[str] = Field(None, description="Full name")
    role: UserRole = Field(..., description="User role")
    is_active: bool = Field(..., description="User active status")
    is_superuser: bool = Field(..., description="Superuser status")


class RefreshTokenRequest(BaseModel):
    """Schema for refresh token request."""

    refresh_token: str = Field(..., description="JWT refresh token")


class RefreshTokenResponse(BaseModel):
    """Schema for refresh token response."""

    access_token: str = Field(..., description="New JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(
        ..., description="Token expiration time in seconds"
    )


class LogoutResponse(BaseModel):
    """Schema for logout response."""

    message: str = Field(
        default="Successfully logged out", description="Logout message"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="Logout timestamp"
    )
