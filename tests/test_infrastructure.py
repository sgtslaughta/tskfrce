"""
Infrastructure tests for TaaskMaaster Phase 1.

These tests verify the Docker environment, service configuration,
and basic infrastructure setup for Phase 1 implementation.
"""

import pytest
import requests


class TestDockerEnvironment:
    """Test Docker environment setup."""

    def test_docker_running(self, service_checker):
        """Test that Docker is running."""
        assert service_checker.check_docker_running(), "Docker is not running"

    def test_docker_compose_available(self, service_checker):
        """Test that Docker Compose is available."""
        assert (
            service_checker.check_docker_compose_available()
        ), "Docker Compose is not available"

    def test_docker_compose_config_valid(self, service_checker):
        """Test that Docker Compose configuration is valid."""
        assert (
            service_checker.check_docker_compose_config()
        ), "Docker Compose configuration is invalid"


class TestServiceStatus:
    """Test service status and availability."""

    @pytest.mark.slow
    def test_all_services_running(self, service_checker):
        """Test that all required services are running."""
        expected_services = [
            "taaskmaaster-backend",
            "taaskmaaster-frontend",
            "taaskmaaster-redis",
            "taaskmaaster-minio",
        ]

        running_containers = service_checker.get_running_containers()

        for service in expected_services:
            assert (
                service in running_containers
            ), f"Service {service} is not running"

    def test_minio_service_health(self, service_checker):
        """Test MinIO service health and configuration."""
        # Test that MinIO container is running
        assert service_checker.check_container_running(
            "taaskmaaster-minio"
        ), "MinIO container is not running"

        # Test that MinIO ports are not exposed externally (security)
        exposed_ports = service_checker.get_exposed_ports("taaskmaaster-minio")
        minio_ports = [9000, 9001]  # MinIO API and Console ports

        for port in minio_ports:
            assert (
                port not in exposed_ports
            ), f"MinIO port {port} should not be exposed externally"

    def test_backend_container_running(self, service_checker):
        """Test that backend container is running."""
        assert service_checker.check_container_running(
            "taaskmaaster-backend"
        ), "Backend container is not running"

    def test_frontend_container_running(self, service_checker):
        """Test that frontend container is running."""
        assert service_checker.check_container_running(
            "taaskmaaster-frontend"
        ), "Frontend container is not running"

    def test_redis_container_running(self, service_checker):
        """Test that Redis container is running."""
        assert service_checker.check_container_running(
            "taaskmaaster-redis"
        ), "Redis container is not running"

    def test_minio_container_running(self, service_checker):
        """Test that MinIO container is running."""
        assert service_checker.check_container_running(
            "taaskmaaster-minio"
        ), "MinIO container is not running"


class TestServiceHealth:
    """Test service health endpoints."""

    @pytest.mark.slow
    def test_backend_health(self, service_checker, config):
        """Test backend health endpoint."""
        health_url = f"{config.backend_url}/health"
        assert service_checker.check_service_health(
            health_url
        ), "Backend health check failed"

    @pytest.mark.slow
    def test_frontend_health(self, service_checker, config):
        """Test frontend health."""
        assert service_checker.check_service_health(
            config.frontend_url
        ), "Frontend health check failed"

    def test_backend_health_response(self, service_checker, config):
        """Test backend health response structure."""
        health_url = f"{config.backend_url}/health"
        info = service_checker.get_service_info(health_url)

        assert info is not None, "Backend health endpoint not responding"
        assert (
            info["status_code"] == 200
        ), f"Backend health returned status {info['status_code']}"

        data = info["data"]
        assert "status" in data, "Health response missing status field"
        assert (
            data["status"] == "healthy"
        ), f"Health status is {data['status']}, expected 'healthy'"
        assert "timestamp" in data, "Health response missing timestamp field"
        assert "version" in data, "Health response missing version field"
        assert "services" in data, "Health response missing services field"

        # Check services status (Phase 2 includes MinIO integration)
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


class TestPortAccessibility:
    """Test port accessibility and security."""

    def test_backend_port_accessible(self, service_checker, config):
        """Test that backend port is accessible."""
        assert service_checker.check_service_health(
            config.backend_url
        ), "Backend port is not accessible"

    def test_frontend_port_accessible(self, service_checker, config):
        """Test that frontend port is accessible."""
        assert service_checker.check_service_health(
            config.frontend_url
        ), "Frontend port is not accessible"

    def test_redis_port_not_exposed(self, service_checker):
        """Test that Redis port is not exposed externally."""
        # Redis should only be accessible internally
        try:
            requests.get("http://localhost:6379", timeout=5)
            pytest.fail("Redis port should not be exposed externally")
        except requests.RequestException:
            # Expected - Redis should not be accessible
            pass

    def test_minio_ports_not_exposed(self, service_checker):
        """Test that MinIO ports are not exposed externally."""
        # MinIO should only be accessible internally
        for port in [9000, 9001]:
            try:
                requests.get(f"http://localhost:{port}", timeout=5)
                pytest.fail(
                    f"MinIO port {port} should not be exposed externally"
                )
            except requests.RequestException:
                # Expected - MinIO should not be accessible
                pass


class TestAPIEndpoints:
    """Test API endpoints and documentation."""

    def test_api_documentation_accessible(self, service_checker, config):
        """Test that API documentation is accessible."""
        docs_url = f"{config.backend_url}/docs"
        assert service_checker.check_service_health(
            docs_url
        ), "API documentation is not accessible"

    def test_openapi_spec_accessible(self, service_checker, config):
        """Test that OpenAPI specification is accessible."""
        spec_url = f"{config.backend_url}/openapi.json"
        info = service_checker.get_service_info(spec_url)

        assert info is not None, "OpenAPI specification is not accessible"
        assert (
            info["status_code"] == 200
        ), f"OpenAPI spec returned status {info['status_code']}"

        data = info["data"]
        assert "openapi" in data, "OpenAPI spec missing openapi field"
        assert "info" in data, "OpenAPI spec missing info field"
        assert "paths" in data, "OpenAPI spec missing paths field"

    def test_api_root_endpoint(self, service_checker, config):
        """Test API root endpoint."""
        info = service_checker.get_service_info(config.backend_url)

        assert info is not None, "API root endpoint not responding"
        assert (
            info["status_code"] == 200
        ), f"API root returned status {info['status_code']}"

        data = info["data"]
        assert "message" in data, "API root missing message field"
        assert "version" in data, "API root missing version field"
        assert "status" in data, "API root missing status field"
        assert "docs" in data, "API root missing docs field"
        assert "health" in data, "API root missing health field"


class TestSecurity:
    """Test security configurations."""

    def test_security_headers_present(self, service_checker, config):
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

    def test_cors_headers_present(self, service_checker, config):
        """Test that CORS headers are present."""
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

        except requests.RequestException as e:
            pytest.fail(f"CORS test failed: {e}")


class TestPerformance:
    """Test performance metrics."""

    def test_backend_response_time(self, service_checker, config):
        """Test backend response time."""
        import time

        start_time = time.time()
        info = service_checker.get_service_info(f"{config.backend_url}/health")
        response_time = time.time() - start_time

        assert info is not None, "Backend not responding"
        assert response_time < 2.0, (
            f"Backend response time {response_time:.2f}s is too slow "
            "(expected < 2.0s)"
        )

    def test_frontend_response_time(self, service_checker, config):
        """Test frontend response time."""
        import time

        start_time = time.time()
        info = service_checker.get_service_info(config.frontend_url)
        response_time = time.time() - start_time

        assert info is not None, "Frontend not responding"
        assert response_time < 5.0, (
            f"Frontend response time {response_time:.2f}s is too slow "
            "(expected < 5.0s)"
        )


class TestErrorHandling:
    """Test error handling and responses."""

    def test_404_handling(self, service_checker, config):
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

    def test_method_not_allowed(self, service_checker, config):
        """Test method not allowed handling."""
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
            pytest.fail(f"Method not allowed test failed: {e}")


if __name__ == "__main__":
    pytest.main([__file__])
