"""
Logging configuration for TaaskMaaster backend.

This module provides structured logging configuration using structlog
for better observability and debugging capabilities.
"""

import logging
import sys
from typing import Any

import structlog
from structlog.stdlib import LoggerFactory


def configure_logging(level: str = "INFO") -> None:
    """
    Configure structured logging for the application.
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """
    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, level.upper()),
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """
    Get a structured logger instance.
    Args:
        name: Logger name (usually __name__)
    Returns:
        Configured structured logger
    """
    return structlog.get_logger(name)


class RequestLogger:
    """Middleware for logging HTTP requests and responses."""

    def __init__(self, logger: structlog.stdlib.BoundLogger):
        self.logger = logger

    def log_request(self, request_data: dict[str, Any]) -> None:
        """Log incoming request data."""
        self.logger.info(
            "Incoming request",
            method=request_data.get("method"),
            url=request_data.get("url"),
            client_ip=request_data.get("client_ip"),
            user_agent=request_data.get("user_agent"),
        )

    def log_response(self, response_data: dict[str, Any]) -> None:
        """Log response data."""
        self.logger.info(
            "Response sent",
            status_code=response_data.get("status_code"),
            response_time=response_data.get("response_time"),
            content_length=response_data.get("content_length"),
        )

    def log_error(self, error_data: dict[str, Any]) -> None:
        """Log error information."""
        self.logger.error(
            "Request error",
            error_type=error_data.get("error_type"),
            error_message=error_data.get("error_message"),
            status_code=error_data.get("status_code"),
            **error_data.get("extra", {}),
        )
