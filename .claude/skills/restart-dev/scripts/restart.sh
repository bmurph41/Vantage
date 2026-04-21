#!/usr/bin/env bash
# Restart the MarinaMatch dev server cleanly and probe health.
# CLAUDE.md flags "route change has no effect" as a top failure mode — this script
# eliminates that whole class of bug.

set -e

echo "Killing tsx server..."
pkill -f 'tsx server' 2>/dev/null || echo "  (no running server found)"

# Give the OS a moment to free the port
sleep 1

echo "Starting dev server in background..."
cd /home/runner/workspace
nohup npm run dev > /tmp/devserver.log 2>&1 &
DEV_PID=$!
echo "  PID=$DEV_PID, log=/tmp/devserver.log"

# Probe health for up to 15 seconds
echo "Probing /api/health..."
for i in $(seq 1 15); do
  sleep 1
  if curl -sf http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "  ✓ Server healthy after ${i}s"
    exit 0
  fi
done

echo "  ✗ Server did not become healthy within 15s"
echo "Last 30 lines of /tmp/devserver.log:"
tail -30 /tmp/devserver.log
exit 1
