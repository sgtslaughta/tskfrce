"""
Database models for TaaskMaaster.

This package contains all SQLAlchemy models for the application.
"""

from .badge import BadgeAward, CustomBadge
from .chat import ChatPhoto, MessageReaction, Thread, ThreadMessage, ThreadRead
from .chore_extra import ChorePhoto
from .chore_type import ChoreType, ChoreTypeNote
from .chores import Chore, ChoreAssignment, ChoreRun, ChoreSeen, ChoreStep, RunStepTick
from .family import FamilySettings, get_family
from .flair import KidFlair
from .inbox import Notification
from .lock import Device, DeviceGroup, Override, TimeWindow
from .password_reset import PasswordReset
from .points import Points, PointsType
from .reward import Redemption, Reward
from .screen_time import ScreenTimeLimit
from .tips import DismissedTip
from .user import UsedInvite, User

__all__ = [
    "BadgeAward",
    "KidFlair",
    "CustomBadge",
    "ChatPhoto",
    "MessageReaction",
    "Thread",
    "ThreadMessage",
    "ThreadRead",
    "ChorePhoto",
    "Chore",
    "ChoreType",
    "ChoreTypeNote",
    "ChoreStep",
    "ChoreAssignment",
    "ChoreRun",
    "RunStepTick",
    "ChoreSeen",
    "UsedInvite",
    "User",
    "FamilySettings",
    "get_family",
    "PasswordReset",
    "Points",
    "PointsType",
    "Device",
    "DeviceGroup",
    "TimeWindow",
    "Override",
    "Notification",
    "Reward",
    "Redemption",
    "ScreenTimeLimit",
    "DismissedTip",
]
