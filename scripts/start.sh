#!/bin/bash

# TaaskMaaster Development Startup Script
# This script sets up the development environment with minimal configuration

set -e

echo "🚀 Starting TaaskMaaster Development Environment"
echo "================================================"

# Check if .env file exists, create from example if not
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created with default settings"
    echo "   You can customize it later by editing .env"
else
    echo "✅ .env file already exists"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Build and start services
echo "🔨 Building and starting services..."
docker-compose up -d --build

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service status
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🎉 TaaskMaaster is ready!"
echo "================================================"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000"
echo "📚 API Documentation: http://localhost:8000/docs"
echo ""
echo "📝 Useful commands:"
echo "  View logs: docker-compose logs -f"
echo "  Stop services: docker-compose down"
echo "  Restart services: docker-compose restart"
echo "  Rebuild: docker-compose up -d --build"
echo ""
echo "🔍 Troubleshooting:"
echo "  If services aren't starting, check: docker-compose logs"
echo "  To reset everything: docker-compose down -v && docker-compose up -d"
