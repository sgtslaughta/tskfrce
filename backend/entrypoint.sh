#!/bin/sh
# entrypoint.sh
set -e

# Back up the DB before migrating when it is not already at head
if ! alembic current 2>/dev/null | grep -q "(head)"; then
  python -m app.utils.backup_db
fi

# Apply database migrations
alembic upgrade head

# Start the application (auto-reload only in development)
RELOAD=""
if [ "$ENVIRONMENT" = "development" ]; then
  RELOAD="--reload"
fi
# No access log: websocket URLs carry ?token=<JWT>; the app logs paths itself.
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log $RELOAD
