#!/bin/sh
# entrypoint.sh
set -e

# Apply database migrations
alembic upgrade head

# Start the application (auto-reload only in development)
RELOAD=""
if [ "$ENVIRONMENT" = "development" ]; then
  RELOAD="--reload"
fi
# No access log: websocket URLs carry ?token=<JWT>; the app logs paths itself.
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log $RELOAD
