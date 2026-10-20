"""
Monitoring configuration for TaaskMaaster backend.

This module provides Prometheus metrics collection and health check endpoints
for monitoring application performance and health.
"""

import time
from typing import Any

from prometheus_client import Counter, Gauge, Histogram, generate_latest

# Prometheus metrics
REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total number of HTTP requests",
    ["method", "endpoint", "status"],
)

REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
)

ACTIVE_CONNECTIONS = Gauge(
    "http_active_connections", "Number of active HTTP connections"
)

DATABASE_CONNECTIONS = Gauge(
    "database_connections", "Number of active database connections"
)

TASK_CREATED = Counter("tasks_created_total", "Total number of tasks created")

TASK_COMPLETED = Counter(
    "tasks_completed_total", "Total number of tasks completed"
)

USER_REGISTRATIONS = Counter(
    "user_registrations_total", "Total number of user registrations"
)


class MetricsMiddleware:
    """Middleware for collecting HTTP metrics."""

    def __init__(self, app):
        self.app = app
        self.start_time = None

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Record start time
        self.start_time = time.time()

        # Increment active connections
        ACTIVE_CONNECTIONS.inc()

        # Create a custom send function to capture response status
        response_status = [200]  # Default status

        async def custom_send(message):
            if message["type"] == "http.response.start":
                response_status[0] = message["status"]
            await send(message)

        try:
            # Process request
            await self.app(scope, receive, custom_send)

            # Record metrics
            duration = time.time() - self.start_time
            method = scope.get("method", "UNKNOWN")
            path = scope.get("path", "/")

            REQUEST_COUNT.labels(
                method=method, endpoint=path, status=response_status[0]
            ).inc()

            REQUEST_DURATION.labels(method=method, endpoint=path).observe(
                duration
            )

        except Exception:
            # Record error metrics
            method = scope.get("method", "UNKNOWN")
            path = scope.get("path", "/")
            REQUEST_COUNT.labels(
                method=method, endpoint=path, status=500
            ).inc()
            raise
        finally:
            # Decrement active connections
            ACTIVE_CONNECTIONS.dec()


def get_metrics() -> str:
    """
    Get Prometheus metrics as a string.

    Returns:
        Prometheus metrics in text format
    """
    return generate_latest()


def get_health_status() -> dict[str, Any]:
    """
    Get application health status.

    Returns:
        Dictionary containing health status information
    """
    # Check Redis health
    try:
        from app.services.redis_service import redis_service
        redis_health = "healthy" if redis_service.health_check() else "unhealthy"
    except Exception:
        redis_health = "unavailable"
    
    # Check database health (basic check)
    try:
        from app.db.session import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            conn.commit()
        database_health = "healthy"
    except Exception as e:
        database_health = "unhealthy"
    
    # Check MinIO health (basic check)
    try:
        from app.services.storage_service import MinIOStorageService
        MinIOStorageService()
        minio_health = "healthy"
    except Exception:
        minio_health = "unavailable"
    
    # Overall health status
    overall_health = "healthy"
    if database_health != "healthy":
        overall_health = "unhealthy"
    
    return {
        "status": overall_health,
        "timestamp": time.time(),
        "version": "0.1.0",
        "services": {
            "database": database_health,
            "redis": redis_health,
            "minio": minio_health,
        },
    }


class HealthChecker:
    """Health check service for monitoring application components."""

    def __init__(self):
        self.checks = {}

    def add_check(self, name: str, check_func):
        """Add a health check function."""
        self.checks[name] = check_func

    async def run_checks(self) -> dict[str, Any]:
        """Run all health checks."""
        results = {}

        for name, check_func in self.checks.items():
            try:
                result = await check_func()
                results[name] = {
                    "status": "healthy" if result else "unhealthy",
                    "details": result,
                }
            except Exception as e:
                results[name] = {"status": "unhealthy", "error": str(e)}

        return results
