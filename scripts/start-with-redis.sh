#!/bin/bash

# Function to cleanup on exit
cleanup() {
  echo "Shutting down Redis..."
  redis-cli shutdown 2>/dev/null || true
  exit 0
}

# Set trap to cleanup on exit
trap cleanup EXIT INT TERM

# Start Redis in the background
echo "Starting Redis server on port 6379..."
redis-server --port 6379 --dir /tmp --save "" --daemonize no &
REDIS_PID=$!

# Wait for Redis to be ready
for i in {1..10}; do
  if redis-cli ping > /dev/null 2>&1; then
    echo "✓ Redis is ready on port 6379"
    break
  fi
  if [ $i -eq 10 ]; then
    echo "⚠ Redis startup timeout (will use in-memory fallback)"
  fi
  sleep 0.5
done

# Start the application
echo "Starting application..."
NODE_ENV=development tsx server/index.ts

# When the app exits, cleanup will run automatically
