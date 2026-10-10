#!/bin/bash
# Stop the Fabric development network (Linux/Mac)
set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NETWORK_ROOT="$(dirname "$SCRIPT_DIR")"
echo "  Stopping Fabric network..."
docker compose -f "$NETWORK_ROOT/compose/docker-compose.yaml" down --volumes --remove-orphans
docker rm -f $(docker ps -aq -f "name=dev-peer0") 2>/dev/null || true
docker rmi -f $(docker images "dev-peer0*" -q) 2>/dev/null || true
echo "  ✔ Fabric network stopped."
