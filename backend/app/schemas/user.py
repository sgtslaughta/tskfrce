"""
User schemas for TaaskMaaster.

This module contains Pydantic schemas for user-related API operations.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class UserBase(BaseModel):
    """Base user schema with common fields."""

    username: str = Field(..., min_length=3, max_length=50, description="Unique username")
    email: EmailStr = Field(..., description="User email address")
    full_name: str | None = Field(None, max_length=255, description="User's full name")
    timezone: str = Field(default="UTC", description="User's timezone")


class UserCreate(UserBase):
    """Schema for creating a new user."""

    password: str = Field(..., min_length=8, description="User password")
    role: UserRole | None = Field(default=UserRole.USER, description="User role")


class UserUpdate(BaseModel):
    """Schema for updating user information."""

    username: str | None = Field(None, min_length=3, max_length=50)
    email: EmailStr | None = None
    full_name: str | None = Field(None, max_length=255)
    timezone: str | None = None
    profile_picture: str | None = Field(None, max_length=500)
    preferences: str | None = None
    is_active: bool | None = None


class UserResponse(UserBase):
    """Schema for user response data."""

    id: int
    role: UserRole
    is_active: bool
    is_superuser: bool
    profile_picture: str | None = None
    preferences: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserList(BaseModel):
    """Schema for user list response."""

    users: list[UserResponse]
    total: int
    page: int
    size: int
    pages: int


class UserLogin(BaseModel):
    """Schema for user login."""

    username: str = Field(..., description="Username or email")
    password: str = Field(..., description="User password")


class UserPasswordChange(BaseModel):
    """Schema for password change."""

    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")
