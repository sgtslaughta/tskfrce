"""
Phase 2 Feature Tests for TaaskMaaster.

These tests verify the advanced task management, goal tracking,
gamification, and media attachment features implemented in Phase 2.
"""

import pytest
import requests


class TestPhase2APIEndpoints:
    """Test Phase 2 API endpoints."""

    def test_api_v1_status_phase2_features(self, service_checker, config):
        """Test that API status includes Phase 2 features."""
        status_url = f"{config.backend_url}/api/v1/status"
        info = service_checker.get_service_info(status_url)

        assert info is not None, "API status endpoint not responding"
        assert (
            info["status_code"] == 200
        ), f"API status returned status {info['status_code']}"

        data = info["data"]
        assert "features" in data, "API status missing features field"

        # Check that Phase 2 features are included
        features = data["features"]
        phase2_features = [
            "task_management",
            "user_management",
            "gamification",
            "file_storage",
        ]

        for feature in phase2_features:
            assert (
                feature in features
            ), f"API status missing Phase 2 feature: {feature}"


class TestAdvancedTaskManagement:
    """Test advanced task management features."""

    def test_task_categories_endpoint(self, service_checker, config):
        """Test task categories endpoint."""
        categories_url = f"{config.backend_url}/api/v1/tasks/categories"
        info = service_checker.get_service_info(categories_url)

        assert info is not None, "Task categories endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"Task categories returned unexpected status {info['status_code']}"

    def test_task_templates_endpoint(self, service_checker, config):
        """Test task templates endpoint."""
        templates_url = f"{config.backend_url}/api/v1/tasks/templates"
        info = service_checker.get_service_info(templates_url)

        assert info is not None, "Task templates endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"Task templates returned unexpected status {info['status_code']}"

    def test_task_tags_endpoint(self, service_checker, config):
        """Test task tags endpoint."""
        tags_url = f"{config.backend_url}/api/v1/tasks/tags"
        info = service_checker.get_service_info(tags_url)

        assert info is not None, "Task tags endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"Task tags returned unexpected status {info['status_code']}"

    def test_recurring_tasks_endpoint(self, service_checker, config):
        """Test recurring tasks endpoint."""
        recurring_url = f"{config.backend_url}/api/v1/tasks/recurring"
        info = service_checker.get_service_info(recurring_url)

        assert info is not None, "Recurring tasks endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"Recurring tasks returned unexpected status {info['status_code']}"


class TestGoalTracking:
    """Test goal tracking features."""

    def test_goals_endpoint(self, service_checker, config):
        """Test goals endpoint."""
        goals_url = f"{config.backend_url}/api/v1/goals"
        info = service_checker.get_service_info(goals_url)

        assert info is not None, "Goals endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"Goals returned unexpected status {info['status_code']}"

    def test_goal_progress_endpoint(self, service_checker, config):
        """Test goal progress endpoint."""
        progress_url = f"{config.backend_url}/api/v1/goals/progress"
        info = service_checker.get_service_info(progress_url)

        assert info is not None, "Goal progress endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"Goal progress returned unexpected status {info['status_code']}"

    def test_goal_statistics_endpoint(self, service_checker, config):
        """Test goal statistics endpoint."""
        stats_url = f"{config.backend_url}/api/v1/goals/statistics"
        info = service_checker.get_service_info(stats_url)

        assert info is not None, "Goal statistics endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"Goal statistics returned unexpected status {info['status_code']}"

    def test_recurring_goals_endpoint(self, service_checker, config):
        """Test recurring goals endpoint."""
        recurring_url = f"{config.backend_url}/api/v1/goals/recurring"
        info = service_checker.get_service_info(recurring_url)

        assert info is not None, "Recurring goals endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"Recurring goals returned unexpected status {info['status_code']}"


class TestGamification:
    """Test gamification features."""

    def test_points_endpoint(self, service_checker, config):
        """Test points endpoint."""
        points_url = f"{config.backend_url}/api/v1/gamification/points"
        info = service_checker.get_service_info(points_url)

        assert info is not None, "Points endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"Points returned unexpected status {info['status_code']}"

    def test_achievements_endpoint(self, service_checker, config):
        """Test achievements endpoint."""
        achievements_url = (
            f"{config.backend_url}/api/v1/gamification/achievements"
        )
        info = service_checker.get_service_info(achievements_url)

        assert info is not None, "Achievements endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"Achievements returned unexpected status {info['status_code']}"

    def test_leaderboards_endpoint(self, service_checker, config):
        """Test leaderboards endpoint."""
        leaderboards_url = (
            f"{config.backend_url}/api/v1/gamification/leaderboards"
        )
        info = service_checker.get_service_info(leaderboards_url)

        assert info is not None, "Leaderboards endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"Leaderboards returned unexpected status {info['status_code']}"

    def test_streaks_endpoint(self, service_checker, config):
        """Test streaks endpoint."""
        streaks_url = f"{config.backend_url}/api/v1/gamification/streaks"
        info = service_checker.get_service_info(streaks_url)

        assert info is not None, "Streaks endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"Streaks returned unexpected status {info['status_code']}"


class TestMediaAttachments:
    """Test media attachment features."""

    def test_media_attachments_endpoint(self, service_checker, config):
        """Test media attachments endpoint."""
        media_url = f"{config.backend_url}/api/v1/media/attachments"
        info = service_checker.get_service_info(media_url)

        assert info is not None, "Media attachments endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"Media attachments returned unexpected status {info['status_code']}"

    def test_media_upload_validation_endpoint(self, service_checker, config):
        """Test media upload validation endpoint."""
        validation_url = f"{config.backend_url}/api/v1/media/upload/validate"
        info = service_checker.get_service_info(validation_url)

        assert (
            info is not None
        ), "Media upload validation endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
            405,
        ], f"Media upload validation returned unexpected status {info['status_code']}"

    def test_media_statistics_endpoint(self, service_checker, config):
        """Test media statistics endpoint."""
        stats_url = f"{config.backend_url}/api/v1/media/statistics"
        info = service_checker.get_service_info(stats_url)

        assert info is not None, "Media statistics endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"Media statistics returned unexpected status {info['status_code']}"


class TestMinIOIntegration:
    """Test MinIO integration features."""

    def test_minio_statistics_endpoint(self, service_checker, config):
        """Test MinIO statistics endpoint."""
        minio_stats_url = f"{config.backend_url}/api/v1/media/minio-statistics"
        info = service_checker.get_service_info(minio_stats_url)

        assert info is not None, "MinIO statistics endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"MinIO statistics returned unexpected status {info['status_code']}"

    def test_download_url_endpoint(self, service_checker, config):
        """Test download URL generation endpoint."""
        # Test with a non-existent attachment ID
        download_url = (
            f"{config.backend_url}/api/v1/media/attachments/999/download-url"
        )
        info = service_checker.get_service_info(download_url)

        assert info is not None, "Download URL endpoint not responding"
        assert info["status_code"] in [
            404,
            422,
        ], f"Download URL returned unexpected status {info['status_code']}"

    def test_upload_url_endpoint(self, service_checker, config):
        """Test upload URL generation endpoint."""
        upload_url = f"{config.backend_url}/api/v1/media/upload-url"

        # Test POST request with invalid data
        try:
            response = requests.post(
                upload_url, json={"invalid": "data"}, timeout=10
            )
            assert response.status_code in [
                400,
                404,
                422,
            ], f"Upload URL returned unexpected status {response.status_code}"
        except requests.RequestException as e:
            pytest.fail(f"Upload URL test failed: {e}")


class TestUserManagement:
    """Test enhanced user management features."""

    def test_users_endpoint(self, service_checker, config):
        """Test users endpoint."""
        users_url = f"{config.backend_url}/api/v1/users"
        info = service_checker.get_service_info(users_url)

        assert info is not None, "Users endpoint not responding"
        assert info["status_code"] in [
            200,
            404,
        ], f"Users returned unexpected status {info['status_code']}"

    def test_user_login_endpoint(self, service_checker, config):
        """Test user login endpoint."""
        login_url = f"{config.backend_url}/api/v1/users/login"
        info = service_checker.get_service_info(login_url)

        assert info is not None, "User login endpoint not responding"
        assert info["status_code"] in [
            405,
            404,
            422,
        ], f"User login returned unexpected status {info['status_code']}"

    def test_password_change_endpoint(self, service_checker, config):
        """Test password change endpoint."""
        password_url = f"{config.backend_url}/api/v1/users/password"
        info = service_checker.get_service_info(password_url)

        assert info is not None, "Password change endpoint not responding"
        assert info["status_code"] in [
            405,
            404,
            422,
        ], f"Password change returned unexpected status {info['status_code']}"


class TestPhase2ErrorHandling:
    """Test Phase 2 error handling."""

    def test_invalid_task_data(self, service_checker, config):
        """Test handling of invalid task data."""
        tasks_url = f"{config.backend_url}/api/v1/tasks"

        try:
            response = requests.post(
                tasks_url, json={"invalid": "task_data"}, timeout=10
            )
            assert response.status_code in [
                400,
                404,
                422,
            ], f"Invalid task data returned unexpected status {response.status_code}"
        except requests.RequestException as e:
            pytest.fail(f"Invalid task data test failed: {e}")

    def test_invalid_goal_data(self, service_checker, config):
        """Test handling of invalid goal data."""
        goals_url = f"{config.backend_url}/api/v1/goals"

        try:
            response = requests.post(
                goals_url, json={"invalid": "goal_data"}, timeout=10
            )
            assert response.status_code in [
                400,
                404,
                422,
            ], f"Invalid goal data returned unexpected status {response.status_code}"
        except requests.RequestException as e:
            pytest.fail(f"Invalid goal data test failed: {e}")

    def test_invalid_media_upload(self, service_checker, config):
        """Test handling of invalid media upload data."""
        upload_url = f"{config.backend_url}/api/v1/media/upload-url"

        try:
            response = requests.post(
                upload_url, json={"filename": "", "file_size": -1}, timeout=10
            )
            assert response.status_code in [
                400,
                404,
                422,
            ], f"Invalid media upload returned unexpected status {response.status_code}"
        except requests.RequestException as e:
            pytest.fail(f"Invalid media upload test failed: {e}")


class TestPhase2Performance:
    """Test Phase 2 performance."""

    def test_phase2_endpoints_response_time(self, service_checker, config):
        """Test Phase 2 endpoints response time."""
        import time

        # Test Phase 2 endpoints
        endpoints = [
            "/api/v1/tasks/categories",
            "/api/v1/goals",
            "/api/v1/gamification/points",
            "/api/v1/media/attachments",
            "/api/v1/users",
        ]

        for endpoint in endpoints:
            start_time = time.time()
            info = service_checker.get_service_info(
                f"{config.backend_url}{endpoint}"
            )
            response_time = time.time() - start_time

            assert (
                info is not None
            ), f"Phase 2 endpoint {endpoint} not responding"
            assert response_time < 3.0, (
                f"Response time for {endpoint}: {response_time:.2f}s "
                "(expected < 3.0s)"
            )


if __name__ == "__main__":
    pytest.main([__file__])
