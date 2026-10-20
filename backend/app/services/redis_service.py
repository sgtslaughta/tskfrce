"""
Redis service for TaaskMaaster.

This module provides Redis-based caching, session management, rate limiting,
and other performance optimizations for the application.
"""

import json
import os
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union

import redis
from redis import Redis
from redis.exceptions import RedisError

from app.core.logging import get_logger

logger = get_logger(__name__)


class RedisService:
    """
    Redis service for caching, sessions, and performance optimizations.
    
    This service provides:
    - Database query caching
    - User session management
    - API rate limiting
    - Gamification data caching
    - Task state caching
    - Real-time data storage
    """

    def __init__(self):
        """Initialize Redis client with connection pooling."""
        try:
            redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
            self.client = Redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30,
            )
            # Test connection
            self.client.ping()
            logger.info("Redis service initialized successfully")
            self._available = True
        except (RedisError, ConnectionError) as e:
            logger.warning(f"Redis service not available: {e}")
            self._available = False
            self.client = None

    @property
    def available(self) -> bool:
        """Check if Redis is available."""
        return self._available and self.client is not None

    def _serialize(self, data: Any) -> str:
        """Serialize data to JSON string."""
        if isinstance(data, (datetime, timedelta)):
            return json.dumps(data, default=str)
        return json.dumps(data)

    def _deserialize(self, data: str) -> Any:
        """Deserialize JSON string to Python object."""
        try:
            return json.loads(data)
        except (json.JSONDecodeError, TypeError):
            return data

    # ==================== CACHING OPERATIONS ====================

    def cache_get(self, key: str, default: Any = None) -> Any:
        """
        Get cached data by key.
        
        Args:
            key: Cache key
            default: Default value if key not found
            
        Returns:
            Cached data or default value
        """
        if not self.available:
            return default
        
        try:
            data = self.client.get(key)
            return self._deserialize(data) if data else default
        except RedisError as e:
            logger.error(f"Redis cache get error: {e}")
            return default

    def cache_set(
        self, 
        key: str, 
        value: Any, 
        expire: Optional[int] = 3600
    ) -> bool:
        """
        Set cached data with optional expiration.
        
        Args:
            key: Cache key
            value: Data to cache
            expire: Expiration time in seconds (default: 1 hour)
            
        Returns:
            True if successful, False otherwise
        """
        if not self.available:
            return False
        
        try:
            serialized = self._serialize(value)
            if expire:
                return self.client.setex(key, expire, serialized)
            else:
                return self.client.set(key, serialized)
        except RedisError as e:
            logger.error(f"Redis cache set error: {e}")
            return False

    def cache_delete(self, key: str) -> bool:
        """Delete cached data by key."""
        if not self.available:
            return False
        
        try:
            return bool(self.client.delete(key))
        except RedisError as e:
            logger.error(f"Redis cache delete error: {e}")
            return False

    def cache_delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern."""
        if not self.available:
            return 0
        
        try:
            keys = self.client.keys(pattern)
            if keys:
                return self.client.delete(*keys)
            return 0
        except RedisError as e:
            logger.error(f"Redis cache delete pattern error: {e}")
            return 0

    # ==================== SESSION MANAGEMENT ====================

    def set_session(
        self, 
        session_id: str, 
        user_data: Dict[str, Any], 
        expire: int = 3600
    ) -> bool:
        """
        Store user session data.
        
        Args:
            session_id: Unique session identifier
            user_data: User session data
            expire: Session expiration time in seconds
            
        Returns:
            True if successful, False otherwise
        """
        key = f"session:{session_id}"
        return self.cache_set(key, user_data, expire)

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get user session data."""
        key = f"session:{session_id}"
        return self.cache_get(key)

    def delete_session(self, session_id: str) -> bool:
        """Delete user session."""
        key = f"session:{session_id}"
        return self.cache_delete(key)

    def refresh_session(self, session_id: str, expire: int = 3600) -> bool:
        """Refresh session expiration time."""
        if not self.available:
            return False
        
        try:
            key = f"session:{session_id}"
            return bool(self.client.expire(key, expire))
        except RedisError as e:
            logger.error(f"Redis session refresh error: {e}")
            return False

    # ==================== RATE LIMITING ====================

    def check_rate_limit(
        self, 
        identifier: str, 
        max_requests: int, 
        window: int
    ) -> Dict[str, Any]:
        """
        Check and update rate limit for an identifier.
        
        Args:
            identifier: Rate limit identifier (IP, user_id, etc.)
            max_requests: Maximum requests allowed in window
            window: Time window in seconds
            
        Returns:
            Rate limit status dictionary
        """
        if not self.available:
            return {"allowed": True, "remaining": max_requests, "reset": 0}
        
        try:
            key = f"rate_limit:{identifier}"
            current = self.client.get(key)
            
            if current is None:
                # First request in window
                self.client.setex(key, window, 1)
                return {
                    "allowed": True,
                    "remaining": max_requests - 1,
                    "reset": int(time.time()) + window
                }
            
            current_count = int(current)
            if current_count >= max_requests:
                # Rate limit exceeded
                ttl = self.client.ttl(key)
                return {
                    "allowed": False,
                    "remaining": 0,
                    "reset": int(time.time()) + ttl
                }
            
            # Increment counter
            self.client.incr(key)
            return {
                "allowed": True,
                "remaining": max_requests - current_count - 1,
                "reset": int(time.time()) + self.client.ttl(key)
            }
            
        except RedisError as e:
            logger.error(f"Redis rate limit error: {e}")
            return {"allowed": True, "remaining": max_requests, "reset": 0}

    # ==================== GAMIFICATION CACHING ====================

    def cache_user_points(self, user_id: int, points: int) -> bool:
        """Cache user points for gamification."""
        key = f"user_points:{user_id}"
        return self.cache_set(key, points, expire=1800)  # 30 minutes

    def get_user_points(self, user_id: int) -> Optional[int]:
        """Get cached user points."""
        key = f"user_points:{user_id}"
        return self.cache_get(key)

    def cache_leaderboard(self, leaderboard_data: List[Dict[str, Any]]) -> bool:
        """Cache leaderboard data."""
        key = "leaderboard:global"
        return self.cache_set(key, leaderboard_data, expire=300)  # 5 minutes

    def get_leaderboard(self) -> Optional[List[Dict[str, Any]]]:
        """Get cached leaderboard data."""
        key = "leaderboard:global"
        return self.cache_get(key)

    def cache_achievements(self, user_id: int, achievements: List[Dict[str, Any]]) -> bool:
        """Cache user achievements."""
        key = f"user_achievements:{user_id}"
        return self.cache_set(key, achievements, expire=3600)  # 1 hour

    def get_achievements(self, user_id: int) -> Optional[List[Dict[str, Any]]]:
        """Get cached user achievements."""
        key = f"user_achievements:{user_id}"
        return self.cache_get(key)

    # ==================== TASK CACHING ====================

    def cache_user_tasks(self, user_id: int, tasks: List[Dict[str, Any]]) -> bool:
        """Cache user tasks."""
        key = f"user_tasks:{user_id}"
        return self.cache_set(key, tasks, expire=600)  # 10 minutes

    def get_user_tasks(self, user_id: int) -> Optional[List[Dict[str, Any]]]:
        """Get cached user tasks."""
        key = f"user_tasks:{user_id}"
        return self.cache_get(key)

    def cache_task_details(self, task_id: int, task_data: Dict[str, Any]) -> bool:
        """Cache individual task details."""
        key = f"task:{task_id}"
        return self.cache_set(key, task_data, expire=1800)  # 30 minutes

    def get_task_details(self, task_id: int) -> Optional[Dict[str, Any]]:
        """Get cached task details."""
        key = f"task:{task_id}"
        return self.cache_get(key)

    def invalidate_task_cache(self, user_id: int, task_id: Optional[int] = None) -> bool:
        """Invalidate task-related cache."""
        if not self.available:
            return False
        
        try:
            # Delete user tasks cache
            self.cache_delete(f"user_tasks:{user_id}")
            
            # Delete specific task cache if provided
            if task_id:
                self.cache_delete(f"task:{task_id}")
            
            return True
        except RedisError as e:
            logger.error(f"Redis task cache invalidation error: {e}")
            return False

    # ==================== REAL-TIME FEATURES ====================

    def publish_event(self, channel: str, message: Dict[str, Any]) -> bool:
        """Publish event to Redis channel for real-time updates."""
        if not self.available:
            return False
        
        try:
            serialized = self._serialize(message)
            return bool(self.client.publish(channel, serialized))
        except RedisError as e:
            logger.error(f"Redis publish error: {e}")
            return False

    def subscribe_to_channel(self, channel: str) -> Optional[redis.client.PubSub]:
        """Subscribe to Redis channel for real-time updates."""
        if not self.available:
            return None
        
        try:
            pubsub = self.client.pubsub()
            pubsub.subscribe(channel)
            return pubsub
        except RedisError as e:
            logger.error(f"Redis subscribe error: {e}")
            return None

    # ==================== UTILITY METHODS ====================

    def get_stats(self) -> Dict[str, Any]:
        """Get Redis statistics."""
        if not self.available:
            return {"available": False, "error": "Redis not available"}
        
        try:
            info = self.client.info()
            return {
                "available": True,
                "connected_clients": info.get("connected_clients", 0),
                "used_memory_human": info.get("used_memory_human", "0B"),
                "total_commands_processed": info.get("total_commands_processed", 0),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
            }
        except RedisError as e:
            logger.error(f"Redis stats error: {e}")
            return {"available": False, "error": str(e)}

    def clear_all(self) -> bool:
        """Clear all Redis data (use with caution)."""
        if not self.available:
            return False
        
        try:
            self.client.flushdb()
            logger.info("Redis database cleared")
            return True
        except RedisError as e:
            logger.error(f"Redis clear error: {e}")
            return False

    def health_check(self) -> bool:
        """Check Redis health."""
        if not self.available:
            return False
        
        try:
            return self.client.ping()
        except RedisError:
            return False


# Global Redis service instance
redis_service = RedisService()
