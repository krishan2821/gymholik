#!/bin/bash

# ==========================================================
#  GYMHOLIK ALL-IN-ONE STOP SCRIPT
#  Stops: Expo -> Spring Boot Backend -> MongoDB (optional)
# ==========================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Color formatting
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}Stopping Gymholik services...${NC}"

# Stop Expo processes if running on port 8081
EXPO_PIDS=$(lsof -ti :8081 2>/dev/null || true)
if [ -n "$EXPO_PIDS" ]; then
    echo -e "${BLUE}Stopping Expo server (port 8081)...${NC}"
    kill $EXPO_PIDS 2>/dev/null || true
fi

# Stop Spring Boot processes if running on port 8080
BACKEND_PIDS=$(lsof -ti :8080 2>/dev/null || true)
if [ -n "$BACKEND_PIDS" ]; then
    echo -e "${BLUE}Stopping Spring Boot backend (port 8080)...${NC}"
    kill $BACKEND_PIDS 2>/dev/null || true
fi

# Clean up PID files
rm -f "$ROOT_DIR/.backend.pid"

echo -e "${GREEN}✓ Backend and Mobile frontend stopped successfully!${NC}"
echo -e "Note: MongoDB container is kept running for quick next startup."
echo -e "To stop MongoDB as well, run: docker stop mongodb"
