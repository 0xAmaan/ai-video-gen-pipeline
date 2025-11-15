#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./kill-dev.sh            # kills defaults (3000, 3001, 3002, 3210)
#   ./kill-dev.sh 3000 3210  # kills specific ports
#
# Helps stop stray dev servers (Next.js, Convex, etc.) that may occupy local ports.

ports=("$@")
if [ ${#ports[@]} -eq 0 ]; then
  ports=(3000 3001 3002 3210)
fi

for port in "${ports[@]}"; do
  if pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null); then
    echo "Killing processes on port $port: $pids"
    kill -9 $pids || true
  else
    echo "No listeners on port $port"
  fi
done
