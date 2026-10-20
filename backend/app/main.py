"""
Main FastAPI application for TaaskMaaster.

This module contains the main FastAPI application with health checks,
monitoring, and basic API endpoints.
"""

import os
import time
from typing import Any

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

# Import API routers
from app.api import (
    auth_router,
    comments_router,
    gamification_router,
    goals_router,
    lists_router,
    media_router,
    mentions_router,
    messaging_router,
    presence_router,
    redis_router,
    tasks_router,
    users_router,
    websocket_router,
    workflow_router,
)
from app.api.notifications import router as notifications_router
from app.core.logging import configure_logging, get_logger
from app.core.monitoring import (
    MetricsMiddleware,
    get_health_status,
    get_metrics,
)
from app.core.rate_limiting import rate_limit_middleware
from app.services.storage_service import MinIOStorageService

# Configure logging
configure_logging()
logger = get_logger(__name__)

# Create FastAPI application
fastapi_app = FastAPI(
    title="TaaskMaaster API",
    description="A comprehensive task management system for families",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Add FastAPI middleware
# Get CORS origins from environment variable
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
trusted_hosts = os.getenv("TRUSTED_HOSTS", "localhost,127.0.0.1,taaskmaaster-backend").split(",")

# Add backend service name for internal Docker communication
if "backend" not in trusted_hosts:
    trusted_hosts.append("backend")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
fastapi_app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[host.strip() for host in trusted_hosts],
)

# Add rate limiting middleware (temporarily disabled for debugging)
# fastapi_app.middleware("http")(rate_limit_middleware)


@fastapi_app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests."""
    start_time = time.time()

    # Log request
    logger.info(
        "Incoming request",
        method=request.method,
        url=str(request.url),
        client_ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    # Process request
    response = await call_next(request)

    # Calculate response time
    response_time = time.time() - start_time

    # Log response
    logger.info(
        "Response sent",
        status_code=response.status_code,
        response_time=response_time,
        content_length=response.headers.get("content-length"),
    )

    # Add response time header
    response.headers["X-Response-Time"] = str(response_time)

    # Add security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"

    return response


# Include API routers
fastapi_app.include_router(auth_router)
fastapi_app.include_router(users_router)
fastapi_app.include_router(tasks_router)
fastapi_app.include_router(goals_router)
fastapi_app.include_router(gamification_router)
fastapi_app.include_router(lists_router)
fastapi_app.include_router(media_router)
fastapi_app.include_router(redis_router)

# New workflow and messaging routers
fastapi_app.include_router(comments_router, prefix="/api/v1/comments", tags=["comments"])
fastapi_app.include_router(workflow_router, prefix="/api/v1/workflow", tags=["workflow"])
fastapi_app.include_router(messaging_router, prefix="/api/v1/messages", tags=["messaging"])
fastapi_app.include_router(mentions_router, prefix="/api/v1/mentions", tags=["mentions"])
fastapi_app.include_router(presence_router, prefix="/api/v1/presence", tags=["presence"])
fastapi_app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["notifications"])
fastapi_app.include_router(websocket_router, prefix="/ws", tags=["websocket"])

# Create the final app with ASGI middleware
app = MetricsMiddleware(fastapi_app)


@fastapi_app.get("/")
async def root() -> dict[str, Any]:
    """
    Root endpoint providing basic API information.

    Returns:
        Dictionary containing API information
    """
    return {
        "message": "Welcome to TaaskMaaster API",
        "version": "0.1.0",
        "status": "running",
        "docs": "/docs",
        "health": "/health",
    }


@fastapi_app.get("/health")
async def health_check() -> dict[str, Any]:
    """
    Health check endpoint for monitoring.

    Returns:
        Dictionary containing health status information
    """
    return get_health_status()


@fastapi_app.get("/metrics")
async def metrics() -> Response:
    """
    Prometheus metrics endpoint.

    Returns:
        Prometheus metrics in text format
    """
    return Response(content=get_metrics(), media_type="text/plain")


@fastapi_app.get("/api/v1/status")
async def api_status() -> dict[str, Any]:
    """
    API status endpoint for versioned API.

    Returns:
        Dictionary containing API status information
    """
    return {
        "api_version": "v1",
        "status": "healthy",
        "timestamp": time.time(),
        "features": [
            "task_management",
            "user_management",
            "gamification",
            "file_storage",
        ],
    }


@fastapi_app.exception_handler(404)
async def not_found_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle 404 errors."""
    logger.warning("404 error", path=request.url.path, method=request.method)
    return JSONResponse(
        status_code=404, content={"detail": "Endpoint not found"}
    )


@fastapi_app.exception_handler(500)
async def internal_error_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Handle 500 errors."""
    logger.error(
        "Internal server error",
        path=request.url.path,
        method=request.method,
        error=str(exc),
    )
    return JSONResponse(
        status_code=500, content={"detail": "Internal server error"}
    )


async def initialize_minio() -> None:
    """Initialize MinIO storage service."""
    try:
        MinIOStorageService()
        logger.info("MinIO storage service initialized successfully")
    except Exception as e:
        logger.warning(f"MinIO storage service not available: {e}")
        logger.info("Continuing without MinIO storage service")


async def initialize_redis() -> None:
    """Initialize Redis service."""
    try:
        from app.services.redis_service import redis_service
        if redis_service.available:
            logger.info("Redis service initialized successfully")
        else:
            logger.warning("Redis service not available")
    except Exception as e:
        logger.warning(f"Redis service not available: {e}")
        logger.info("Continuing without Redis service")


async def cleanup_minio() -> None:
    """Cleanup MinIO storage service."""
    logger.info("MinIO storage service cleanup completed")


async def cleanup_redis() -> None:
    """Cleanup Redis service."""
    logger.info("Redis service cleanup completed")


# Startup event
@fastapi_app.on_event("startup")
async def startup_event():
    """Application startup event."""
    logger.info("TaaskMaaster API starting up")

    # Initialize database
    from app.core.database import init_database
    
    init_database()
    logger.info("Database tables created")

    # Initialize services here
    await initialize_redis()
    await initialize_minio()

    logger.info("TaaskMaaster API startup complete")


# Shutdown event
@fastapi_app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event."""
    logger.info("TaaskMaaster API shutting down")

    # Cleanup services here
    # await cleanup_database()
    await cleanup_redis()
    await cleanup_minio()

    logger.info("TaaskMaaster API shutdown complete")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
