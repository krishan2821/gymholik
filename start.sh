#!/bin/bash
set -e

# ==========================================================
#  GYMHOLIK ALL-IN-ONE START SCRIPT
#  Starts: MongoDB -> Spring Boot Backend -> Expo Mobile App
# ==========================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Color formatting
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}        🚀 STARTING GYMHOLIK SERVICES 🚀          ${NC}"
echo -e "${CYAN}====================================================${NC}"

# ── 1. Environment files check ────────────────────────────
if [ ! -f "$ROOT_DIR/.env" ] && [ -f "$ROOT_DIR/.env.example" ]; then
    echo -e "${YELLOW}[1/4]${NC} Creating root .env from .env.example..."
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
fi

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")

if [ -n "$LAN_IP" ] && [ "$LAN_IP" != "127.0.0.1" ]; then
    echo "EXPO_PUBLIC_API_URL=http://${LAN_IP}:8080" > "$ROOT_DIR/mobile/.env"
else
    echo "EXPO_PUBLIC_API_URL=http://localhost:8080" > "$ROOT_DIR/mobile/.env"
fi

# ── 2. Check & Start MongoDB ──────────────────────────────
echo -e "\n${BLUE}[2/4] Checking MongoDB...${NC}"
MONGO_READY=false

if nc -z 127.0.0.1 27017 2>/dev/null || lsof -i :27017 >/dev/null 2>&1; then
    echo -e "${GREEN}✓ MongoDB is already running on port 27017.${NC}"
    MONGO_READY=true
else
    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
        echo -e "${YELLOW}Starting MongoDB via Docker...${NC}"
        if docker ps -a --format '{{.Names}}' | grep -q "^mongodb$"; then
            docker start mongodb >/dev/null 2>&1
        elif docker ps -a --format '{{.Names}}' | grep -q "^gymapp-mongo$"; then
            docker start gymapp-mongo >/dev/null 2>&1
        elif docker ps -a --format '{{.Names}}' | grep -q "^gymholik-mongodb$"; then
            docker start gymholik-mongodb >/dev/null 2>&1
        else
            echo -e "${YELLOW}Creating MongoDB container with replica set rs0...${NC}"
            docker run -d --name mongodb -p 27017:27017 mongo:7 --replSet rs0 --bind_ip_all
            sleep 3
            docker exec mongodb mongosh --eval "try { rs.status().ok } catch(e) { rs.initiate({_id:'rs0', members:[{_id:0, host:'localhost:27017'}]}); }" >/dev/null 2>&1 || true
        fi

        for i in {1..15}; do
            if nc -z 127.0.0.1 27017 2>/dev/null || lsof -i :27017 >/dev/null 2>&1; then
                MONGO_READY=true
                break
            fi
            sleep 1
        done
    fi
fi

if [ "$MONGO_READY" = false ]; then
    echo -e "${RED}✗ Error: MongoDB could not be reached on port 27017.${NC}"
    echo -e "${YELLOW}Please ensure Docker Desktop or a local MongoDB instance is running, then re-run ./start.sh${NC}"
    exit 1
fi
echo -e "${GREEN}✓ MongoDB is ready.${NC}"

# ── 3. Check & Start Spring Boot Backend ──────────────────
echo -e "\n${BLUE}[3/4] Checking Spring Boot Backend...${NC}"
BACKEND_PID=""

cleanup() {
    echo -e "\n${YELLOW}Stopping processes...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        echo -e "${YELLOW}Stopping Spring Boot backend (PID: $BACKEND_PID)...${NC}"
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM

if curl -s http://localhost:8080/v3/api-docs >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is already running on http://localhost:8080${NC}"
else
    if lsof -i :8080 >/dev/null 2>&1; then
        echo -e "${YELLOW}Port 8080 is already active, waiting for health check...${NC}"
    else
        echo -e "${YELLOW}Starting Spring Boot backend in the background...${NC}"
        cd "$ROOT_DIR/backend"
        mvn spring-boot:run > backend.log 2>&1 &
        BACKEND_PID=$!
        echo $BACKEND_PID > "$ROOT_DIR/.backend.pid"
        cd "$ROOT_DIR"
    fi

    echo -ne "${YELLOW}Waiting for backend to be ready${NC}"
    BACKEND_UP=false
    for i in {1..35}; do
        if curl -s http://localhost:8080/v3/api-docs >/dev/null 2>&1; then
            BACKEND_UP=true
            break
        fi
        echo -ne "${YELLOW}.${NC}"
        sleep 1
    done
    echo ""

    if [ "$BACKEND_UP" = true ]; then
        echo -e "${GREEN}✓ Backend started successfully!${NC}"
    else
        echo -e "${YELLOW}Backend is still booting. You can view logs in backend/backend.log${NC}"
    fi
fi

# ── 4. Start Expo Mobile App ──────────────────────────────
echo -e "\n${BLUE}[4/4] Launching Mobile Frontend (Expo)...${NC}"
echo -e "${CYAN}====================================================${NC}"
echo -e "${GREEN}✓ MongoDB:        Port 27017 (ReplicaSet rs0)${NC}"
echo -e "${GREEN}✓ Backend API:    http://localhost:8080${NC}"
echo -e "${GREEN}✓ Swagger UI:     http://localhost:8080/swagger-ui.html${NC}"
echo -e "${GREEN}✓ LAN IP:         http://${LAN_IP}:8080${NC}"
echo -e "${CYAN}====================================================${NC}"
echo -e "${YELLOW}Tip: Press 'i' for iOS simulator, 'a' for Android emulator, 'w' for Web, or scan the QR code using Expo Go app on your phone.${NC}\n"

cd "$ROOT_DIR/mobile"
npx expo start
