"""
Redis API router for TaaskMaaster.

This module provides API endpoints for Redis monitoring, statistics,
and cache management.
"""

import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.services.redis_service import redis_service

router = APIRouter(prefix="/api/v1/redis", tags=["redis"])


@router.get("/stats", status_code=status.HTTP_200_OK)
async def get_redis_stats(current_user: User = Depends(get_current_user)):
    """
    Get Redis statistics and health information.
    
    Args:
        current_user: Authenticated user
        
    Returns:
        Redis statistics dictionary
    """
    try:
        stats = redis_service.get_stats()
        return {
            "success": True,
            "data": stats,
            "message": "Redis statistics retrieved successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get Redis statistics: {str(e)}"
        )


@router.get("/health", status_code=status.HTTP_200_OK)
async def get_redis_health(current_user: User = Depends(get_current_user)):
    """
    Check Redis health status.
    
    Args:
        current_user: Authenticated user
        
    Returns:
        Redis health status
    """
    try:
        is_healthy = redis_service.health_check()
        return {
            "success": True,
            "data": {
                "healthy": is_healthy,
                "available": redis_service.available
            },
            "message": "Redis health check completed"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check Redis health: {str(e)}"
        )


@router.post("/cache/clear", status_code=status.HTTP_200_OK)
async def clear_redis_cache(current_user: User = Depends(get_current_user)):
    """
    Clear all Redis cache data.
    
    Args:
        current_user: Authenticated user
        
    Returns:
        Clear operation result
    """
    try:
        # Allow admin users or development mode to clear cache
        is_development = os.getenv("ENVIRONMENT", "development") == "development"
        if not getattr(current_user, 'is_admin', False) and not is_development:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin users can clear cache in production"
            )
        
        success = redis_service.clear_all()
        return {
            "success": success,
            "message": "Redis cache cleared successfully" if success else "Failed to clear Redis cache"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear Redis cache: {str(e)}"
        )


@router.delete("/cache/{pattern}", status_code=status.HTTP_200_OK)
async def clear_cache_pattern(
    pattern: str,
    current_user: User = Depends(get_current_user)
):
    """
    Clear cache entries matching a pattern.
    
    Args:
        pattern: Cache key pattern to match
        current_user: Authenticated user
        
    Returns:
        Clear operation result
    """
    try:
        # Only allow admin users to clear cache patterns
        if not getattr(current_user, 'is_admin', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin users can clear cache patterns"
            )
        
        deleted_count = redis_service.cache_delete_pattern(pattern)
        return {
            "success": True,
            "data": {"deleted_count": deleted_count},
            "message": f"Cleared {deleted_count} cache entries matching pattern '{pattern}'"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear cache pattern: {str(e)}"
        )


@router.get("/cache/user/{user_id}", status_code=status.HTTP_200_OK)
async def get_user_cache_info(
    user_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Get cache information for a specific user.
    
    Args:
        user_id: User ID to check cache for
        current_user: Authenticated user
        
    Returns:
        User cache information
    """
    try:
        # Users can only check their own cache or admin can check any
        if current_user.id != user_id and not getattr(current_user, 'is_admin', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only check your own cache information"
            )
        
        # Get user-specific cache data
        user_tasks = redis_service.get_user_tasks(user_id)
        user_points = redis_service.get_user_points(user_id)
        user_achievements = redis_service.get_achievements(user_id)
        
        return {
            "success": True,
            "data": {
                "user_id": user_id,
                "tasks_cached": user_tasks is not None,
                "points_cached": user_points is not None,
                "achievements_cached": user_achievements is not None,
                "cache_keys": {
                    "tasks": f"user_tasks:{user_id}",
                    "points": f"user_points:{user_id}",
                    "achievements": f"user_achievements:{user_id}"
                }
            },
            "message": "User cache information retrieved successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user cache information: {str(e)}"
        )


@router.post("/cache/user/{user_id}/invalidate", status_code=status.HTTP_200_OK)
async def invalidate_user_cache(
    user_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Invalidate cache for a specific user.
    
    Args:
        user_id: User ID to invalidate cache for
        current_user: Authenticated user
        
    Returns:
        Invalidation result
    """
    try:
        # Users can only invalidate their own cache or admin can invalidate any
        if current_user.id != user_id and not getattr(current_user, 'is_admin', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only invalidate your own cache"
            )
        
        # Invalidate user's task cache
        success = redis_service.invalidate_task_cache(user_id)
        
        # Also clear other user-specific caches
        redis_service.cache_delete(f"user_points:{user_id}")
        redis_service.cache_delete(f"user_achievements:{user_id}")
        
        return {
            "success": success,
            "message": f"Cache invalidated for user {user_id}"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to invalidate user cache: {str(e)}"
        )
