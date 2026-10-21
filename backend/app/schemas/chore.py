"""Chore request/response schemas."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.lock import _hhmm


class Repeat(BaseModel):
    type: Literal["daily", "weekly", "once"]
    days: list[int] = Field(default_factory=list)  # 0=Mon..6=Sun


Subtask = Field(min_length=1, max_length=100)


class ChoreCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    kid_ids: list[int] = Field(min_length=1)
    mode: Literal["each", "race", "team"] = "each"
    points: int = 10
    repeat: Repeat
    needs_photo: bool = False
    due_time: str | None = None
    subtasks: list[Annotated[str, Subtask]] = Field(default_factory=list, max_length=20)

    _due = field_validator("due_time")(_hhmm)

    @model_validator(mode="before")
    @classmethod
    def _legacy_kid_id(cls, v):
        if isinstance(v, dict) and "kid_ids" not in v and "kid_id" in v:
            v = {**v, "kid_ids": [v["kid_id"]]}
        return v


class ChorePatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    kid_ids: list[int] | None = Field(default=None, min_length=1)
    mode: Literal["each", "race", "team"] | None = None
    points: int | None = None
    repeat: Repeat | None = None
    needs_photo: bool | None = None
    due_time: str | None = None
    subtasks: list[Annotated[str, Subtask]] | None = Field(default=None, max_length=20)

    _due = field_validator("due_time")(_hhmm)


class ChoreOut(BaseModel):
    id: int
    title: str
    kid_id: int | None
    kid_ids: list[int] = Field(default_factory=list)
    mode: str = "each"
    points: int
    status: str
    due_date: str | None = None
    needs_photo: bool = False
    due_time: str | None = None
    subtasks: list = Field(default_factory=list)
    attempt: int = 1
    last_note: str | None = None
    submitted_by_id: int | None = None
