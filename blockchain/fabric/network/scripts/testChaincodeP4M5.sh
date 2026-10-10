#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# testChaincodeP4M5.sh — Deploy & Test Chaincode for Phase 4 Module 5 (Linux/Mac)
# ─────────────────────────────────────────────────────────────────────────────
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
CHANNEL_NAME="incidentchannel"
CHAINCODE_NAME="incident-ledger"

echo ""
echo "========================================================================"
echo "  Phase 4 Module 5 — Chaincode Verification & Test"
echo "  Channel: ${CHANNEL_NAME}  |  Chaincode: ${CHAINCODE_NAME}"
echo "========================================================================"

# Run test suite
node "${DIR}/../../chaincode/incident-ledger/test/testChaincode.js"
