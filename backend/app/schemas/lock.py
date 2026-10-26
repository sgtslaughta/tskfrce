"""Request bodies for the parent lock APIs."""

import re
from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, field_validator

HHMM = r"([01]\d|2[0-3]):[0-5]\d"


def utc_z(dt: datetime | None) -> str | None:
    """Naive-UTC (or aware) datetime -> ISO string ending in Z."""
    if dt is None:
        return None
    dt = dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)
    return dt.isoformat().replace("+00:00", "Z")


def _hhmm(v: str | None) -> str | None:
    if v is not None and not re.fullmatch(HHMM, v):
        raise ValueError("Use 24-hour HH:MM, like 06:00.")
    return v


def _pin(v: str | None) -> str | None:
    if v is not None and not re.fullmatch(r"\d{4}", v):
        raise ValueError("PIN must be exactly 4 digits.")
    return v


class OverrideIn(BaseModel):
    action: Literal["lock", "unlock"]
    minutes: int | None = Field(default=None, ge=1, le=1440)


class DevicePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    status: Literal["unassigned", "assigned", "guest"] | None = None
    owner_ids: list[int] | None = None
    group_ids: list[int] | None = None


class GroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    device_ids: list[int] = []


class KidCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    avatar: str | None = Field(default=None, max_length=255)
    pin: str | None = None
    age_group: Literal["little", "kid", "teen"] | None = None

    _pin = field_validator("pin")(_pin)


class KidPatch(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    avatar: str | None = Field(default=None, max_length=255)
    pin: str | None = None
    clear_pin: bool = False
    age_group: Literal["little", "kid", "teen"] | None = None

    _pin = field_validator("pin")(_pin)


class WindowIn(BaseModel):
    kind: Literal["allowed", "free"]
    days: str
    start: str
    end: str
    kid_id: int | None = None
    group_id: int | None = None

    @field_validator("days")
    @classmethod
    def _days(cls, v):
        if not (1 <= len(v) <= 7 and len(set(v)) == len(v) and re.fullmatch(r"[0-6]+", v)):
            raise ValueError("Days must be 1-7 different digits from 0 (Mon) to 6 (Sun).")
        return v

    _times = field_validator("start", "end")(_hhmm)


class FamilyPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    timezone: str | None = None
    reset_time: str | None = None
    new_devices_blocked: bool | None = None
    points_unlock_early: bool | None = None
    early_bonus_cap: int | None = Field(default=None, ge=0, le=50)
    screen_time_price: int | None = Field(default=None, ge=1, le=1000)
    gifs_enabled: bool | None = None
    gif_rating: Literal["g", "pg"] | None = None
    ntfy_upstream_relay: bool | None = None
    quick_replies: (
        list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]]
        | None
    ) = Field(default=None, max_length=8)
    giphy_api_key: str | None = Field(default=None, max_length=100)  # "" clears
    accent: (
        Literal[
            "neon", "sun", "tangerine", "bubblegum", "lilac", "sky", "aqua", "mint", "peach", "ice"
        ]
        | None
    ) = None

    _rt = field_validator("reset_time")(_hhmm)
