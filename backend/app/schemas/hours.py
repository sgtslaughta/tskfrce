"""Request bodies for the hour rules API."""

import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.lock import _hhmm


class TimeRange(BaseModel):
    start: str
    end: str

    _times = field_validator("start", "end")(_hhmm)


class RuleIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    category: Literal["holiday", "summer", "weekend", "school_night", "other"]
    kind: Literal["allowed", "free", "off"]
    days: str
    start_date: date | None = None
    end_date: date | None = None
    everyone: bool = False
    kid_ids: list[int] = []
    group_ids: list[int] = []
    times: list[TimeRange] = Field(min_length=1, max_length=6)

    @field_validator("days")
    @classmethod
    def _days(cls, v):
        if not (1 <= len(v) <= 7 and len(set(v)) == len(v) and re.fullmatch(r"[0-6]+", v)):
            raise ValueError("Days must be 1-7 different digits from 0 (Mon) to 6 (Sun).")
        return v
