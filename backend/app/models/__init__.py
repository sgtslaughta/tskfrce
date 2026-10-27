"""
Database models for TaaskMaaster.

This package contains all SQLAlchemy models for the application.
"""

from .badge import BadgeAward, CustomBadge
from .chat import ChatPhoto, MessageReaction, Thread, ThreadMessage, ThreadRead
from .chore_extra import ChorePhoto
from .chore_type import ChoreType, ChoreTypeNote
from .chores import Chore, ChoreAssignment, ChoreRun, ChoreSeen, ChoreStep, RunStepTick
from .device_activity import DeviceEvent, DevicePresence
from .family import FamilySettings, get_family
from .flair import KidFlair
from .hours import HourRule, HourRuleTarget, HourRuleTime
from .inbox import Notification
from .lock import Device, DeviceGroup, Override
from .notify import NotifyHeld, NotifyPlace
from .password_reset import PasswordReset
from .points import Points, PointsType
from .reward import Redemption, Reward
from .screen_time import ScreenTimeLimit
from .tips import DismissedTip
from .user import PendingInvite, UsedInvite, User

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
    "PendingInvite",
    "UsedInvite",
    "User",
    "FamilySettings",
    "get_family",
    "PasswordReset",
    "Points",
    "PointsType",
    "Device",
    "DeviceGroup",
    "HourRule",
    "HourRuleTime",
    "HourRuleTarget",
    "DeviceEvent",
    "DevicePresence",
    "Override",
    "Notification",
    "NotifyPlace",
    "NotifyHeld",
    "Reward",
    "Redemption",
    "ScreenTimeLimit",
    "DismissedTip",
]
