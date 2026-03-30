#!/bin/bash
WORKSPACE=~/workspace
INTERVAL=${1:-10}
LOG="$WORKSPACE/agent-logs/run-loop.log"
mkdir -p "$WORKSPACE/agent-logs"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Loop started (every ${INTERVAL}m). PID: $$" | tee -a "$LOG"
while true; do
  TODO=$(grep -c '\[todo\]' "$WORKSPACE/AGENT_QUEUE.md" 2>/dev/null || echo 0)
  if [ "$TODO" -gt 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $TODO task(s) — running orchestrator" | tee -a "$LOG"
    node "$WORKSPACE/agents/orchestrator.mjs" 2>&1 | tee -a "$LOG"
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Queue empty — sleeping ${INTERVAL}m" | tee -a "$LOG"
  fi
  sleep $((INTERVAL * 60))
done
