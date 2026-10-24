"""Reward request schemas."""

from pydantic import BaseModel, Field


class RewardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    price: int = Field(ge=1, le=100000)
    icon: str | None = Field(default=None, max_length=8)


class RewardPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    price: int | None = Field(default=None, ge=1, le=100000)
    icon: str | None = Field(default=None, max_length=8)
