"""Reward request schemas."""

from pydantic import BaseModel, Field

from app.schemas.glyph import Glyph


class RewardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    price: int = Field(ge=1, le=100000)
    icon: Glyph | None = None
    visible: bool = True
    needs_approval: bool = True


class RewardPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    price: int | None = Field(default=None, ge=1, le=100000)
    icon: Glyph | None = None
    visible: bool | None = None
    needs_approval: bool | None = None


class DecideIn(BaseModel):
    note: str | None = Field(default=None, max_length=200)
