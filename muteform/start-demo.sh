#!/bin/bash
# Muteform Demo — starts both backend and frontend
# Usage: ./start-demo.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==============================="
echo "  Muteform Demo Launcher"
echo "==============================="
echo ""

# Check .env files exist
if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
  echo "ERROR: backend/.env not found. Copy .env.example and fill in values."
  exit 1
fi
if [ ! -f "$SCRIPT_DIR/frontend/.env" ]; then
  echo "ERROR: frontend/.env not found. Copy .env.example and fill in values."
  exit 1
fi

# Start backend
echo "[1/2] Starting backend on http://localhost:3001 ..."
cd "$SCRIPT_DIR/backend"
npm run dev &
BACKEND_PID=$!

# Start frontend
echo "[2/2] Starting frontend on http://localhost:3000 ..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "==============================="
echo "  Backend:  http://localhost:3001"
echo "  Frontend: http://localhost:3000"
echo "  Health:   http://localhost:3001/health"
echo "==============================="
echo ""
echo "Press Ctrl+C to stop both servers."

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Servers stopped.'" EXIT

wait
