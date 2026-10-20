#!/bin/sh
# entrypoint.sh

# Wait for Redis
until nc -z redis 6379; do
  echo "Waiting for Redis..."
  sleep 1
done

# Wait for MinIO
until nc -z minio 9000; do
  echo "Waiting for MinIO..."
  sleep 1
done

# Start the application
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
