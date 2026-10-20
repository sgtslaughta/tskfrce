"""
Frontend tests for TaaskMaaster Phase 1.

These tests verify the Next.js frontend functionality, components,
and user interface for Phase 1 implementation.
"""

import pytest


class TestFrontendAccessibility:
    """Test frontend accessibility and basic functionality."""

    def test_frontend_loading(self, service_checker, config):
        """Test that frontend loads successfully."""
        info = service_checker.get_service_info(config.frontend_url)

        assert info is not None, "Frontend not responding"
        assert (
            info["status_code"] == 200
        ), f"Frontend returned status {info['status_code']}"

    def test_frontend_html_structure(self, service_checker, config):
        """Test that frontend has proper HTML structure."""
        info = service_checker.get_service_info(config.frontend_url)

        assert info is not None, "Frontend not responding"

        html_content = info["data"]
        assert "<!DOCTYPE html>" in html_content, "Frontend missing DOCTYPE"
        assert "<html" in html_content, "Frontend missing HTML tag"
        assert "<head>" in html_content, "Frontend missing head tag"
        assert "<body>" in html_content, "Frontend missing body tag"

    def test_frontend_meta_tags(self, service_checker, config):
        """Test that frontend has proper meta tags."""
        info = service_checker.get_service_info(config.frontend_url)

        assert info is not None, "Frontend not responding"

        html_content = info["data"]
        assert "viewport" in html_content, "Frontend missing viewport meta tag"
        assert "next-head" in html_content, "Frontend missing Next.js head"

    def test_frontend_title(self, service_checker, config):
        """Test that frontend has proper title."""
        info = service_checker.get_service_info(config.frontend_url)

        assert info is not None, "Frontend not responding"

        html_content = info["data"]
        assert (
            "TaaskMaaster" in html_content
        ), "Frontend missing application title"


class TestFrontendSecurity:
    """Test frontend security features."""

    def test_security_headers(self, service_checker, config):
        """Test that frontend has security headers."""
        info = service_checker.get_service_info(config.frontend_url)

        assert info is not None, "Frontend not responding"

        headers = {k.lower(): v for k, v in info["headers"].items()}
        security_headers = [
            "x-content-type-options",
            "x-frame-options",
            "x-xss-protection",
        ]

        for header in security_headers:
            assert header in headers, f"Missing security header: {header}"


class TestFrontendPerformance:
    """Test frontend performance."""

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

    def test_frontend_response_size(self, service_checker, config):
        """Test frontend response size."""
        info = service_checker.get_service_info(config.frontend_url)

        assert info is not None, "Frontend not responding"

        # Check content length if available
        content_length = info["headers"].get("content-length")
        if content_length:
            size_in_kb = int(content_length) / 1024
            assert size_in_kb < 1000, (
                f"Frontend response size {size_in_kb:.1f}KB is too large "
                "(expected < 1000KB)"
            )


class TestFrontendContent:
    """Test frontend content and functionality."""

    def test_frontend_content_loading(self, service_checker, config):
        """Test that frontend content loads properly."""
        info = service_checker.get_service_info(config.frontend_url)

        assert info is not None, "Frontend not responding"

        html_content = info["data"]

        # Check for key content elements (Phase 1 content)
        content_checks = [
            "Welcome to TaaskMaaster",
            "task management",
            "gamification",
            "family",
        ]

        for check in content_checks:
            assert (
                check.lower() in html_content.lower()
            ), f"Frontend missing content: {check}"

    def test_frontend_links(self, service_checker, config):
        """Test that frontend has proper links."""
        info = service_checker.get_service_info(config.frontend_url)

        assert info is not None, "Frontend not responding"

        html_content = info["data"]

        # Check for important links (Phase 1 links)
        expected_links = ["/docs", "/health"]

        for link in expected_links:
            assert link in html_content, f"Frontend missing link: {link}"


class TestFrontendResponsiveness:
    """Test frontend responsiveness and mobile compatibility."""

    def test_mobile_viewport(self, service_checker, config):
        """Test that frontend has mobile viewport configuration."""
        info = service_checker.get_service_info(config.frontend_url)

        assert info is not None, "Frontend not responding"

        html_content = info["data"]
        assert "viewport" in html_content, "Frontend missing viewport meta tag"
        assert (
            "width=device-width" in html_content
        ), "Frontend missing responsive viewport"


class TestFrontendIntegration:
    """Test frontend integration with backend."""

    def test_backend_api_connectivity_from_frontend(
        self, service_checker, config
    ):
        """Test that frontend can reach backend API."""
        # This would require JavaScript execution to test
        # For now, we verify the backend is accessible from the frontend's
        # perspective
        backend_health_url = f"{config.backend_url}/health"
        assert service_checker.check_service_health(
            backend_health_url
        ), "Backend not accessible from frontend perspective"

    def test_api_documentation_links(self, service_checker, config):
        """Test that frontend links to API documentation work."""
        docs_url = f"{config.backend_url}/docs"
        assert service_checker.check_service_health(
            docs_url
        ), "API documentation not accessible"

    def test_health_check_links(self, service_checker, config):
        """Test that frontend links to health checks work."""
        health_url = f"{config.backend_url}/health"
        assert service_checker.check_service_health(
            health_url
        ), "Health check not accessible"


class TestFrontendBuild:
    """Test frontend build and deployment."""

    def test_frontend_build_output(self, service_checker, config):
        """Test that frontend build output is correct."""
        info = service_checker.get_service_info(config.frontend_url)

        assert info is not None, "Frontend not responding"

        # Check for Next.js specific content
        html_content = info["data"]
        assert (
            "next" in html_content.lower()
        ), "Frontend missing Next.js indicators"


if __name__ == "__main__":
    pytest.main([__file__])
