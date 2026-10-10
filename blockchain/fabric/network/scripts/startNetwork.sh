#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# network.sh — Start the Hyperledger Fabric development network (Linux/Mac)
# Phase 4 Module 4: CyberSecurity Incident Ledger
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NETWORK_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$NETWORK_ROOT/compose/docker-compose.yaml"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'

step() { echo -e "\n  ${CYAN}[$1]${NC} $2"; }
ok()   { echo -e "  ${GREEN}✔ $1${NC}"; }
fail() { echo -e "  ${RED}✖ $1${NC}"; exit 1; }
info() { echo -e "  ${YELLOW}ℹ $1${NC}"; }

echo -e "\n${CYAN}══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  🔗 Fabric Network Start — CyberSecurity Incident Ledger${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════════════${NC}\n"

step 1 "Checking Docker..."
docker ps > /dev/null 2>&1 || fail "Docker is not running."
ok "Docker is running."

step 2 "Creating directories..."
mkdir -p "$NETWORK_ROOT/organizations/peerOrganizations/org1.incidentledger.com"
mkdir -p "$NETWORK_ROOT/organizations/ordererOrganizations/incidentledger.com"
mkdir -p "$NETWORK_ROOT/organizations/fabric-ca/org1"
mkdir -p "$NETWORK_ROOT/organizations/fabric-ca/ordererOrg"
mkdir -p "$NETWORK_ROOT/channel-artifacts"
mkdir -p "$NETWORK_ROOT/peercfg"
ok "Directories ready."

step 3 "Starting Docker containers..."
docker compose -f "$COMPOSE_FILE" up -d 2>&1
ok "Containers started."

step 4 "Waiting for Fabric CA (10s)..."
sleep 10
ok "Ready."

step 5 "Network status:"
docker compose -f "$COMPOSE_FILE" ps

echo -e "\n${CYAN}══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✔ Network started.${NC}"
echo -e "${YELLOW}  Next: bash organizations/fabric-ca/registerEnroll.sh${NC}"
echo -e "${YELLOW}  Then: bash scripts/createChannel.sh${NC}"
echo -e "${YELLOW}  Then: cd ../console && npm install && node fabricConsole.js${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════════════${NC}"
