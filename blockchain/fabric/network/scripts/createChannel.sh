#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# createChannel.sh — Create incidentchannel (Linux/Mac)
# Phase 4 Module 4: CyberSecurity Incident Ledger
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NETWORK_ROOT="$(dirname "$SCRIPT_DIR")"
CHANNEL_NAME="incidentchannel"
ORDERER="orderer.incidentledger.com:7050"
ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/msp/tlscacerts/tlsca.incidentledger.com-cert.pem"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'

step() { echo -e "\n  ${CYAN}[$1]${NC} $2"; }
ok()   { echo -e "  ${GREEN}✔ $1${NC}"; }
fail() { echo -e "  ${RED}✖ $1${NC}"; exit 1; }

PEER_ENV="export CORE_PEER_TLS_ENABLED=true; \
export CORE_PEER_LOCALMSPID=Org1MSP; \
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.incidentledger.com/peers/peer0.org1.incidentledger.com/tls/ca.crt; \
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.incidentledger.com/users/Admin@org1.incidentledger.com/msp; \
export CORE_PEER_ADDRESS=peer0.org1.incidentledger.com:7051"

step 1 "Creating genesis block for $CHANNEL_NAME..."
docker exec -e "FABRIC_CFG_PATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/configtx" cli \
  configtxgen -profile IncidentChannelGenesis \
  -outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block \
  -channelID "$CHANNEL_NAME"
ok "Genesis block created."

step 2 "Joining orderer to $CHANNEL_NAME..."
docker exec cli bash -c "
export ORDERER_CA=$ORDERER_CA
export ORDERER_ADMIN_TLS_SIGN_CERT=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/tls/server.crt
export ORDERER_ADMIN_TLS_PRIVATE_KEY=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/tls/server.key
osnadmin channel join --channelID $CHANNEL_NAME \
  --config-block /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block \
  -o orderer.incidentledger.com:7053 \
  --ca-file \$ORDERER_CA \
  --client-cert \$ORDERER_ADMIN_TLS_SIGN_CERT \
  --client-key \$ORDERER_ADMIN_TLS_PRIVATE_KEY" || echo "Orderer join: may already exist, continuing..."

step 3 "Joining peer0.org1 to $CHANNEL_NAME..."
docker exec cli bash -c "$PEER_ENV; \
  peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block"
ok "Peer joined $CHANNEL_NAME."

step 4 "Verifying channel list..."
docker exec cli bash -c "$PEER_ENV; peer channel list"
ok "Channel $CHANNEL_NAME ready."
