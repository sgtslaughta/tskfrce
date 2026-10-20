# TaaskMaaster

A comprehensive task management system designed to help parents encourage children to complete household tasks through gamification and rewards.

## Features

- **Containerized Deployment**: Full Docker Compose setup for easy deployment
- **Modern Web Frontend**: Next.js with TypeScript and Tailwind CSS
- **Robust Backend**: FastAPI with SQLAlchemy and comprehensive API
- **File Storage**: MinIO integration for media and file storage
- **Authentication**: JWT-based auth with optional OAuth/SSO support
- **Gamification**: Points, achievements, leaderboards, and rewards
- **Task Management**: Flexible task creation, lists, goals, and templates
- **Monitoring**: Prometheus metrics and health checks
- **CI/CD**: GitHub Actions with container registry and security scanning

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)

### Development Setup

#### Quick Start (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd taaskMaaster

# Start everything with one command
./scripts/start.sh
```

#### Manual Setup
1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd taaskMaaster
   ```

2. **Copy environment configuration (optional)**
   ```bash
   cp .env.example .env
   # Edit .env if you need custom settings
   ```

3. **Start the development environment**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs
   - MinIO Console: http://localhost:9001
   - Redis: localhost:6379

### Local Development

#### Backend Development

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

#### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
taaskMaaster/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Core configuration
│   │   ├── db/             # Database models and migrations
│   │   ├── models/         # Pydantic models
│   │   ├── schemas/        # Data schemas
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utility functions
│   ├── tests/              # Backend tests
│   └── requirements.txt    # Python dependencies
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Next.js pages
│   │   ├── styles/         # CSS and styling
│   │   ├── utils/          # Utility functions
│   │   ├── hooks/          # Custom React hooks
│   │   └── contexts/       # React contexts
│   └── package.json        # Node.js dependencies
├── docker/                 # Docker configurations
├── docs/                   # Documentation
├── scripts/                # Utility scripts
├── .github/workflows/      # CI/CD pipelines
└── docker-compose.yml      # Development environment
```

## API Documentation

The API documentation is automatically generated and available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Testing

### Python Test Suite (Recommended)

We've converted to a comprehensive Python-based testing framework using pytest.

#### Quick Start
```bash
# Install test dependencies
pip install -r tests/requirements.txt

# Run all tests
python run_tests.py

# Run quick tests (skip slow tests)
python run_tests.py quick

# Run with verbose output
python run_tests.py -v all
```

#### Test Types

```bash
# Infrastructure tests (Docker, services, connectivity)
python run_tests.py infrastructure

# Backend API tests
python run_tests.py backend

# Frontend tests
python run_tests.py frontend

# Integration tests
python run_tests.py integration

# Generate coverage report
python run_tests.py coverage
```

#### Advanced Usage

```bash
# Start services before testing
python run_tests.py -s all

# Stop services after testing
python run_tests.py -S all

# Run specific test file
pytest tests/test_infrastructure.py -v

# Run with coverage
pytest tests/ --cov=backend/app --cov-report=html
```

### Test Coverage

The Python test suite includes:

- **🏗️ Infrastructure Tests**: Docker environment, service status, network connectivity
- **🔧 Backend Tests**: API endpoints, health checks, error handling, security
- **🌐 Frontend Tests**: Page loading, HTML structure, API connectivity
- **🔗 Integration Tests**: Service communication, data flow
- **🔒 Security Tests**: Headers, CORS, port exposure
- **⚡ Performance Tests**: Response times, concurrent requests
- **📊 Coverage Reports**: HTML and terminal coverage reports

### Test Features

- **🎯 Comprehensive Coverage**: Tests all aspects of the system
- **⚡ Fast Execution**: Parallel test execution with pytest-xdist
- **📊 Detailed Reporting**: HTML reports, coverage analysis
- **🔧 Easy Configuration**: Environment-based configuration
- **🛠️ Flexible Test Selection**: Run specific test categories
- **🚀 Service Management**: Automatic service startup/shutdown
- **📝 Clear Documentation**: Well-documented test cases

### Test Reports

After running tests, you'll get:
- ✅/❌ Pass/fail indicators for each test
- 📊 Performance metrics (response times)
- 🔒 Security assessment results
- 📈 Coverage reports (HTML and terminal)
- 🐛 Detailed error messages and stack traces
- 💡 Troubleshooting suggestions for failed tests

## Deployment

### Production Deployment

1. **Set up production environment**
   ```bash
   cp .env.example .env.prod
   # Configure production settings
   ```

2. **Build and deploy**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Docker Registry

Images are automatically built and pushed to GitHub Container Registry:
- Backend: `ghcr.io/your-org/taaskmaaster/backend:latest`
- Frontend: `ghcr.io/your-org/taaskmaaster/frontend:latest`

## Monitoring

### Health Checks
- Application: http://localhost:8000/health
- Metrics: http://localhost:8000/metrics

### Logs
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style and conventions
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `docs/` directory
- Review the API documentation at `/docs`

## Roadmap

See the [implementation plan](docs/implementation_plan.md) for detailed development phases and timelines.
