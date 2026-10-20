#!/bin/sh
# entrypoint.sh
set -e

# Bind-mounted data dir may be root-owned: fix it, then drop privileges
if [ "$(id -u)" = "0" ]; then
  DATA_DIR="${DATA_DIR:-/app/data}"
  mkdir -p "$DATA_DIR"
  chown appuser:appuser "$DATA_DIR"
  exec gosu appuser "$0" "$@"
fi

# Apply database migrations
alembic upgrade head

# Start the application (auto-reload only in development)
RELOAD=""
if [ "$ENVIRONMENT" = "development" ]; then
  RELOAD="--reload"
fi
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 $RELOAD
