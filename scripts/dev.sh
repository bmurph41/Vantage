#!/bin/bash

# Start Redis server in the background
echo "Starting Redis server..."
redis-server --daemonize yes --port 6379 --dir /tmp --save "" 2>/dev/null

# Wait briefly for Redis to be ready
sleep 1

# Check if Redis is running
if redis-cli ping > /dev/null 2>&1; then
  echo "✓ Redis is ready on port 6379"
else
  echo "⚠ Redis may not have started (will use in-memory fallback)"
fi

# Start the application
NODE_ENV=development tsx server/index.ts
