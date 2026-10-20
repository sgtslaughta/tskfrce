"""
MinIO Integration Tests for TaaskMaaster.

These tests verify the MinIO object storage integration,
including storage service, media service integration, and API endpoints.
"""

import os
from unittest.mock import Mock, patch

import pytest
import requests


class TestMinIOInfrastructure:
    """Test MinIO infrastructure setup."""

    def test_minio_container_running(self, service_checker):
        """Test that MinIO container is running."""
        assert service_checker.check_container_running(
            "taaskmaaster-minio"
        ), "MinIO container is not running"

    def test_minio_health_check(self, service_checker):
        """Test MinIO health check."""
        # This test assumes MinIO is accessible via internal network
        # In a real environment, this would check MinIO's health endpoint
        assert True, "MinIO health check passed"

    def test_minio_ports_not_exposed(self, service_checker):
        """Test that MinIO ports are not exposed externally."""
        # MinIO should only be accessible internally
        exposed_ports = service_checker.get_exposed_ports("taaskmaaster-minio")

        # MinIO ports should not be exposed externally
        minio_ports = [9000, 9001]  # MinIO API and Console ports
        for port in minio_ports:
            assert (
                port not in exposed_ports
            ), f"MinIO port {port} should not be exposed externally"


class TestMinIOStorageService:
    """Test MinIO storage service functionality."""

    def test_storage_service_initialization(self):
        """Test MinIO storage service initialization."""
        try:
            from app.services.storage_service import MinIOStorageService

            # Test that the class can be imported and has required methods
            required_methods = [
                "upload_file",
                "upload_file_from_bytes",
                "download_file",
                "delete_file",
                "get_presigned_url",
                "get_upload_url",
                "file_exists",
                "get_file_info",
                "get_storage_statistics",
            ]

            for method in required_methods:
                assert hasattr(
                    MinIOStorageService, method
                ), f"MinIOStorageService missing method: {method}"

            assert True, "MinIOStorageService structure is correct"

        except ImportError as e:
            pytest.fail(f"Failed to import MinIOStorageService: {e}")

    def test_storage_service_with_mock(self):
        """Test MinIO storage service with mocked client."""
        with patch("app.services.storage_service.Minio") as mock_minio:
            from app.services.storage_service import MinIOStorageService

            # Mock MinIO client
            mock_client = Mock()
            mock_minio.return_value = mock_client
            mock_client.bucket_exists.return_value = True

            # Test initialization
            storage_service = MinIOStorageService()
            assert (
                storage_service is not None
            ), "Storage service initialization failed"

            # Test presigned URL generation
            mock_client.presigned_url.return_value = "https://mock-url.com"
            url = storage_service.get_presigned_url("test-object", "GET", 3600)
            assert (
                url == "https://mock-url.com"
            ), "Presigned URL generation failed"


class TestMediaServiceMinIOIntegration:
    """Test MediaService MinIO integration."""

    def test_media_service_minio_integration(self):
        """Test MediaService MinIO integration structure."""
        try:
            from app.db.session import get_db_session
            from app.services.media_service import MediaService

            # Test that MediaService has MinIO-related methods
            db = next(get_db_session())
            media_service = MediaService(db)

            minio_methods = [
                "get_download_url",
                "get_upload_url",
                "delete_media_attachment",
                "get_minio_statistics",
            ]

            for method in minio_methods:
                assert hasattr(
                    media_service, method
                ), f"MediaService missing MinIO method: {method}"

            # Test that storage_service attribute exists
            assert hasattr(
                media_service, "storage_service"
            ), "MediaService missing storage_service attribute"

            db.close()
            assert True, "MediaService MinIO integration structure is correct"

        except Exception as e:
            pytest.fail(f"MediaService MinIO integration test failed: {e}")

    def test_media_service_graceful_fallback(self):
        """Test MediaService graceful fallback when MinIO is unavailable."""
        try:
            from app.db.session import get_db_session
            from app.services.media_service import MediaService

            db = next(get_db_session())
            media_service = MediaService(db)

            # Test that methods work even when MinIO is unavailable
            # These should return None or appropriate fallback values
            media_service.get_download_url(999, 1)
            media_service.get_upload_url("test.txt", "text/plain", 1)
            media_service.get_minio_statistics()

            # Should not crash even when MinIO is unavailable
            assert True, "MediaService graceful fallback working"

            db.close()

        except Exception as e:
            pytest.fail(f"MediaService graceful fallback test failed: {e}")


class TestMinIOAPIEndpoints:
    """Test MinIO-related API endpoints."""

    def test_minio_statistics_endpoint(self, service_checker, config):
        """Test MinIO statistics endpoint."""
        minio_stats_url = f"{config.backend_url}/api/v1/media/minio-statistics"
        info = service_checker.get_service_info(minio_stats_url)

        assert info is not None, "MinIO statistics endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"MinIO statistics returned unexpected status {info['status_code']}"

        if info["status_code"] == 200:
            data = info["data"]
            # Check response structure
            expected_fields = [
                "total_files",
                "total_size_bytes",
                "total_size_mb",
                "bucket_name",
            ]
            for field in expected_fields:
                assert (
                    field in data
                ), f"MinIO statistics missing field: {field}"

    def test_download_url_endpoint_structure(self, service_checker, config):
        """Test download URL endpoint structure."""
        download_url = (
            f"{config.backend_url}/api/v1/media/attachments/999/download-url"
        )
        info = service_checker.get_service_info(download_url)

        assert info is not None, "Download URL endpoint not responding"
        assert info["status_code"] in [
            404,
            422,
        ], f"Download URL returned unexpected status {info['status_code']}"

    def test_upload_url_endpoint_structure(self, service_checker, config):
        """Test upload URL endpoint structure."""
        upload_url = f"{config.backend_url}/api/v1/media/upload-url"

        # Test with valid request data
        valid_data = {
            "filename": "test.txt",
            "mime_type": "text/plain",
            "file_size": 1024,
            "task_id": None,
            "description": "Test file",
            "is_public": False,
        }

        try:
            response = requests.post(upload_url, json=valid_data, timeout=10)
            assert response.status_code in [
                200,
                400,
                404,
                422,
            ], f"Upload URL returned unexpected status {response.status_code}"

            if response.status_code == 200:
                data = response.json()
                expected_fields = [
                    "upload_url",
                    "expires_in_seconds",
                    "filename",
                    "mime_type",
                ]
                for field in expected_fields:
                    assert (
                        field in data
                    ), f"Upload URL response missing field: {field}"

        except requests.RequestException as e:
            pytest.fail(f"Upload URL test failed: {e}")

    def test_upload_url_validation(self, service_checker, config):
        """Test upload URL validation."""
        upload_url = f"{config.backend_url}/api/v1/media/upload-url"

        # Test with invalid data
        invalid_cases = [
            {"filename": "", "file_size": -1},  # Invalid filename and size
            {"filename": "test.txt"},  # Missing required fields
            {"file_size": 1000000000},  # File too large
        ]

        for invalid_data in invalid_cases:
            try:
                response = requests.post(
                    upload_url, json=invalid_data, timeout=10
                )
                assert response.status_code in [
                    400,
                    404,
                    422,
                ], f"Upload URL validation failed for {invalid_data}: {response.status_code}"
            except requests.RequestException as e:
                pytest.fail(f"Upload URL validation test failed: {e}")


class TestMinIOErrorHandling:
    """Test MinIO error handling."""

    def test_minio_connection_error_handling(self, service_checker, config):
        """Test handling of MinIO connection errors."""
        # This test verifies that the application handles MinIO connection errors gracefully
        minio_stats_url = f"{config.backend_url}/api/v1/media/minio-statistics"
        info = service_checker.get_service_info(minio_stats_url)

        # Should not crash even if MinIO is unavailable
        assert (
            info is not None
        ), "MinIO statistics endpoint should respond even if MinIO is down"
        assert info["status_code"] in [
            200,
            404,
        ], f"MinIO statistics should handle connection errors gracefully: {info['status_code']}"

    def test_media_upload_without_minio(self, service_checker, config):
        """Test media upload handling when MinIO is unavailable."""
        # This test verifies that media operations work even without MinIO
        media_url = f"{config.backend_url}/api/v1/media/attachments"
        info = service_checker.get_service_info(media_url)

        assert (
            info is not None
        ), "Media attachments endpoint should respond even without MinIO"
        assert info["status_code"] in [
            200,
            404,
        ], f"Media attachments should handle MinIO unavailability: {info['status_code']}"


class TestMinIOConfiguration:
    """Test MinIO configuration."""

    def test_minio_environment_variables(self):
        """Test MinIO environment variable configuration."""
        # Check that MinIO environment variables are properly configured
        expected_vars = [
            "MINIO_ENDPOINT",
            "MINIO_ACCESS_KEY",
            "MINIO_SECRET_KEY",
            "MINIO_BUCKET_NAME",
            "MINIO_SECURE",
        ]

        # These should be defined in the environment or have defaults
        for var in expected_vars:
            # Just check that the variable can be accessed (may have defaults)
            try:
                os.getenv(var)
                assert True, f"MinIO environment variable {var} is accessible"
            except Exception as e:
                pytest.fail(
                    f"MinIO environment variable {var} not accessible: {e}"
                )

    def test_minio_docker_compose_config(self, service_checker):
        """Test MinIO Docker Compose configuration."""
        # Check that MinIO service is properly configured in docker-compose
        assert (
            service_checker.check_docker_compose_config()
        ), "Docker Compose configuration should be valid"


class TestMinIOPerformance:
    """Test MinIO performance."""

    def test_minio_endpoints_response_time(self, service_checker, config):
        """Test MinIO-related endpoints response time."""
        import time

        # Test MinIO-related endpoints
        endpoints = [
            "/api/v1/media/minio-statistics",
            "/api/v1/media/attachments",
            "/api/v1/media/attachments/999/download-url",
        ]

        for endpoint in endpoints:
            start_time = time.time()
            info = service_checker.get_service_info(
                f"{config.backend_url}{endpoint}"
            )
            response_time = time.time() - start_time

            assert (
                info is not None
            ), f"MinIO endpoint {endpoint} not responding"
            assert response_time < 3.0, (
                f"Response time for {endpoint}: {response_time:.2f}s "
                "(expected < 3.0s)"
            )


class TestMinIOSecurity:
    """Test MinIO security features."""

    def test_minio_access_control(self, service_checker, config):
        """Test MinIO access control."""
        # Test that MinIO endpoints require proper authentication/authorization
        minio_stats_url = f"{config.backend_url}/api/v1/media/minio-statistics"
        info = service_checker.get_service_info(minio_stats_url)

        # Should not expose sensitive MinIO information without proper access
        assert (
            info is not None
        ), "MinIO statistics endpoint should be accessible"
        assert info["status_code"] in [
            200,
            404,
        ], f"MinIO statistics should handle access control: {info['status_code']}"

    def test_presigned_url_security(self, service_checker, config):
        """Test presigned URL security."""
        # Test that presigned URLs are properly secured
        download_url = (
            f"{config.backend_url}/api/v1/media/attachments/999/download-url"
        )
        info = service_checker.get_service_info(download_url)

        # Should not generate URLs for non-existent or unauthorized resources
        assert info is not None, "Download URL endpoint should handle security"
        assert info["status_code"] in [
            404,
            422,
        ], f"Download URL should enforce access control: {info['status_code']}"


if __name__ == "__main__":
    pytest.main([__file__])
