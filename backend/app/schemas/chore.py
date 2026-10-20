"""Chore request/response schemas."""

from typing import Literal

from pydantic import BaseModel, Field


class Repeat(BaseModel):
    type: Literal["daily", "weekly", "once"]
    days: list[int] = Field(default_factory=list)  # 0=Mon..6=Sun


class ChoreCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    kid_id: int
    points: int = 10
    repeat: Repeat
    needs_photo: bool = False


class ChoreOut(BaseModel):
    id: int
    title: str
    kid_id: int | None
    points: int
    status: str
    due_date: str | None = None
    needs_photo: bool = False
