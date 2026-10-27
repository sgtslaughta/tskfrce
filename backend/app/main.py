"""
Main FastAPI application for TaaskMaaster.

This module contains the main FastAPI application with health checks,
monitoring, and basic API endpoints.
"""

import os
import time
from typing import Any

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

# Import API routers
from app.api import (
    auth_router,
    users_router,
)
from app.api.badges import overview_router as badges_overview_router
from app.api.badges import router as badges_router
from app.api.chat import router as chat_router
from app.api.chore_library import router as chore_library_router
from app.api.chore_photos import router as chore_photos_router
from app.api.chore_types import router as chore_types_router
from app.api.chores import router as chores_router
from app.api.community import router as community_router
from app.api.device_activity import router as device_activity_router
from app.api.devices import router as devices_router
from app.api.family import router as family_router
from app.api.flair import router as flair_router
from app.api.hours import router as hours_router
from app.api.inbox import router as notifications_router
from app.api.internal import router as internal_router
from app.api.kid import router as kid_router
from app.api.kid_push import router as kid_push_router
from app.api.kid_rewards import router as kid_rewards_router
from app.api.kids import router as kids_router
from app.api.notify import router as notify_router
from app.api.password_reset import router as password_reset_router
from app.api.rewards import redemptions_router
from app.api.rewards import router as rewards_router
from app.api.screen_time import router as screen_time_router
from app.api.setup import router as setup_router
from app.api.tips import router as tips_router
from app.core.logging import configure_logging, get_logger
from app.core.monitoring import (
    MetricsMiddleware,
    get_health_status,
    get_metrics,
)

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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["authorization", "content-type", "accept"],
)
fastapi_app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[host.strip() for host in trusted_hosts],
)


@fastapi_app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests."""
    start_time = time.time()

    # Log request
    logger.info(
        "Incoming request",
        method=request.method,
        path=request.url.path,  # no query string: may carry tokens
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
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'"
    )

    return response


# Include API routers
fastapi_app.include_router(auth_router)
fastapi_app.include_router(password_reset_router)
fastapi_app.include_router(setup_router)
fastapi_app.include_router(users_router)

fastapi_app.include_router(
    notifications_router, prefix="/api/v1/notifications", tags=["notifications"]
)
fastapi_app.include_router(chore_library_router)
fastapi_app.include_router(chore_types_router)
fastapi_app.include_router(chores_router)
fastapi_app.include_router(chore_photos_router)
fastapi_app.include_router(chat_router)
fastapi_app.include_router(internal_router)
fastapi_app.include_router(devices_router)
fastapi_app.include_router(device_activity_router)
fastapi_app.include_router(hours_router)
fastapi_app.include_router(kids_router)
fastapi_app.include_router(kid_push_router)
fastapi_app.include_router(kid_router)
fastapi_app.include_router(kid_rewards_router)
fastapi_app.include_router(family_router)
fastapi_app.include_router(notify_router)
fastapi_app.include_router(rewards_router)
fastapi_app.include_router(screen_time_router)
fastapi_app.include_router(badges_router)
fastapi_app.include_router(badges_overview_router)
fastapi_app.include_router(community_router)
fastapi_app.include_router(flair_router)
fastapi_app.include_router(redemptions_router)
fastapi_app.include_router(tips_router)

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
    """Handle 404s; keep explicit HTTPException details, generic text for unmatched routes."""
    logger.warning("404 error", path=request.url.path, method=request.method)
    detail = getattr(exc, "detail", None)
    if not detail or detail == "Not Found":
        detail = "Endpoint not found"
    return JSONResponse(status_code=404, content={"detail": detail})


@fastapi_app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Never echo `input`/`ctx`/`url` in a 422: they can hold passwords and secret URLs."""
    errs = [{k: v for k, v in e.items() if k in ("loc", "msg", "type")} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": errs})


@fastapi_app.exception_handler(OperationalError)
async def db_locked_handler(request: Request, exc: OperationalError) -> JSONResponse:
    """Map SQLite lock contention to 503 so clients can retry."""
    if "database is locked" in str(exc):
        return JSONResponse(status_code=503, content={"detail": "Busy, try again."})
    raise


@fastapi_app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle 500 errors."""
    logger.error(
        "Internal server error",
        path=request.url.path,
        method=request.method,
        error=str(exc),
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# Startup event
@fastapi_app.on_event("startup")
async def startup_event():
    """Application startup event."""
    logger.info("TaaskMaaster API starting up")

    # Initialize database
    from app.core.database import init_database

    init_database()
    logger.info("Database ready")

    from app.core.database import SessionLocal
    from app.models.family import get_family
    from app.services import push

    with SessionLocal() as db:
        push.write_conf(get_family(db))
        db.commit()

    from app.core.config import settings

    if settings.LOCK_LOOP_ENABLED:
        import asyncio

        from app.lock.loop import run_forever

        fastapi_app.state.lock_task = asyncio.create_task(run_forever())

    logger.info("TaaskMaaster API startup complete")


# Shutdown event
@fastapi_app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event."""
    logger.info("TaaskMaaster API shutting down")

    task = getattr(fastapi_app.state, "lock_task", None)
    if task:
        task.cancel()
    # await cleanup_database()

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
