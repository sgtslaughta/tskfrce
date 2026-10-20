"""
API package for TaaskMaaster.

This package contains all API endpoints and routers.
"""

from .auth import router as auth_router
from .comments import router as comments_router
from .gamification import router as gamification_router
from .goals import router as goals_router
from .lists import router as lists_router
from .media import router as media_router
from .mentions import router as mentions_router
from .messaging import router as messaging_router
from .presence import router as presence_router
from .redis import router as redis_router
from .tasks import router as tasks_router
from .users import router as users_router
from .websocket import router as websocket_router
from .workflow import router as workflow_router

__all__ = [
    "auth_router",
    "tasks_router",
    "goals_router",
    "gamification_router",
    "lists_router",
    "media_router",
    "users_router",
    "comments_router",
    "mentions_router",
    "messaging_router",
    "presence_router",
    "websocket_router",
    "workflow_router",
]
