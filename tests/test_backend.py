"""
Backend API tests for TaaskMaaster Phase 1.

These tests verify the FastAPI backend functionality, endpoints,
and business logic for Phase 1 implementation.
"""

import pytest
import requests


class TestBackendAPI:
    """Test backend API functionality."""

    def test_root_endpoint(self, service_checker, config):
        """Test the root endpoint."""
        info = service_checker.get_service_info(config.backend_url)

        assert info is not None, "Backend root endpoint not responding"
        assert (
            info["status_code"] == 200
        ), f"Root endpoint returned status {info['status_code']}"

        data = info["data"]
        assert "message" in data, "Root response missing message field"
        assert "version" in data, "Root response missing version field"
        assert "status" in data, "Root response missing status field"
        assert "docs" in data, "Root response missing docs field"
        assert "health" in data, "Root response missing health field"

    def test_health_endpoint(self, service_checker, config):
        """Test the health endpoint."""
        health_url = f"{config.backend_url}/health"
        info = service_checker.get_service_info(health_url)

        assert info is not None, "Health endpoint not responding"
        assert (
            info["status_code"] == 200
        ), f"Health endpoint returned status {info['status_code']}"

        data = info["data"]
        assert "status" in data, "Health response missing status field"
        assert (
            data["status"] == "healthy"
        ), f"Health status is {data['status']}, expected 'healthy'"
        assert "timestamp" in data, "Health response missing timestamp field"
        assert "version" in data, "Health response missing version field"
        assert "services" in data, "Health response missing services field"

        # Check services status (Phase 1 returns hardcoded healthy status)
        services = data["services"]
        expected_services = ["database", "redis", "minio"]
        for service in expected_services:
            assert (
                service in services
            ), f"Health response missing {service} status"
            assert services[service] in [
                "healthy",
                "unhealthy",
            ], f"Invalid {service} status: {services[service]}"

    def test_metrics_endpoint(self, service_checker, config):
        """Test the metrics endpoint."""
        metrics_url = f"{config.backend_url}/metrics"
        info = service_checker.get_service_info(metrics_url)

        assert info is not None, "Metrics endpoint not responding"
        assert (
            info["status_code"] == 200
        ), f"Metrics endpoint returned status {info['status_code']}"

        # Check that it returns Prometheus metrics format
        content = info["data"]
        assert (
            "http_requests_total" in content
        ), "Metrics missing http_requests_total"
        assert (
            "http_request_duration_seconds" in content
        ), "Metrics missing http_request_duration_seconds"

    def test_api_status_endpoint(self, service_checker, config):
        """Test the API status endpoint."""
        status_url = f"{config.backend_url}/api/v1/status"
        info = service_checker.get_service_info(status_url)

        assert info is not None, "API status endpoint not responding"
        assert (
            info["status_code"] == 200
        ), f"API status returned status {info['status_code']}"

        data = info["data"]
        assert "api_version" in data, "API status missing api_version field"
        assert (
            data["api_version"] == "v1"
        ), f"API version is {data['api_version']}, expected 'v1'"
        assert "status" in data, "API status missing status field"
        assert "timestamp" in data, "API status missing timestamp field"
        assert "features" in data, "API status missing features field"

        # Check features list (Phase 2 features are now implemented)
        features = data["features"]
        expected_features = [
            "task_management",
            "user_management",
            "gamification",
            "file_storage",
        ]
        for feature in expected_features:
            assert (
                feature in features
            ), f"API status missing Phase 2 feature: {feature}"

    def test_documentation_endpoints(self, service_checker, config):
        """Test API documentation endpoints."""
        # Test Swagger UI
        docs_url = f"{config.backend_url}/docs"
        info = service_checker.get_service_info(docs_url)

        assert info is not None, "API docs not responding"
        assert (
            info["status_code"] == 200
        ), f"API docs returned status {info['status_code']}"
        assert "text/html" in info["headers"].get(
            "content-type", ""
        ), "API docs not returning HTML"

        # Test ReDoc
        redoc_url = f"{config.backend_url}/redoc"
        info = service_checker.get_service_info(redoc_url)

        assert info is not None, "ReDoc not responding"
        assert (
            info["status_code"] == 200
        ), f"ReDoc returned status {info['status_code']}"
        assert "text/html" in info["headers"].get(
            "content-type", ""
        ), "ReDoc not returning HTML"

        # Test OpenAPI spec
        spec_url = f"{config.backend_url}/openapi.json"
        info = service_checker.get_service_info(spec_url)

        assert info is not None, "OpenAPI spec not responding"
        assert (
            info["status_code"] == 200
        ), f"OpenAPI spec returned status {info['status_code']}"

        data = info["data"]
        assert "openapi" in data, "OpenAPI spec missing openapi field"
        assert "info" in data, "OpenAPI spec missing info field"
        assert "paths" in data, "OpenAPI spec missing paths field"

        # Check API info
        api_info = data["info"]
        assert "title" in api_info, "OpenAPI spec missing title"
        assert "version" in api_info, "OpenAPI spec missing version"
        assert "description" in api_info, "OpenAPI spec missing description"


class TestBackendErrorHandling:
    """Test backend error handling."""

    def test_404_error_handling(self, service_checker, config):
        """Test 404 error handling."""
        try:
            response = requests.get(
                f"{config.backend_url}/non-existent-endpoint", timeout=10
            )
            assert (
                response.status_code == 404
            ), f"Expected 404, got {response.status_code}"

            data = response.json()
            assert "detail" in data, "404 response missing detail field"

        except requests.RequestException as e:
            pytest.fail(f"404 test failed: {e}")

    def test_405_error_handling(self, service_checker, config):
        """Test 405 error handling."""
        try:
            response = requests.post(
                f"{config.backend_url}/health", timeout=10
            )
            assert (
                response.status_code == 405
            ), f"Expected 405, got {response.status_code}"

            data = response.json()
            assert "detail" in data, "405 response missing detail field"

        except requests.RequestException as e:
            pytest.fail(f"405 test failed: {e}")


class TestBackendSecurity:
    """Test backend security features."""

    def test_security_headers(self, service_checker, config):
        """Test that security headers are present."""
        info = service_checker.get_service_info(config.backend_url)

        assert info is not None, "Backend not responding"

        headers = {k.lower(): v for k, v in info["headers"].items()}
        security_headers = [
            "x-content-type-options",
            "x-frame-options",
            "x-xss-protection",
        ]

        for header in security_headers:
            assert header in headers, f"Missing security header: {header}"

    def test_cors_configuration(self, service_checker, config):
        """Test CORS configuration."""
        try:
            response = requests.options(
                f"{config.backend_url}/health",
                headers={
                    "Origin": "http://localhost:3000",
                    "Access-Control-Request-Method": "GET",
                    "Access-Control-Request-Headers": "content-type",
                },
                timeout=10,
            )

            headers = response.headers
            assert (
                "access-control-allow-origin" in headers
            ), "Missing CORS origin header"
            assert (
                "access-control-allow-methods" in headers
            ), "Missing CORS methods header"
            assert (
                "access-control-allow-headers" in headers
            ), "Missing CORS headers header"

            # Check that frontend origin is allowed
            allowed_origins = headers["access-control-allow-origin"]
            assert (
                "http://localhost:3000" in allowed_origins
                or allowed_origins == "*"
            ), "Frontend origin not allowed"

        except requests.RequestException as e:
            pytest.fail(f"CORS test failed: {e}")


class TestBackendPerformance:
    """Test backend performance."""

    def test_response_time(self, service_checker, config):
        """Test backend response time."""
        import time

        # Test multiple endpoints
        endpoints = ["/", "/health", "/metrics", "/api/v1/status"]

        for endpoint in endpoints:
            start_time = time.time()
            info = service_checker.get_service_info(
                f"{config.backend_url}{endpoint}"
            )
            response_time = time.time() - start_time

            assert info is not None, f"Endpoint {endpoint} not responding"
            assert response_time < 2.0, (
                f"Response time for {endpoint}: {response_time:.2f}s "
                "(expected < 2.0s)"
            )

    def test_concurrent_requests(self, service_checker, config):
        """Test handling of concurrent requests."""
        import threading
        import time

        results = []
        errors = []

        def make_request():
            try:
                start_time = time.time()
                info = service_checker.get_service_info(
                    f"{config.backend_url}/health"
                )
                response_time = time.time() - start_time

                if info is not None:
                    results.append(response_time)
                else:
                    errors.append("Request failed")
            except Exception as e:
                errors.append(str(e))

        # Make 5 concurrent requests
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()

        # Wait for all threads to complete
        for thread in threads:
            thread.join()

        # Check results
        assert len(errors) == 0, f"Concurrent requests failed: {errors}"
        assert (
            len(results) == 5
        ), f"Expected 5 successful requests, got {len(results)}"

        # Check that all responses were reasonably fast
        for response_time in results:
            assert response_time < 3.0, (
                f"Concurrent request response time: {response_time:.2f}s "
                "(expected < 3.0s)"
            )


if __name__ == "__main__":
    pytest.main([__file__])
