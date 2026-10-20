"""
Logging configuration for TaaskMaaster test suite.

This module provides structured logging for test execution,
including file output and console output.
"""

import logging
import logging.handlers
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


class TestLogger:
    """Test suite logger with file and console output."""

    def __init__(
        self, name: str = "taaskmaaster_tests", log_dir: str = "logs"
    ):
        self.name = name
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)

        # Create logger
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)

        # Clear any existing handlers
        self.logger.handlers.clear()

        # Add handlers
        self._add_console_handler()
        self._add_file_handler()

        # Log initialization
        major = sys.version_info.major
        minor = sys.version_info.minor
        micro = sys.version_info.micro
        python_version = f"{major}.{minor}.{micro}"
        self.logger.info(
            "Test logger initialized",
            extra={
                "log_dir": str(self.log_dir.absolute()),
                "python_version": python_version,
            },
        )

    def _add_console_handler(self):
        """Add console handler with colored output."""
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)

        # Create formatter
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%H:%M:%S",
        )
        console_handler.setFormatter(formatter)

        self.logger.addHandler(console_handler)

    def _add_file_handler(self):
        """Add file handler with detailed logging."""
        # Create timestamped log file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_file = self.log_dir / f"test_run_{timestamp}.log"

        file_handler = logging.FileHandler(log_file, mode="w")
        file_handler.setLevel(logging.DEBUG)

        # Create detailed formatter
        time_str = "%(asctime)s - %(name)s - %(levelname)s"
        message_str = "%(funcName)s:%(lineno)d - %(message)s"
        formatter = logging.Formatter(
            f"{time_str} - {message_str}",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        file_handler.setFormatter(formatter)

        self.logger.addHandler(file_handler)

        # Log the log file location
        self.logger.info(f"Log file created: {log_file}")

    def log_test_start(self, test_name: str, test_type: str = "unknown"):
        """Log the start of a test."""
        self.logger.info(
            f"Starting test: {test_name}",
            extra={
                "test_name": test_name,
                "test_type": test_type,
                "event": "test_start",
            },
        )

    def log_test_result(
        self,
        test_name: str,
        success: bool,
        duration: float,
        error_message: Optional[str] = None,
    ):
        """Log the result of a test."""
        level = logging.INFO if success else logging.ERROR
        message = (
            f"Test complete: {test_name} - {'PASSED' if success else 'FAILED'}"
        )

        extra = {
            "test_name": test_name,
            "success": success,
            "duration": duration,
            "event": "test_result",
        }

        if error_message:
            extra["error"] = error_message
            message += f" - {error_message}"

        self.logger.log(level, message, extra=extra)

    def log_command_execution(
        self,
        command: list,
        success: bool,
        stdout: str = "",
        stderr: str = "",
        duration: float = 0.0,
    ):
        """Log command execution details."""
        level = logging.INFO if success else logging.WARNING
        message = (
            f"Command executed: {' '.join(command)} - "
            f"{'SUCCESS' if success else 'FAILED'}"
        )

        extra = {
            "command": command,
            "success": success,
            "duration": duration,
            "stdout_length": len(stdout),
            "stderr_length": len(stderr),
            "event": "command_execution",
        }

        if stderr and not success:
            extra["stderr"] = stderr[:500]  # Limit stderr length in logs

        self.logger.log(level, message, extra=extra)

        # Log full output at debug level
        if stdout:
            self.logger.debug(f"Command stdout: {stdout}")
        if stderr:
            self.logger.debug(f"Command stderr: {stderr}")

    def log_docker_event(self, event: str, details: dict):
        """Log Docker-related events."""
        self.logger.info(
            f"Docker event: {event}",
            extra={"docker_event": event, **details, "event": "docker_event"},
        )

    def log_service_status(
        self, service: str, status: str, details: dict = None
    ):
        """Log service status changes."""
        extra = {
            "service": service,
            "status": status,
            "event": "service_status",
        }
        if details:
            extra.update(details)

        self.logger.info(f"Service status: {service} - {status}", extra=extra)

    def log_error(self, error: Exception, context: str = ""):
        """Log errors with context."""
        self.logger.error(
            f"Error in {context}: {str(error)}",
            extra={
                "error_type": type(error).__name__,
                "error_message": str(error),
                "context": context,
                "event": "error",
            },
            exc_info=True,
        )

    def log_summary(
        self,
        total_tests: int,
        passed: int,
        failed: int,
        skipped: int,
        total_duration: float,
    ):
        """Log test summary."""
        success_rate = (passed / total_tests * 100) if total_tests > 0 else 0

        self.logger.info(
            "Test run summary",
            extra={
                "total_tests": total_tests,
                "passed": passed,
                "failed": failed,
                "skipped": skipped,
                "success_rate": success_rate,
                "total_duration": total_duration,
                "event": "test_summary",
            },
        )

    def get_log_file(self) -> Optional[Path]:
        """Get the current log file path."""
        for handler in self.logger.handlers:
            if isinstance(handler, logging.FileHandler):
                return Path(handler.baseFilename)
        return None


# Global logger instance
_test_logger: Optional[TestLogger] = None


def get_test_logger() -> TestLogger:
    """Get the global test logger instance."""
    global _test_logger
    if _test_logger is None:
        _test_logger = TestLogger()
    return _test_logger


def setup_logging(log_dir: str = "logs") -> TestLogger:
    """Setup logging for the test suite."""
    global _test_logger
    _test_logger = TestLogger(log_dir=log_dir)
    return _test_logger


def log_test_event(event: str, **kwargs):
    """Log a test event with the global logger."""
    logger = get_test_logger()
    logger.logger.info(
        f"Test event: {event}", extra={"event": event, **kwargs}
    )


def log_command_result(command: list, result: dict):
    """Log command execution result."""
    logger = get_test_logger()
    logger.log_command_execution(
        command=command,
        success=result["success"],
        stdout=result.get("stdout", ""),
        stderr=result.get("stderr", ""),
        duration=0.0,  # Could be enhanced to track actual duration
    )


if __name__ == "__main__":
    # Test the logger
    logger = setup_logging()
    logger.log_test_start("test_example", "unit")
    logger.log_test_result("test_example", True, 1.5)
    logger.log_command_execution(["echo", "hello"], True, "hello\n", "")
    logger.log_summary(10, 8, 1, 1, 15.5)
