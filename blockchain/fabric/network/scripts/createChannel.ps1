# -----------------------------------------------------------------------------
# createChannel.ps1 - Create incidentchannel and join peer
# Phase 4 Module 4: CyberSecurity Incident Ledger
#
# Run from: blockchain/fabric/network/
# Prerequisites:
#   - Network containers running (startNetwork.ps1)
#   - Identities enrolled (registerEnroll.ps1)
# -----------------------------------------------------------------------------

$ErrorActionPreference = "Continue"
$ScriptRoot   = $PSScriptRoot
$NetworkRoot  = Split-Path $ScriptRoot -Parent
$ComposeFile  = "$NetworkRoot\compose\docker-compose.yaml"
$ArtifactsDir = "$NetworkRoot\channel-artifacts"
$OrgRoot      = "$NetworkRoot\organizations"
$env:PATH += ";$NetworkRoot\bin"
$CHANNEL_NAME = "incidentchannel"
$CONFIGTX_DIR = "$NetworkRoot\configtx"

function Write-Step { param($n, $msg)
  Write-Host "`n  [$n] $msg" -ForegroundColor Cyan
}
function Write-OK { param($msg)
  Write-Host "  [OK] $msg" -ForegroundColor Green
}
function Write-Fail { param($msg)
  Write-Host "  [FAIL] $msg" -ForegroundColor Red; exit 1
}
function Write-Info { param($msg)
  Write-Host "  [INFO] $msg" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "  [CHANNEL] Creating channel: $CHANNEL_NAME" -ForegroundColor Cyan
Write-Host "  ============================================================" -ForegroundColor Cyan

# -- Verify containers are up -------------------------------------------------
Write-Step 1 "Verifying Fabric containers are running..."
$peerRunning = docker inspect --format='{{.State.Running}}' "peer0.org1.incidentledger.com" 2>&1
if ($peerRunning -ne 'true') {
  Write-Fail "Peer container is not running. Run .\scripts\startNetwork.ps1 first."
}
Write-OK "Containers are running."

# -- Create channel artifacts directory --------------------------------------
Write-Step 2 "Preparing channel artifacts directory..."
New-Item -ItemType Directory -Force -Path $ArtifactsDir | Out-Null
Write-OK "Artifacts directory ready: $ArtifactsDir"

# -- Create channel genesis block via CLI container ---------------------------
Write-Step 3 "Creating channel '$CHANNEL_NAME' using osnadmin via CLI..."

$createCmd = "export FABRIC_CFG_PATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/configtx && configtxgen -profile IncidentChannelGenesis -outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/$CHANNEL_NAME.block -channelID $CHANNEL_NAME && echo '[CREATE-CHANNEL] Genesis block created for $CHANNEL_NAME'"

docker exec -e "FABRIC_CFG_PATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/configtx" cli bash -c "$createCmd"

if ($LASTEXITCODE -ne 0) {
  Write-Fail "Channel genesis block creation failed. Ensure configtx.yaml and crypto materials are in place."
}
Write-OK "Channel genesis block created for '$CHANNEL_NAME'."

# -- Join the channel via osnadmin ---------------------------------------------
Write-Step 4 "Joining orderer to '$CHANNEL_NAME' via osnadmin..."

$joinOrdererCmd = "export ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/msp/tlscacerts/tlsca.incidentledger.com-cert.pem && export ORDERER_ADMIN_TLS_SIGN_CERT=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/tls/server.crt && export ORDERER_ADMIN_TLS_PRIVATE_KEY=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/tls/server.key && osnadmin channel join --channelID $CHANNEL_NAME --config-block /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/$CHANNEL_NAME.block -o orderer.incidentledger.com:7053 --ca-file `$ORDERER_CA --client-cert `$ORDERER_ADMIN_TLS_SIGN_CERT --client-key `$ORDERER_ADMIN_TLS_PRIVATE_KEY && echo '[CREATE-CHANNEL] Orderer joined $CHANNEL_NAME'"

docker exec cli bash -c "$joinOrdererCmd"
if ($LASTEXITCODE -ne 0) {
  Write-Info "osnadmin join returned non-zero. Channel may already exist - continuing..."
}

# -- Join peer to channel -----------------------------------------------------
Write-Step 5 "Joining peer0.org1 to '$CHANNEL_NAME'..."

$joinPeerCmd = "export CORE_PEER_TLS_ENABLED=true && export CORE_PEER_LOCALMSPID=Org1MSP && export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.incidentledger.com/peers/peer0.org1.incidentledger.com/tls/ca.crt && export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.incidentledger.com/users/Admin@org1.incidentledger.com/msp && export CORE_PEER_ADDRESS=peer0.org1.incidentledger.com:7051 && peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/$CHANNEL_NAME.block"

$peerJoinOut = docker exec cli bash -c "$joinPeerCmd" 2>&1
if ($LASTEXITCODE -ne 0) {
  if ($peerJoinOut -match "already exists") {
    Write-Info "peer0.org1 is already joined to '$CHANNEL_NAME'."
  } else {
    Write-Fail "Peer channel join failed: $peerJoinOut"
  }
} else {
  Write-OK "peer0.org1.incidentledger.com joined '$CHANNEL_NAME'."
}

# -- Verify channel membership ------------------------------------------------
Write-Step 6 "Verifying channel membership..."

$verifyCmd = "export CORE_PEER_TLS_ENABLED=true && export CORE_PEER_LOCALMSPID=Org1MSP && export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.incidentledger.com/peers/peer0.org1.incidentledger.com/tls/ca.crt && export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.incidentledger.com/users/Admin@org1.incidentledger.com/msp && export CORE_PEER_ADDRESS=peer0.org1.incidentledger.com:7051 && peer channel list"

$channelList = docker exec cli bash -c "$verifyCmd" 2>&1
Write-Host ""
$channelList | ForEach-Object { Write-Host "    $_" -ForegroundColor White }

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "  [OK] Channel '$CHANNEL_NAME' created and peer joined successfully." -ForegroundColor Green
Write-Host ""
Write-Host "  Next: Deploy chaincode:" -ForegroundColor Yellow
Write-Host "    docker exec cli peer lifecycle chaincode package ..." -ForegroundColor White
Write-Host "  Then start the Blockchain Console:" -ForegroundColor Yellow
Write-Host "    cd ..\console ; node fabricConsole.js" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
