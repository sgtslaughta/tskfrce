"""
Pytest configuration and shared fixtures for TaaskMaaster tests.

This module provides common fixtures and configuration for all test modules.
"""

import os
import subprocess
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

import pytest
import requests


@dataclass
class TestConfig:
    """Configuration for test environment."""

    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    timeout: int = 30
    retry_attempts: int = 3
    retry_delay: int = 2


@pytest.fixture(scope="session")
def config() -> TestConfig:
    """Provide test configuration."""
    return TestConfig(
        backend_url=os.getenv("BACKEND_URL", "http://localhost:8000"),
        frontend_url=os.getenv("FRONTEND_URL", "http://localhost:3000"),
        timeout=int(os.getenv("TEST_TIMEOUT", "30")),
        retry_attempts=int(os.getenv("TEST_RETRY_ATTEMPTS", "3")),
        retry_delay=int(os.getenv("TEST_RETRY_DELAY", "2")),
    )


@pytest.fixture(scope="session")
def docker_client():
    """Provide Docker client for container management."""
    try:
        import docker

        return docker.from_env()
    except ImportError:
        pytest.skip("Docker Python client not available")


@pytest.fixture(scope="session")
def docker_compose():
    """Provide Docker Compose client."""
    try:
        from docker_compose import Compose

        return Compose()
    except ImportError:
        pytest.skip("Docker Compose Python client not available")


def wait_for_service(url: str, timeout: int = 30, retries: int = 3) -> bool:
    """
    Wait for a service to become available.

    Args:
        url: Service URL to check
        timeout: Timeout in seconds
        retries: Number of retry attempts

    Returns:
        True if service is available, False otherwise
    """
    for attempt in range(retries):
        try:
            response = requests.get(url, timeout=timeout)
            if response.status_code == 200:
                return True
        except requests.RequestException:
            pass

        if attempt < retries - 1:
            time.sleep(2)

    return False


def run_command(command: str, timeout: int = 60) -> Dict[str, Any]:
    """
    Run a shell command and return results.

    Args:
        command: Command to run
        timeout: Timeout in seconds

    Returns:
        Dictionary with command results
    """
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": "Command timed out",
            "returncode": -1,
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "returncode": -1,
        }


class ServiceChecker:
    """Utility class for checking service status."""

    def __init__(self, config: TestConfig):
        self.config = config

    def check_docker_running(self) -> bool:
        """Check if Docker is running."""
        result = run_command("docker info")
        return result["success"]

    def check_docker_compose_available(self) -> bool:
        """Check if Docker Compose is available."""
        result = run_command("docker-compose --version")
        if not result["success"]:
            result = run_command("docker compose version")
        return result["success"]

    def check_docker_compose_config(self) -> bool:
        """Check if Docker Compose configuration is valid."""
        result = run_command("docker-compose config")
        if not result["success"]:
            result = run_command("docker compose config")
        return result["success"]

    def get_running_containers(self) -> list:
        """Get list of running container names."""
        result = run_command("docker ps --format '{{.Names}}'")
        if result["success"]:
            return [
                name.strip()
                for name in result["stdout"].split("\n")
                if name.strip()
            ]
        return []

    def check_container_running(self, container_name: str) -> bool:
        """Check if a specific container is running."""
        containers = self.get_running_containers()
        return container_name in containers

    def check_service_health(self, url: str) -> bool:
        """Check if a service is healthy."""
        return wait_for_service(
            url, self.config.timeout, self.config.retry_attempts
        )

    def get_service_info(self, url: str) -> Optional[Dict[str, Any]]:
        """Get service information."""
        try:
            response = requests.get(url, timeout=self.config.timeout)
            if response.status_code in [
                200,
                404,
                422,
            ]:  # Accept 200, 404, and 422 as valid responses
                return {
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "data": (
                        response.json()
                        if response.headers.get("content-type", "").startswith(
                            "application/json"
                        )
                        else response.text
                    ),
                }
        except requests.RequestException:
            pass
        return None


@pytest.fixture
def service_checker(config: TestConfig) -> ServiceChecker:
    """Provide service checker utility."""
    return ServiceChecker(config)


# Pytest configuration
def pytest_configure(config):
    """Configure pytest."""
    config.addinivalue_line(
        "markers",
        "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "infrastructure: marks tests as infrastructure tests"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection."""
    for item in items:
        # Mark infrastructure tests
        if "infrastructure" in item.nodeid:
            item.add_marker(pytest.mark.infrastructure)

        # Mark integration tests
        if "integration" in item.nodeid:
            item.add_marker(pytest.mark.integration)

        # Mark slow tests
        if any(
            keyword in item.nodeid
            for keyword in ["build", "startup", "health"]
        ):
            item.add_marker(pytest.mark.slow)
