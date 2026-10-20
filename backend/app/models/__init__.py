"""
Database models for TaaskMaaster.

This package contains all SQLAlchemy models for the application.
"""

# Import from new model files
from .task_comment import TaskComment, CommentReaction, CommentMention, CommentMediaAttachment
from .direct_message import DirectMessage, MessageReaction
from .conversation import Conversation, ConversationSettings

# Import from existing comment.py - models that are unique to comment.py
from .comment import (
    CommentAuditTrail, TaskStatusHistory, UserStatus,
    TaskChatMessage, MessageReadReceipt, DirectMessageMedia, TaskChatMessageMedia
)
from .gamification import Achievement, Leaderboard, Points, UserAchievement
from .goal import Goal, GoalProgress
from .media import MediaAttachment
from .notification import Notification
from .task import Task, TaskCategory, TaskDependency, TaskTag, TaskTemplate
from .user import User

__all__ = [
    # Core models
    "User",
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
