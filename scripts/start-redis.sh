#!/bin/bash

# Start Redis server in the background
echo "Starting Redis server..."
redis-server --daemonize yes --port 6379 --dir /tmp --save ""

# Wait for Redis to be ready
for i in {1..10}; do
  if redis-cli ping > /dev/null 2>&1; then
    echo "Redis is ready!"
    exit 0
  fi
  echo "Waiting for Redis to start... ($i/10)"
  sleep 1
done

echo "Warning: Redis may not have started properly"
exit 0
