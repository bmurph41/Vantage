#!/bin/bash
# Kill any existing loops
pkill -f run-loop.sh 2>/dev/null
sleep 2
# Start fresh
exec bash ~/workspace/agents/run-loop.sh 10
