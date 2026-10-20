"""
Database models for TaaskMaaster.

This package contains all SQLAlchemy models for the application.
"""

# Import from new model files
# Import from existing comment.py - models that are unique to comment.py
from .comment import (
    CommentAuditTrail,
    DirectMessageMedia,
    MessageReadReceipt,
    TaskChatMessage,
    TaskChatMessageMedia,
    TaskStatusHistory,
    UserStatus,
)
from .conversation import Conversation, ConversationSettings
from .direct_message import DirectMessage, MessageReaction
from .family import FamilySettings, get_family
from .gamification import (
    Achievement,
    Leaderboard,
    LeaderboardEntry,
    Points,
    Streak,
    UserAchievement,
)
from .goal import Goal, GoalProgress
from .media import MediaAttachment
from .notification import Notification
from .task import (
    Task,
    TaskCategory,
    TaskDependency,
    TaskList,
    TaskListAssociation,
    TaskTag,
    TaskTagAssociation,
    TaskTemplate,
)
from .task_comment import CommentMediaAttachment, CommentMention, CommentReaction, TaskComment
from .user import User

__all__ = [
    # Core models
    "User",
    "FamilySettings",
    "get_family",
    "Task",
    "TaskTemplate",
    "TaskCategory",
    "TaskTag",
    "TaskDependency",
    "Goal",
    "GoalProgress",
    "Achievement",
    "UserAchievement",
    "Points",
    "Leaderboard",
    "LeaderboardEntry",
    "Streak",
    "TaskList",
    "TaskListAssociation",
    "TaskTagAssociation",
    "MediaAttachment",
    "Notification",
    # Comment and messaging models
    "TaskComment",
    "CommentReaction",
    "CommentMention",
    "CommentMediaAttachment",
    "DirectMessage",
    "MessageReaction",
    "Conversation",
    "ConversationSettings",
    # Additional comment models
    "CommentAuditTrail",
    "TaskStatusHistory",
    "UserStatus",
    "TaskChatMessage",
    "MessageReadReceipt",
    "DirectMessageMedia",
    "TaskChatMessageMedia",
]
