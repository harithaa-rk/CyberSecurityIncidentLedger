 # -----------------------------------------------------------------------------
# stopNetwork.ps1 - Stop and clean the Fabric development network
# Phase 4 Module 4: CyberSecurity Incident Ledger
# -----------------------------------------------------------------------------

param(
  [switch]$Clean  # Also remove generated crypto materials and artifacts
)

$ScriptRoot  = Split-Path -Parent $PSScriptRoot
$NetworkRoot = Split-Path $ScriptRoot -Parent
$ComposeFile = "$NetworkRoot\compose\docker-compose.yaml"

Write-Host "`n  Stopping Fabric network..." -ForegroundColor Yellow

docker compose -f $ComposeFile down --volumes --remove-orphans 2>&1 | ForEach-Object {
  Write-Host "  $_" -ForegroundColor DarkGray
}

# Remove dangling chaincode containers and images
docker rm -f (docker ps -aq -f "name=dev-peer0") 2>&1 | Out-Null
docker rmi -f (docker images "dev-peer0*" -q) 2>&1 | Out-Null

Write-Host "  [OK] Fabric containers stopped and volumes removed." -ForegroundColor Green

if ($Clean) {
  Write-Host "  Cleaning crypto materials and channel artifacts..." -ForegroundColor Yellow
  Remove-Item -Recurse -Force "$NetworkRoot\organizations\peerOrganizations"  -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force "$NetworkRoot\organizations\ordererOrganizations"-ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force "$NetworkRoot\channel-artifacts"                 -ErrorAction SilentlyContinue
  Write-Host "  [OK] Crypto materials and artifacts cleaned." -ForegroundColor Green
  Write-Host "  [INFO] Run startNetwork.ps1 + registerEnroll.ps1 + createChannel.ps1 to rebuild." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "  [OK] Fabric network stopped." -ForegroundColor Green
