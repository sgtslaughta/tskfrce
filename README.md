# 🏠 TaaskMaaster

> **A comprehensive family task management system with gamification**  
> Transform household chores into engaging activities that motivate children and organize family life.

<div align="center">

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 18+](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-green.svg)](https://github.com/features/actions)

</div>

## ✨ Features

### 🎯 **Core Task Management**
- **Smart Task Creation**: Flexible task framework with templates, lists, and goals
- **Role-Based Access**: User, Organizer, and Admin roles with appropriate permissions
- **Workflow Management**: Task approval system with step-by-step progress tracking
- **Real-time Updates**: Live notifications and status changes via WebSocket

### 🎮 **Gamification System**
- **Points & Rewards**: Earn points for completed tasks with custom reward system
- **Achievements**: Unlock badges and milestones for consistent performance
- **Leaderboards**: Family-friendly competition with user flair
- **Streak Tracking**: Build momentum with consecutive task completion

### 🔧 **Technical Excellence**
- **Containerized Deployment**: Full Docker Compose setup for easy deployment
- **Modern Frontend**: Next.js 14 with TypeScript, Tailwind CSS, and responsive design
- **Robust Backend**: FastAPI with SQLAlchemy, Redis caching, and comprehensive API
- **File Storage**: MinIO integration for photos and media attachments
- **Security**: JWT authentication, rate limiting, and security scanning
- **Monitoring**: Health checks, metrics, and comprehensive logging

### 🚀 **Advanced Features**
- **Real-time Messaging**: Task comments and direct messaging
- **Media Support**: Photo/video attachments for task verification
- **Progressive Web App**: Mobile-friendly with offline capabilities
- **Comprehensive Testing**: Automated testing with coverage reports
- **CI/CD Pipeline**: Automated builds, testing, and deployment

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (Required)
- **Git** (Required)
- **Node.js 18+** (Optional - for local development)
- **Python 3.11+** (Optional - for local development)

### 🐳 Docker Setup (Recommended)

#### Option 1: One-Command Start
```bash
# Clone and start everything
git clone <repository-url>
cd taaskMaaster
./scripts/start.sh
```

#### Option 2: Manual Docker Setup
```bash
# 1. Clone the repository
git clone <repository-url>
cd taaskMaaster

# 2. (Optional) Copy and customize environment
cp .env.example .env
# Edit .env for custom settings like ports or security keys

# 3. Start all services
docker-compose up -d

# 4. Wait for services to be ready (~30 seconds)
docker-compose logs -f
```

### 🌐 Access Your Application

Once Docker containers are running:

| Service | URL | Description |
|---------|-----|-------------|
| **🏠 Frontend App** | http://localhost:3000 | Main application interface |
| **🔧 Backend API** | http://localhost:8000 | REST API endpoints |
| **📚 API Docs** | http://localhost:8000/docs | Interactive API documentation |
| **📊 Health Check** | http://localhost:8000/health | Service status |

### 👤 Default Login

```
Email: admin@taaskmaaster.com
Password: admin123
```

### 🔧 Service Status

Check if all services are running:
```bash
docker-compose ps
```

View logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f backend
```

## 💻 Local Development

For development without Docker:

### Backend Development
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies using uv (recommended)
pip install uv
uv pip install -r requirements.txt

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Database Management
```bash
# Run migrations
cd backend
uv run alembic upgrade head

# Create new migration
uv run alembic revision --autogenerate -m "Description"

# Generate test data
python scripts/create_test_data.py
```

## 📁 Project Structure

```
taaskMaaster/
├── 🐍 backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── api/                   # REST API endpoints
│   │   │   ├── auth.py           # Authentication & JWT
│   │   │   ├── tasks.py          # Task management
│   │   │   ├── users.py          # User management
│   │   │   ├── notifications.py  # Real-time notifications
│   │   │   ├── messaging.py      # Direct messaging
│   │   │   ├── gamification.py   # Points & achievements
│   │   │   ├── workflow.py       # Task workflow system
│   │   │   └── websocket.py      # WebSocket connections
│   │   ├── models/               # Database models (SQLAlchemy)
│   │   ├── schemas/              # Pydantic data schemas
│   │   ├── services/             # Business logic layer
│   │   ├── core/                 # Configuration & security
│   │   └── db/                   # Database configuration
│   ├── alembic/                  # Database migrations
│   ├── scripts/                  # Utility scripts
│   └── tests/                    # Backend tests
├── ⚛️ frontend/                   # Next.js Frontend
│   ├── src/
│   │   ├── components/           # React components
│   │   │   ├── pages/           # Page components
│   │   │   ├── tasks/           # Task-related components
│   │   │   ├── workflow/        # Workflow components
│   │   │   ├── notifications/   # Notification system
│   │   │   └── navigation/      # Navigation components
│   │   ├── services/            # API service layer
│   │   ├── contexts/            # React contexts (Auth, Theme, etc.)
│   │   ├── hooks/               # Custom React hooks
│   │   ├── design-system/       # UI component library
│   │   └── utils/               # Utility functions
│   ├── pages/                   # Next.js routing
│   └── public/                  # Static assets & favicons
├── 🐳 docker-compose.yml         # Container orchestration
├── 📋 tests/                     # Integration tests
├── 📚 docs/                      # Project documentation
├── 🔧 scripts/                   # Development scripts
└── 🚀 .github/workflows/         # CI/CD automation
```

## 📖 API Documentation

Interactive API documentation is automatically generated:

| Interface | URL | Description |
|-----------|-----|-------------|
| **Swagger UI** | http://localhost:8000/docs | Interactive API testing |
| **ReDoc** | http://localhost:8000/redoc | Clean API documentation |
| **OpenAPI Schema** | http://localhost:8000/openapi.json | Machine-readable API spec |

### Key API Endpoints

```
Authentication:
POST   /api/v1/auth/login          # User login
POST   /api/v1/auth/refresh        # Token refresh
POST   /api/v1/auth/logout         # User logout

Tasks:
GET    /api/v1/tasks               # List tasks
POST   /api/v1/tasks               # Create task
GET    /api/v1/tasks/{id}          # Get task details
PUT    /api/v1/tasks/{id}          # Update task
DELETE /api/v1/tasks/{id}          # Delete task

Workflow:
POST   /api/v1/workflow/transition # Change task status

Notifications:
GET    /api/v1/notifications       # Get notifications
PUT    /api/v1/notifications/{id}  # Mark as read
DELETE /api/v1/notifications/{id}  # Delete notification

WebSocket:
WS     /api/v1/ws                  # Real-time updates
```

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

## 🔒 Security & Configuration

### Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
# Security (CHANGE IN PRODUCTION!)
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here

# Database
DATABASE_URL=sqlite:///./taaskmaaster.db
# DATABASE_URL=postgresql://user:pass@postgres:5432/taaskmaaster

# Services (Internal - defaults are fine)
REDIS_URL=redis://redis:6379
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123

# Application
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Production Deployment

1. **Update security keys** in `.env`
2. **Use PostgreSQL** instead of SQLite
3. **Configure reverse proxy** (nginx/traefik)
4. **Enable HTTPS** with SSL certificates
5. **Set up monitoring** and log aggregation

## 🛠️ Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check Docker is running
docker info

# Reset everything
docker-compose down -v
docker-compose up -d --build
```

**Database issues:**
```bash
# Reset database
docker-compose down -v
docker-compose up -d

# Or run migrations manually
cd backend && uv run alembic upgrade head
```

**Port conflicts:**
```bash
# Check what's using ports 3000/8000
lsof -i :3000
lsof -i :8000

# Or change ports in .env
FRONTEND_PORT=127.0.0.1:3001
BACKEND_PORT=127.0.0.1:8001
```

## 📄 License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

> **Note:** This is copyleft software - any derivative works must also be open source under GPL v3.

## 🤝 Contributing

We welcome contributions! Please see our [contribution guidelines](CONTRIBUTING.md).

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Write** tests for your changes
4. **Ensure** all tests pass (`python run_tests.py`)
5. **Commit** your changes (`git commit -m 'Add amazing feature'`)
6. **Push** to the branch (`git push origin feature/amazing-feature`)
7. **Open** a Pull Request

### Code Standards

- **Python**: Follow PEP 8, use Black for formatting
- **TypeScript**: Follow project ESLint configuration
- **Tests**: Maintain >90% code coverage
- **Documentation**: Update docs for new features

## 🎯 Roadmap

- [x] **Phase 1**: Core task management system
- [x] **Phase 2**: Real-time notifications & messaging
- [x] **Phase 3**: Workflow management & approvals
- [ ] **Phase 4**: Advanced gamification features
- [ ] **Phase 5**: Mobile app (React Native)
- [ ] **Phase 6**: Network device integration
- [ ] **Phase 7**: AI-powered task suggestions

See [implementation plan](docs/implementation_plan.md) for detailed timelines.

## 📞 Support

**Need help?**

- 🐛 **Bug Reports**: [Create an issue](https://github.com/your-org/taaskmaaster/issues)
- 💡 **Feature Requests**: [Discussion board](https://github.com/your-org/taaskmaaster/discussions)
- 📚 **Documentation**: Check the `docs/` directory
- 🔧 **API Help**: Visit http://localhost:8000/docs

**Community:**
- 💬 Join our [Discord server](https://discord.gg/taaskmaaster)
- 🐦 Follow us on [Twitter](https://twitter.com/taaskmaaster)

---

<div align="center">

**⭐ Star this repository if TaaskMaaster helps your family stay organized! ⭐**

Made with ❤️ by the TaaskMaaster Team

</div>
