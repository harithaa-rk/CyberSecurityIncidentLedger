# -----------------------------------------------------------------------------
# networkStatus.ps1 - Display Fabric Network Status
# Phase 4 Module 4: CyberSecurity Incident Ledger
# -----------------------------------------------------------------------------

$ScriptRoot  = $PSScriptRoot
$NetworkRoot = Split-Path -Parent $ScriptRoot
$ComposeFile = "$NetworkRoot\compose\docker-compose.yaml"
$CHANNEL     = "incidentchannel"

$line = '=' * 70
Write-Host "`n$line" -ForegroundColor Cyan
Write-Host "  [STATUS] Fabric Network Status - CyberSecurity Incident Ledger" -ForegroundColor Cyan
Write-Host "$line" -ForegroundColor Cyan

# -- Container Status ----------------------------------------------------------
Write-Host "`n  [1] Container Status" -ForegroundColor Yellow
docker compose -f $ComposeFile ps 2>&1 | ForEach-Object {
  if ($_ -match "Up|running") {
    Write-Host "    $_ " -ForegroundColor Green
  } elseif ($_ -match "Exit|Exited|dead") {
    Write-Host "    $_ " -ForegroundColor Red
  } else {
    Write-Host "    $_ " -ForegroundColor White
  }
}

# -- Channel List --------------------------------------------------------------
Write-Host "`n  [2] Channel Membership" -ForegroundColor Yellow
try {
  $peerEnv = "export CORE_PEER_TLS_ENABLED=true && export CORE_PEER_LOCALMSPID=Org1MSP && export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.incidentledger.com/peers/peer0.org1.incidentledger.com/tls/ca.crt && export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.incidentledger.com/users/Admin@org1.incidentledger.com/msp && export CORE_PEER_ADDRESS=peer0.org1.incidentledger.com:7051"
  $chanList = docker exec cli bash -c "$peerEnv && peer channel list" 2>&1
  $chanList | ForEach-Object { Write-Host "    $_" -ForegroundColor White }
} catch {
  Write-Host "    Could not query channels (CLI container may not be running)" -ForegroundColor DarkGray
}

# -- Block Height --------------------------------------------------------------
Write-Host "`n  [3] Block Height on '$CHANNEL'" -ForegroundColor Yellow
try {
  $blockInfo = docker exec cli bash -c "$peerEnv && peer channel getinfo -c $CHANNEL" 2>&1
  $blockInfo | ForEach-Object { Write-Host "    $_" -ForegroundColor White }
} catch {
  Write-Host "    Could not query block info (channel may not exist yet)" -ForegroundColor DarkGray
}

# -- Docker Images ------------------------------------------------------------
Write-Host "`n  [4] Fabric Docker Images" -ForegroundColor Yellow
docker images | Select-String "hyperledger" | ForEach-Object {
  Write-Host "    $_" -ForegroundColor DarkCyan
}

Write-Host "`n$line" -ForegroundColor Cyan
Write-Host "  To start Blockchain Console:  cd ..\console ; node fabricConsole.js" -ForegroundColor Green
Write-Host "$line`n" -ForegroundColor Cyan
