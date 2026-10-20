"""
Enhanced rate limiting system for TaaskMaaster.

This module provides comprehensive rate limiting capabilities for API endpoints,
with special focus on comment creation, messaging, and bulk operations.
"""

import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
from enum import Enum

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.services.redis_service import redis_service

logger = get_logger(__name__)


class RateLimitType(str, Enum):
    """Rate limit types for different operations."""
    
    COMMENT_CREATION = "comment_creation"
    MESSAGE_SENDING = "message_sending"
    BULK_OPERATIONS = "bulk_operations"
    API_GENERAL = "api_general"
    WEBSOCKET_CONNECTIONS = "websocket_connections"
    MENTION_NOTIFICATIONS = "mention_notifications"
    FILE_UPLOADS = "file_uploads"


class RateLimitConfig:
    """Configuration for different rate limit types."""
    
    LIMITS = {
        RateLimitType.COMMENT_CREATION: {
            "requests": 30,
            "window": 60,  # 30 comments per minute
            "burst": 5,    # Allow burst of 5 comments
            "description": "Comment creation rate limit"
        },
        RateLimitType.MESSAGE_SENDING: {
            "requests": 60,
            "window": 60,  # 60 messages per minute
            "burst": 10,   # Allow burst of 10 messages
            "description": "Message sending rate limit"
        },
        RateLimitType.BULK_OPERATIONS: {
            "requests": 5,
            "window": 300,  # 5 bulk operations per 5 minutes
            "burst": 2,     # Allow burst of 2 operations
            "description": "Bulk operations rate limit"
        },
        RateLimitType.API_GENERAL: {
            "requests": 1000,
            "window": 60,   # 1000 requests per minute
            "burst": 50,    # Allow burst of 50 requests
            "description": "General API rate limit"
        },
        RateLimitType.WEBSOCKET_CONNECTIONS: {
            "requests": 10,
            "window": 60,   # 10 connection attempts per minute
            "burst": 3,     # Allow burst of 3 connections
            "description": "WebSocket connection rate limit"
        },
        RateLimitType.MENTION_NOTIFICATIONS: {
            "requests": 100,
            "window": 300,  # 100 mentions per 5 minutes
            "burst": 20,    # Allow burst of 20 mentions
            "description": "Mention notification rate limit"
        },
        RateLimitType.FILE_UPLOADS: {
            "requests": 20,
            "window": 300,  # 20 uploads per 5 minutes
            "burst": 5,     # Allow burst of 5 uploads
            "description": "File upload rate limit"
        }
    }


class RateLimiter:
    """
    Advanced rate limiter with Redis backend support.
    
    Features:
    - Sliding window rate limiting
    - Burst capacity handling
    - Per-user and per-IP rate limiting
    - Graceful fallback when Redis is unavailable
    """

    def __init__(self):
        """Initialize rate limiter."""
        self.redis_available = redis_service.available if redis_service else False
        self.memory_cache: Dict[str, Dict] = {}
        
        if not self.redis_available:
            logger.warning("Redis not available, using in-memory rate limiting")

    def _get_key(self, rate_limit_type: RateLimitType, identifier: str) -> str:
        """Generate cache key for rate limiting."""
        return f"rate_limit:{rate_limit_type.value}:{identifier}"

    def _get_window_start(self, window_seconds: int) -> int:
        """Get the start of the current time window."""
        now = int(time.time())
        return (now // window_seconds) * window_seconds

    async def check_rate_limit(
        self,
        rate_limit_type: RateLimitType,
        identifier: str,
        cost: int = 1
    ) -> Tuple[bool, Dict[str, int]]:
        """
        Check if request is within rate limit.

        Args:
            rate_limit_type: Type of rate limit to check
            identifier: Unique identifier (user_id, IP, etc.)
            cost: Cost of this request (default 1)

        Returns:
            Tuple of (allowed, rate_limit_info)
        """
        config = RateLimitConfig.LIMITS.get(rate_limit_type)
        if not config:
            logger.warning(f"No rate limit config for {rate_limit_type}")
            return True, {}

        key = self._get_key(rate_limit_type, identifier)
        window_start = self._get_window_start(config["window"])
        
        try:
            if self.redis_available:
                return await self._check_redis_rate_limit(
                    key, config, window_start, cost
                )
            else:
                return await self._check_memory_rate_limit(
                    key, config, window_start, cost
                )
        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            # Fail open - allow request if rate limiting fails
            return True, {}

    async def _check_redis_rate_limit(
        self,
        key: str,
        config: Dict,
        window_start: int,
        cost: int
    ) -> Tuple[bool, Dict[str, int]]:
        """Check rate limit using Redis."""
        redis = redis_service.get_client()
        
        # Use Redis pipeline for atomic operations
        pipe = redis.pipeline()
        
        # Get current count
        current_key = f"{key}:{window_start}"
        pipe.get(current_key)
        pipe.ttl(current_key)
        
        results = pipe.execute()
        current_count = int(results[0] or 0)
        ttl = results[1]
        
        # Check if within limits
        max_requests = config["requests"]
        burst_limit = config.get("burst", max_requests)
        
        # Allow burst if current count is low
        effective_limit = max_requests
        if current_count < (max_requests * 0.5):  # If less than 50% used
            effective_limit = min(max_requests + burst_limit, max_requests * 2)
        
        new_count = current_count + cost
        allowed = new_count <= effective_limit
        
        if allowed:
            # Increment counter
            pipe = redis.pipeline()
            pipe.incr(current_key, cost)
            if ttl == -1:  # No expiration set
                pipe.expire(current_key, config["window"])
            pipe.execute()
        
        rate_limit_info = {
            "limit": max_requests,
            "remaining": max(0, effective_limit - new_count),
            "reset": window_start + config["window"],
            "retry_after": config["window"] if not allowed else 0
        }
        
        return allowed, rate_limit_info

    async def _check_memory_rate_limit(
        self,
        key: str,
        config: Dict,
        window_start: int,
        cost: int
    ) -> Tuple[bool, Dict[str, int]]:
        """Check rate limit using in-memory cache."""
        now = int(time.time())
        
        # Clean up old entries
        self._cleanup_memory_cache(now)
        
        if key not in self.memory_cache:
            self.memory_cache[key] = {
                "count": 0,
                "window_start": window_start,
                "last_reset": now
            }
        
        cache_entry = self.memory_cache[key]
        
        # Reset if new window
        if cache_entry["window_start"] != window_start:
            cache_entry["count"] = 0
            cache_entry["window_start"] = window_start
            cache_entry["last_reset"] = now
        
        # Check limits
        max_requests = config["requests"]
        burst_limit = config.get("burst", max_requests)
        
        effective_limit = max_requests
        if cache_entry["count"] < (max_requests * 0.5):
            effective_limit = min(max_requests + burst_limit, max_requests * 2)
        
        new_count = cache_entry["count"] + cost
        allowed = new_count <= effective_limit
        
        if allowed:
            cache_entry["count"] = new_count
        
        rate_limit_info = {
            "limit": max_requests,
            "remaining": max(0, effective_limit - new_count),
            "reset": window_start + config["window"],
            "retry_after": config["window"] if not allowed else 0
        }
        
        return allowed, rate_limit_info

    def _cleanup_memory_cache(self, now: int):
        """Clean up old entries from memory cache."""
        keys_to_remove = []
        for key, entry in self.memory_cache.items():
            if now - entry["last_reset"] > 3600:  # Remove entries older than 1 hour
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self.memory_cache[key]

    async def get_rate_limit_status(
        self,
        rate_limit_type: RateLimitType,
        identifier: str
    ) -> Dict[str, int]:
        """
        Get current rate limit status without consuming quota.

        Args:
            rate_limit_type: Type of rate limit to check
            identifier: Unique identifier

        Returns:
            Rate limit status information
        """
        config = RateLimitConfig.LIMITS.get(rate_limit_type)
        if not config:
            return {}

        key = self._get_key(rate_limit_type, identifier)
        window_start = self._get_window_start(config["window"])
        
        try:
            if self.redis_available:
                redis = redis_service.get_client()
                current_key = f"{key}:{window_start}"
                current_count = int(redis.get(current_key) or 0)
            else:
                cache_entry = self.memory_cache.get(key, {"count": 0})
                current_count = cache_entry["count"]
            
            max_requests = config["requests"]
            
            return {
                "limit": max_requests,
                "remaining": max(0, max_requests - current_count),
                "reset": window_start + config["window"],
                "window": config["window"]
            }
        except Exception as e:
            logger.error(f"Failed to get rate limit status: {e}")
            return {}


# Global rate limiter instance
rate_limiter = RateLimiter()


def get_client_identifier(request: Request) -> str:
    """
    Get client identifier for rate limiting.
    
    Priority:
    1. User ID from X-User-Data header
    2. IP address from request
    3. Fallback identifier
    """
    try:
        # Try to get user ID from header
        user_data_header = request.headers.get("X-User-Data")
        if user_data_header:
            import json
            user_data = json.loads(user_data_header)
            user_id = user_data.get("user_id")
            if user_id:
                return f"user:{user_id}"
    except Exception:
        pass
    
    # Fall back to IP address
    client_ip = request.client.host if request.client else "unknown"
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    
    return f"ip:{client_ip}"


async def rate_limit_middleware(
    request: Request,
    rate_limit_type: RateLimitType = RateLimitType.API_GENERAL,
    cost: int = 1
):
    """
    Rate limiting middleware for FastAPI.
    
    Args:
        request: FastAPI request object
        rate_limit_type: Type of rate limit to apply
        cost: Cost of this request
        
    Raises:
        HTTPException: If rate limit is exceeded
    """
    identifier = get_client_identifier(request)
    
    allowed, rate_limit_info = await rate_limiter.check_rate_limit(
        rate_limit_type, identifier, cost
    )
    
    if not allowed:
        logger.warning(
            f"Rate limit exceeded for {identifier} on {rate_limit_type.value}",
            extra={
                "identifier": identifier,
                "rate_limit_type": rate_limit_type.value,
                "rate_limit_info": rate_limit_info
            }
        )
        
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Rate limit exceeded",
                "rate_limit_type": rate_limit_type.value,
                "limit": rate_limit_info.get("limit"),
                "retry_after": rate_limit_info.get("retry_after"),
                "reset": rate_limit_info.get("reset")
            },
            headers={
                "X-RateLimit-Limit": str(rate_limit_info.get("limit", 0)),
                "X-RateLimit-Remaining": str(rate_limit_info.get("remaining", 0)),
                "X-RateLimit-Reset": str(rate_limit_info.get("reset", 0)),
                "Retry-After": str(rate_limit_info.get("retry_after", 60))
            }
        )
    
    # Add rate limit headers to response (handled by response middleware)
    request.state.rate_limit_info = rate_limit_info


def create_rate_limit_dependency(rate_limit_type: RateLimitType, cost: int = 1):
    """
    Create a FastAPI dependency for rate limiting.
    
    Args:
        rate_limit_type: Type of rate limit to apply
        cost: Cost of this request
        
    Returns:
        FastAPI dependency function
    """
    async def rate_limit_dependency(request: Request):
        await rate_limit_middleware(request, rate_limit_type, cost)
        return True
    
    return rate_limit_dependency


# Pre-defined dependencies for common use cases
CommentRateLimit = create_rate_limit_dependency(RateLimitType.COMMENT_CREATION)
MessageRateLimit = create_rate_limit_dependency(RateLimitType.MESSAGE_SENDING)
BulkOperationRateLimit = create_rate_limit_dependency(RateLimitType.BULK_OPERATIONS, cost=5)
FileUploadRateLimit = create_rate_limit_dependency(RateLimitType.FILE_UPLOADS)