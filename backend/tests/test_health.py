"""
Health check tests for TaaskMaaster backend.

These tests verify that the basic health endpoints and infrastructure
are working correctly.
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a test client for the FastAPI application."""
    from app.main import app

    return TestClient(app)


class TestHealthEndpoints:
    """Test health check endpoints."""

    def test_health_endpoint(self, client):
        """Test the basic health endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data

    def test_health_services(self, client):
        """Test the health endpoint includes service status."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "services" in data
        services = data["services"]
        # Check that expected services are present
        expected_services = ["database", "redis", "minio"]
        for service in expected_services:
            assert service in services
            assert services[service] in ["healthy", "unhealthy"]

    def test_metrics_endpoint(self, client):
        """Test the metrics endpoint."""
        response = client.get("/metrics")
        assert response.status_code == 200
        # Check that it returns Prometheus metrics format
        content = response.text
        assert "http_requests_total" in content
        assert "http_request_duration_seconds" in content

    def test_root_endpoint(self, client):
        """Test the root endpoint."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
        assert "status" in data


class TestAPIDocumentation:
    """Test API documentation endpoints."""

    def test_docs_endpoint(self, client):
        """Test that API documentation is accessible."""
        response = client.get("/docs")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]

    def test_openapi_spec(self, client):
        """Test that OpenAPI specification is accessible."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert "openapi" in data
        assert "info" in data
        assert "paths" in data
        # Check basic API info
        info = data["info"]
        assert "title" in info
        assert "version" in info
        assert "description" in info


class TestErrorHandling:
    """Test error handling and responses."""

    def test_404_endpoint(self, client):
        """Test 404 handling for non-existent endpoints."""
        response = client.get("/non-existent-endpoint")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    def test_method_not_allowed(self, client):
        """Test method not allowed handling."""
        response = client.post("/health")
        assert response.status_code == 405
        data = response.json()
        assert "detail" in data


class TestCORS:
    """Test CORS configuration."""

    def test_cors_headers(self, client):
        """Test that CORS headers are present."""
        response = client.options("/health")
        assert response.status_code == 200
        # Check for CORS headers
        headers = response.headers
        assert "access-control-allow-origin" in headers
        assert "access-control-allow-methods" in headers
        assert "access-control-allow-headers" in headers


class TestSecurity:
    """Test security headers and configurations."""

    def test_security_headers(self, client):
        """Test that security headers are present."""
        response = client.get("/health")
        assert response.status_code == 200
        headers = response.headers
        # Check for security headers
        security_headers = [
            "x-content-type-options",
            "x-frame-options",
            "x-xss-protection",
        ]
        for header in security_headers:
            assert header in headers, f"Missing security header: {header}"

    def test_rate_limiting_headers(self, client):
        """Test that rate limiting headers are present."""
        response = client.get("/health")
        assert response.status_code == 200
        headers = response.headers
        # Check for rate limiting headers
        rate_limit_headers = [
            "x-ratelimit-limit",
            "x-ratelimit-remaining",
            "x-ratelimit-reset",
        ]
        for header in rate_limit_headers:
            assert header in headers, f"Missing rate limit header: {header}"


if __name__ == "__main__":
    pytest.main([__file__])
