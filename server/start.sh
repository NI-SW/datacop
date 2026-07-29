#!/bin/bash
# DataCop server startup script

LOG=/tmp/datacop.log
SERVER_DIR=/home/github/datacop/server

# Check if server is already running
if curl -sf --connect-timeout 3 http://localhost:3001/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"root","password":"admin123"}' > /dev/null 2>&1; then
  echo "$(date): Server already running" >> $LOG
  exit 0
fi

# Kill any stale processes
pkill -f "tsx.*src/index.ts" 2>/dev/null
sleep 1

# Start server
cd "$SERVER_DIR"
echo "$(date): Starting server..." >> $LOG
nohup npx tsx src/index.ts >> $LOG 2>&1 &
PID=$!
echo "$(date): Server PID=$PID" >> $LOG
disown $PID

# Wait and verify
sleep 6
if curl -sf --connect-timeout 3 http://localhost:3001/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"root","password":"admin123"}' > /dev/null 2>&1; then
  echo "$(date): Server started successfully" >> $LOG
else
  echo "$(date): Server failed to start" >> $LOG
fi
