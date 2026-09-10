#!/bin/bash
cd "$(dirname "$0")"
pkill -f "node src/index.js" 2>/dev/null
sleep 1
setsid nohup node src/index.js > /tmp/opencode/app.log 2>&1 < /dev/null &
disown
echo "started, waiting for health..."
for i in $(seq 1 15); do
  sleep 2
  if curl -s --max-time 3 http://localhost:3000/health >/dev/null 2>&1; then
    echo "healthy after ${i} checks"
    exit 0
  fi
done
echo "not healthy yet - check /tmp/opencode/app.log"
exit 1