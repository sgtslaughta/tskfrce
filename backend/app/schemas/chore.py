"""Chore request/response schemas."""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.lock import _hhmm


class Repeat(BaseModel):
    type: Literal["daily", "weekly", "once"]
    days: list[int] = Field(default_factory=list, max_length=7)  # 0=Mon..6=Sun

    @field_validator("days")
    @classmethod
    def _days(cls, v: list[int]) -> list[int]:
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("Days are 0 (Mon) to 6 (Sun).")
        return sorted(set(v))

    @model_validator(mode="after")
    def _weekly_needs_days(self):
        if self.type == "weekly" and not self.days:
            raise ValueError("Pick at least one day.")
        return self


Step = Annotated[str, Field(min_length=1, max_length=100)]


class ChoreIn(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    points: int = Field(default=10, ge=0)
    needs_photo: bool = False
    steps: list[Step] = Field(default_factory=list, max_length=20)


class ChorePatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    points: int | None = Field(default=None, ge=0)
    needs_photo: bool | None = None
    steps: list[Step] | None = Field(default=None, max_length=20)


class AssignmentIn(BaseModel):
    kid_ids: list[int] = Field(min_length=1)
    mode: Literal["each", "race", "team"] = "each"
    repeat: Repeat
    on_date: date | None = None
    due_time: str | None = None

    _due = field_validator("due_time")(_hhmm)


class AssignmentPatch(BaseModel):
    kid_ids: list[int] | None = Field(default=None, min_length=1)
    mode: Literal["each", "race", "team"] | None = None
    repeat: Repeat | None = None
    on_date: date | None = None
    due_time: str | None = None

    _due = field_validator("due_time")(_hhmm)


class AssignmentOut(BaseModel):
    id: int
    chore_id: int
    kid_ids: list[int]
    mode: str
    repeat: Repeat
    on_date: date | None
    due_time: str | None
    active: bool


class StepOut(BaseModel):
    id: int
    title: str


class ChoreLibOut(BaseModel):
    id: int
    title: str
    points: int
    needs_photo: bool
    steps: list[StepOut]
    assignments: list[AssignmentOut]
    archived: bool


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
