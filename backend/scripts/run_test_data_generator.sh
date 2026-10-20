#!/bin/bash

# Test Data Generator Runner Script for TaaskMaaster
# This script sets up the environment and runs the test data generator

set -e

echo "TaaskMaaster Test Data Generator"
echo "================================="

# Check if we're in the right directory
if [ ! -f "backend/scripts/create_test_data.py" ]; then
    echo "Error: Please run this script from the project root directory"
    exit 1
fi

# Change to backend directory
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ] && [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Install dependencies if needed
if [ ! -f "requirements.txt" ]; then
    echo "Error: requirements.txt not found"
    exit 1
fi

echo "Installing dependencies..."
pip install -r requirements.txt

# Run the test data generator
echo "Running test data generator..."
python scripts/create_test_data.py

echo "Test data generation completed!"
echo "You can now start the application and see the generated data."
