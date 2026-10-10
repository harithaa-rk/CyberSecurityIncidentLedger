#!/bin/bash
# -----------------------------------------------------------------------------
# testTransaction.sh - Submit & Query live Fabric transactions
# Phase 4 Module 4 & 5: CyberSecurity Incident Ledger
# -----------------------------------------------------------------------------
set -e

CHANNEL_NAME="incidentchannel"
CHAINCODE_NAME="incident-ledger"
TIMESTAMP=$(date +%s)
EVIDENCE_ID="EVD-${TIMESTAMP}"
INCIDENT_ID="INC-${TIMESTAMP}"
SHA256_HASH="3182df2e121aa6ef383e9f201be7ea45945b3ac5b5f4bafae452ca6412acc3c4"
IPFS_CID="bafkreid5z264h7h63xuvv6ox2s5cwt5v5r5y4f3vve7eb56s6d4rz4zbu"
RECORDED_BY="admin@org1.incidentledger.com"
RECORDED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.incidentledger.com/peers/peer0.org1.incidentledger.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.incidentledger.com/users/Admin@org1.incidentledger.com/msp
export CORE_PEER_ADDRESS=peer0.org1.incidentledger.com:7051
export ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/msp/tlscacerts/tlsca.incidentledger.com-cert.pem

echo "============================================================"
echo "  Live Fabric Transaction Test - incidentchannel"
echo "============================================================"
echo "  Evidence ID : $EVIDENCE_ID"
echo "  Incident ID : $INCIDENT_ID"
echo "  SHA-256     : $SHA256_HASH"
echo "  IPFS CID    : $IPFS_CID"
echo ""

echo "[1] Submitting registerEvidence transaction..."
peer chaincode invoke \
  -o orderer.incidentledger.com:7050 \
  --ordererTLSHostnameOverride orderer.incidentledger.com \
  --tls \
  --cafile "$ORDERER_CA" \
  -C "$CHANNEL_NAME" \
  -n "$CHAINCODE_NAME" \
  --peerAddresses peer0.org1.incidentledger.com:7051 \
  --tlsRootCertFiles "$CORE_PEER_TLS_ROOTCERT_FILE" \
  --waitForEvent \
  -c "{\"function\":\"registerEvidence\",\"Args\":[\"$INCIDENT_ID\",\"$EVIDENCE_ID\",\"$IPFS_CID\",\"$SHA256_HASH\",\"$RECORDED_BY\",\"$RECORDED_AT\"]}"

echo "  -> Transaction committed successfully."
echo ""

echo "[2] Querying getEvidence..."
peer chaincode query \
  -C "$CHANNEL_NAME" \
  -n "$CHAINCODE_NAME" \
  -c "{\"function\":\"getEvidence\",\"Args\":[\"$EVIDENCE_ID\"]}"

echo ""
echo "[3] Calling verifyEvidenceHash..."
peer chaincode query \
  -C "$CHANNEL_NAME" \
  -n "$CHAINCODE_NAME" \
  -c "{\"function\":\"verifyEvidenceHash\",\"Args\":[\"$EVIDENCE_ID\",\"$SHA256_HASH\"]}"

echo ""
echo "[4] Calling getIncidentEvidence..."
peer chaincode query \
  -C "$CHANNEL_NAME" \
  -n "$CHAINCODE_NAME" \
  -c "{\"function\":\"getIncidentEvidence\",\"Args\":[\"$INCIDENT_ID\"]}"

echo ""
echo "[5] Calling getEvidenceHistory..."
peer chaincode query \
  -C "$CHANNEL_NAME" \
  -n "$CHAINCODE_NAME" \
  -c "{\"function\":\"getEvidenceHistory\",\"Args\":[\"$EVIDENCE_ID\"]}"

echo ""
echo "============================================================"
echo "  [OK] All live Fabric transactions verified successfully!"
echo "============================================================"
