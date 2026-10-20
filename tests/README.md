# TaaskMaaster Test Suite

This directory contains comprehensive tests for the TaaskMaaster application, including Phase 2 features and MinIO integration.

## Test Structure

### Core Tests
- **`test_backend.py`** - Backend API functionality tests (updated for Phase 2)
- **`test_frontend.py`** - Frontend functionality tests
- **`test_infrastructure.py`** - Infrastructure and Docker environment tests (updated for MinIO)

### Phase 2 Feature Tests
- **`test_phase2_features.py`** - Comprehensive tests for Phase 2 features:
  - Advanced task management (templates, categories, tags, dependencies)
  - Goal tracking and progress monitoring
  - Gamification system (points, achievements, streaks)
  - Media attachment support
  - Enhanced user management

### MinIO Integration Tests
- **`test_minio_integration.py`** - MinIO object storage integration tests:
  - MinIO infrastructure setup
  - Storage service functionality
  - Media service integration
  - API endpoint testing
  - Error handling and graceful fallback
  - Security and performance testing

### Test Runner
- **`run_phase2_tests.py`** - Comprehensive test runner for Phase 2 and MinIO features

## Running Tests

### Individual Test Files

```bash
# Run Phase 2 feature tests
pytest tests/test_phase2_features.py -v

# Run MinIO integration tests
pytest tests/test_minio_integration.py -v

# Run updated backend tests
pytest tests/test_backend.py -v

# Run updated infrastructure tests
pytest tests/test_infrastructure.py -v
```

### Comprehensive Test Suite

```bash
# Run all Phase 2 and MinIO tests
python tests/run_phase2_tests.py
```

### Backend Integration Tests

```bash
# Run backend integration tests (from backend directory)
cd backend
uv run test_phase2.py
uv run test_minio_setup.py
```

## Test Categories

### Phase 2 Feature Tests

#### Advanced Task Management
- Task categories endpoint testing
- Task templates endpoint testing
- Task tags endpoint testing
- Recurring tasks endpoint testing
- Error handling for invalid task data

#### Goal Tracking
- Goals endpoint testing
- Goal progress endpoint testing
- Goal statistics endpoint testing
- Recurring goals endpoint testing
- Error handling for invalid goal data

#### Gamification
- Points endpoint testing
- Achievements endpoint testing
- Leaderboards endpoint testing
- Streaks endpoint testing

#### Media Attachments
- Media attachments endpoint testing
- Upload validation endpoint testing
- Media statistics endpoint testing

#### User Management
- Users endpoint testing
- User login endpoint testing
- Password change endpoint testing

### MinIO Integration Tests

#### Infrastructure
- MinIO container running status
- MinIO health checks
- Port exposure security testing

#### Storage Service
- MinIOStorageService initialization
- Method availability testing
- Mock client testing

#### Media Service Integration
- MediaService MinIO integration structure
- Graceful fallback when MinIO unavailable
- Error handling testing

#### API Endpoints
- MinIO statistics endpoint
- Download URL generation
- Upload URL generation
- Validation testing

#### Error Handling
- Connection error handling
- Graceful degradation testing
- Error response validation

#### Configuration
- Environment variable testing
- Docker Compose configuration testing

#### Performance
- Response time testing
- Endpoint performance validation

#### Security
- Access control testing
- Presigned URL security
- Data validation

## Test Configuration

### Environment Variables

The tests expect the following environment variables to be configured:

```bash
# Backend URL
BACKEND_URL=http://localhost:8000

# Frontend URL  
FRONTEND_URL=http://localhost:3000

# MinIO Configuration
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=taaskmaaster-media
MINIO_SECURE=false
```

### Docker Services

Tests require the following Docker services to be running:

- `taaskmaaster-backend` - Backend API service
- `taaskmaaster-frontend` - Frontend application
- `taaskmaaster-redis` - Redis cache service
- `taaskmaaster-minio` - MinIO object storage

## Test Dependencies

### Python Dependencies
- `pytest` - Test framework
- `requests` - HTTP client for API testing
- `unittest.mock` - Mocking for isolated testing

### Backend Dependencies
- `minio` - MinIO client library
- `fastapi` - Web framework
- `sqlalchemy` - Database ORM
- `pydantic` - Data validation

## Test Results

### Expected Outcomes

#### Phase 2 Features
- ✅ All Phase 2 API endpoints accessible
- ✅ Advanced task management functionality
- ✅ Goal tracking and progress monitoring
- ✅ Gamification system working
- ✅ Media attachment support
- ✅ Enhanced user management

#### MinIO Integration
- ✅ MinIO infrastructure properly configured
- ✅ Storage service functionality working
- ✅ Media service integration successful
- ✅ API endpoints responding correctly
- ✅ Graceful fallback when MinIO unavailable
- ✅ Security measures in place

### Error Handling

Tests verify proper error handling for:
- Invalid API requests
- Missing or malformed data
- MinIO connection failures
- Authentication/authorization issues
- Performance degradation

## Continuous Integration

### GitHub Actions

The test suite is designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Phase 2 Tests
  run: |
    python tests/run_phase2_tests.py
    
- name: Run Backend Integration Tests
  run: |
    cd backend
    uv run test_phase2.py
    uv run test_minio_setup.py
```

### Local Development

For local development, run tests in this order:

1. **Infrastructure tests** - Verify Docker environment
2. **Backend tests** - Verify API functionality
3. **Phase 2 feature tests** - Verify new features
4. **MinIO integration tests** - Verify storage integration
5. **Integration tests** - Verify end-to-end functionality

## Troubleshooting

### Common Issues

#### MinIO Connection Errors
- Ensure MinIO container is running
- Check environment variables
- Verify network connectivity

#### Test Import Errors
- Ensure backend directory is in Python path
- Check that all dependencies are installed
- Verify test file structure

#### API Endpoint Errors
- Ensure backend service is running
- Check API endpoint URLs
- Verify authentication if required

### Debug Commands

```bash
# Check Docker services
docker ps

# Check MinIO logs
docker logs taaskmaaster-minio

# Test MinIO connectivity
curl -f http://localhost:9000/minio/health/live

# Run tests with verbose output
pytest tests/test_phase2_features.py -v -s

# Run specific test class
pytest tests/test_minio_integration.py::TestMinIOStorageService -v
```

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Use descriptive test names
3. Include proper error handling
4. Add documentation for new test categories
5. Update this README with new test information

## Test Coverage

The test suite aims to provide comprehensive coverage of:

- ✅ API endpoint functionality
- ✅ Business logic validation
- ✅ Error handling scenarios
- ✅ Performance requirements
- ✅ Security measures
- ✅ Integration points
- ✅ Infrastructure setup

This ensures the reliability and quality of the TaaskMaaster application across all phases of development.
