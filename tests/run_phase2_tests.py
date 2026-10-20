#!/usr/bin/env python3
"""
Phase 2 Test Runner for TaaskMaaster.

This script runs comprehensive tests for Phase 2 features and MinIO integration.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest


def run_test_suite(test_file, description):
    """Run a specific test suite and return results."""
    print(f"\n{'=' * 60}")
    print(f"Running {description}")
    print(f"{'=' * 60}")

    try:
        # Run pytest on the specific test file
        result = pytest.main(
            [test_file, "-v", "--tb=short", "--no-header", "--no-summary"]
        )

        if result == 0:
            print(f"✅ {description} - PASSED")
            return True
        else:
            print(f"❌ {description} - FAILED")
            return False

    except Exception as e:
        print(f"❌ {description} - ERROR: {e}")
        return False


def run_phase2_tests():
    """Run all Phase 2 and MinIO integration tests."""
    print("🚀 TaaskMaaster Phase 2 Test Suite")
    print("=" * 60)

    # Get the tests directory
    tests_dir = Path(__file__).parent
    backend_dir = tests_dir.parent / "backend"

    # Add backend to Python path for imports
    sys.path.insert(0, str(backend_dir))

    # Test results tracking
    results = []

    # 1. Phase 2 Feature Tests
    phase2_test_file = tests_dir / "test_phase2_features.py"
    if phase2_test_file.exists():
        results.append(
            (
                run_test_suite(str(phase2_test_file), "Phase 2 Feature Tests"),
                "Phase 2 Feature Tests",
            )
        )
    else:
        print("❌ Phase 2 feature tests file not found")
        results.append((False, "Phase 2 Feature Tests"))

    # 2. MinIO Integration Tests
    minio_test_file = tests_dir / "test_minio_integration.py"
    if minio_test_file.exists():
        results.append(
            (
                run_test_suite(
                    str(minio_test_file), "MinIO Integration Tests"
                ),
                "MinIO Integration Tests",
            )
        )
    else:
        print("❌ MinIO integration tests file not found")
        results.append((False, "MinIO Integration Tests"))

    # 3. Updated Backend Tests
    backend_test_file = tests_dir / "test_backend.py"
    if backend_test_file.exists():
        results.append(
            (
                run_test_suite(
                    str(backend_test_file), "Updated Backend Tests"
                ),
                "Updated Backend Tests",
            )
        )
    else:
        print("❌ Backend tests file not found")
        results.append((False, "Updated Backend Tests"))

    # 4. Updated Infrastructure Tests
    infrastructure_test_file = tests_dir / "test_infrastructure.py"
    if infrastructure_test_file.exists():
        results.append(
            (
                run_test_suite(
                    str(infrastructure_test_file),
                    "Updated Infrastructure Tests",
                ),
                "Updated Infrastructure Tests",
            )
        )
    else:
        print("❌ Infrastructure tests file not found")
        results.append((False, "Updated Infrastructure Tests"))

    # 5. Run backend integration tests (if available)
    backend_integration_test = backend_dir / "test_phase2.py"
    if backend_integration_test.exists():
        print(f"\n{'=' * 60}")
        print("Running Backend Integration Tests")
        print(f"{'=' * 60}")

        try:
            # Change to backend directory and run the test
            original_cwd = os.getcwd()
            os.chdir(backend_dir)

            result = subprocess.run(
                ["uv", "run", "test_phase2.py"],
                capture_output=True,
                text=True,
                timeout=60,
            )

            if result.returncode == 0:
                print("✅ Backend Integration Tests - PASSED")
                results.append((True, "Backend Integration Tests"))
            else:
                print("❌ Backend Integration Tests - FAILED")
                print(f"Error: {result.stderr}")
                results.append((False, "Backend Integration Tests"))

            os.chdir(original_cwd)

        except Exception as e:
            print(f"❌ Backend Integration Tests - ERROR: {e}")
            results.append((False, "Backend Integration Tests"))

    # 6. Run MinIO setup tests (if available)
    minio_setup_test = backend_dir / "test_minio_setup.py"
    if minio_setup_test.exists():
        print(f"\n{'=' * 60}")
        print("Running MinIO Setup Tests")
        print(f"{'=' * 60}")

        try:
            # Change to backend directory and run the test
            original_cwd = os.getcwd()
            os.chdir(backend_dir)

            result = subprocess.run(
                ["uv", "run", "test_minio_setup.py"],
                capture_output=True,
                text=True,
                timeout=60,
            )

            if result.returncode == 0:
                print("✅ MinIO Setup Tests - PASSED")
                results.append((True, "MinIO Setup Tests"))
            else:
                print("❌ MinIO Setup Tests - FAILED")
                print(f"Error: {result.stderr}")
                results.append((False, "MinIO Setup Tests"))

            os.chdir(original_cwd)

        except Exception as e:
            print(f"❌ MinIO Setup Tests - ERROR: {e}")
            results.append((False, "MinIO Setup Tests"))

    # Print summary
    print(f"\n{'=' * 60}")
    print("PHASE 2 TEST SUMMARY")
    print(f"{'=' * 60}")

    passed = 0
    total = len(results)

    for success, test_name in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status}: {test_name}")
        if success:
            passed += 1

    print(f"\nResults: {passed}/{total} test suites passed")

    if passed == total:
        print("🎉 All Phase 2 tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed. Please review the output above.")
        return 1


def main():
    """Main function to run Phase 2 tests."""
    try:
        exit_code = run_phase2_tests()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test runner failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
