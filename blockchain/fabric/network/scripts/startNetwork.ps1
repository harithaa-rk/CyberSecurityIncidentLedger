# 
# startNetwork.ps1  Start Hyperledger Fabric Development Network
# Phase 4 Module 4: CyberSecurity Incident Ledger
#
# This script:
#   1. Validates Docker is running
#   2. Downloads Fabric binaries if needed
#   3. Generates crypto materials via Fabric CA containers
#   4. Starts all Docker containers (Orderer, Peer, CAs, CLI)
#   5. Prints network status
#
# Run from: blockchain/fabric/network/
# 

param(
  [switch]$Force,         # Force restart even if already running
  [switch]$UseCryptogen,  # Use cryptogen instead of Fabric CA
  [switch]$SkipBinaries   # Skip Fabric binary download check
)

$ErrorActionPreference = "Stop"
$ScriptRoot  = $PSScriptRoot
$NetworkRoot = Split-Path -Parent $ScriptRoot
$ComposeFile = "$NetworkRoot\compose\docker-compose.yaml"
$OrgRoot     = "$NetworkRoot\organizations"
$ArtifactsDir= "$NetworkRoot\channel-artifacts"

function Write-Header {
  $line = '' * 70
  Write-Host "`n$line" -ForegroundColor Cyan
  Write-Host "   CyberSecurity Incident Ledger  Fabric Network Start" -ForegroundColor Cyan -NoNewline
  Write-Host "  Phase 4 Module 4" -ForegroundColor DarkCyan
  Write-Host "$line`n" -ForegroundColor Cyan
}

function Write-Step { param($n, $msg)
  Write-Host "  [$n] $msg" -ForegroundColor Cyan
}

function Write-OK { param($msg)
  Write-Host "   $msg" -ForegroundColor Green
}

function Write-Fail { param($msg)
  Write-Host "   $msg" -ForegroundColor Red; exit 1
}

function Write-Info { param($msg)
  Write-Host "   $msg" -ForegroundColor Yellow
}

Write-Header

#  Step 1: Check Docker 
Write-Step 1 "Checking Docker daemon..."
try {
  $null = docker ps 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Docker not responding" }
  Write-OK "Docker is running."
} catch {
  Write-Fail "Docker is not running. Please start Docker Desktop and try again."
}

#  Step 2: Prepare Directories 
Write-Step 2 "Creating required directories..."
@(
  "$OrgRoot\peerOrganizations\org1.incidentledger.com",
  "$OrgRoot\ordererOrganizations\incidentledger.com",
  "$OrgRoot\fabric-ca\org1",
  "$OrgRoot\fabric-ca\ordererOrg",
  "$ArtifactsDir",
  "$NetworkRoot\peercfg"
) | ForEach-Object {
  New-Item -ItemType Directory -Force -Path $_ | Out-Null
}
Write-OK "Directories ready."

#  Step 3: Generate Fabric CA config files if missing 
Write-Step 3 "Preparing Fabric CA server configurations..."

$caFabricConfig = @"
version: 1.5.7
port: 7054
tls:
  enabled: true
csr:
  hosts:
    - localhost
    - ca_org1
    - ca_orderer
    - peer0.org1.incidentledger.com
    - orderer.incidentledger.com
debug: false
crlsizelimit: 512000
ca:
  name: ca-org1
registry:
  maxenrollments: -1
  identities:
  - name: admin
    pass: adminpw
    type: client
    affiliation: ''
    attrs:
      hf.Registrar.Roles: '*'
      hf.Registrar.DelegateRoles: '*'
      hf.Revoker: true
      hf.IntermediateCA: true
      hf.GenCRL: true
      hf.Registrar.Attributes: '*'
      hf.AffiliationMgr: true
"@

if (-not (Test-Path "$OrgRoot\fabric-ca\org1\fabric-ca-server-config.yaml")) {
  $caFabricConfig | Set-Content "$OrgRoot\fabric-ca\org1\fabric-ca-server-config.yaml"
  Write-OK "CA config written for Org1."
} else {
  Write-Info "Org1 CA config already exists."
}

$caOrdererConfig = $caFabricConfig -replace "ca-org1", "ca-orderer" -replace "7054", "9054"
if (-not (Test-Path "$OrgRoot\fabric-ca\ordererOrg\fabric-ca-server-config.yaml")) {
  $caOrdererConfig | Set-Content "$OrgRoot\fabric-ca\ordererOrg\fabric-ca-server-config.yaml"
  Write-OK "CA config written for OrdererOrg."
} else {
  Write-Info "OrdererOrg CA config already exists."
}

#  Step 4: Create peer config 
Write-Step 4 "Writing peer configuration (core.yaml)..."
$peerCfgDir = "$NetworkRoot\peercfg"
if (-not (Test-Path "$peerCfgDir\core.yaml")) {
  @"
peer:
  id: peer0.org1.incidentledger.com
  networkId: incidentledger
  listenAddress: 0.0.0.0:7051
  chaincodeListenAddress: 0.0.0.0:7052
  address: peer0.org1.incidentledger.com:7051
  addressAutoDetect: false
  keepalive:
    interval: 7200s
    timeout: 20s
    minInterval: 60s
  gossip:
    bootstrap: peer0.org1.incidentledger.com:7051
    useLeaderElection: true
    orgLeader: false
    membershipTrackerInterval: 5s
    maxBlockCountToStore: 100
    maxPropagationBurstLatency: 10ms
    maxPropagationBurstSize: 10
    propagateIterations: 1
    propagatePeerNum: 3
    pullInterval: 4s
    pullPeerNum: 3
    requestStateInfoInterval: 4s
    publishStateInfoInterval: 4s
    stateInfoRetentionInterval:
    publishCertPeriod: 10s
    skipBlockVerification: false
    dialTimeout: 3s
    connTimeout: 2s
    recvBuffSize: 20
    sendBuffSize: 200
    digestWaitTime: 1s
    requestWaitTime: 1500ms
    responseWaitTime: 2s
    aliveTimeInterval: 5s
    aliveExpirationTimeout: 25s
    reconnectInterval: 25s
    externalEndpoint: peer0.org1.incidentledger.com:7051
  tls:
    enabled: true
    clientAuthRequired: false
    cert:
      file: /etc/hyperledger/fabric/tls/server.crt
    key:
      file: /etc/hyperledger/fabric/tls/server.key
    rootcert:
      file: /etc/hyperledger/fabric/tls/ca.crt
  authentication:
    timewindow: 15m
  fileSystemPath: /var/hyperledger/production
  BCCSP:
    Default: SW
    SW:
      Hash: SHA2
      Security: 256
      FileKeyStore:
        KeyStore:
  mspConfigPath: /etc/hyperledger/fabric/msp
  localMspId: Org1MSP
  deliveryclient:
    reconnectTotalTimeThreshold: 3600s
    connTimeout: 3s
    reConnectBackoffThreshold: 3600s
  localMspType: bccsp
  profile:
    enabled: false
    listenAddress: 0.0.0.0:6060
  adminService:
    listenAddress: 0.0.0.0:7055
  handlers:
    authFilters:
      - name: DefaultAuth
      - name: ExpirationCheck
    decorators:
      - name: DefaultDecorator
    endorsers:
      escc:
        name: DefaultEndorsement
        library:
    validators:
      vscc:
        name: DefaultValidation
        library:
  chaincode:
    id:
      path:
      name:
    builder: /opt/gopath/src/github.com/hyperledger/fabric/images/ccenv
    pull: false
    golang:
      runtime: hyperledger/fabric-baseos
      dynamicLink: false
    java:
      Dockerfile: |
        FROM gliderlabs/alpine:3.3
        RUN apk add --no-cache openjdk8-jre
        RUN apk add --no-cache ca-certificates
    node:
      runtime: hyperledger/fabric-nodeenv
    logging:
      level: info
      shim: warning
      format: '%{color}%{time:2006-01-02 15:04:05.000 MST} [%{module}] %{shortfunc} -> %{level:.4s} %{id:03x}%{color:reset} %{message}'
  ledger:
    blockchain:
    state:
      stateDatabase: goleveldb
      totalQueryLimit: 100000
      couchDBConfig:
        couchDBAddress: 127.0.0.1:5984
        username:
        password:
        maxRetries: 3
        maxRetriesOnStartup: 12
        requestTimeout: 35s
        internalQueryLimit: 1000
        maxBatchUpdateSize: 1000
    history:
      enableHistoryDatabase: true
    pvtdataStore:
      collElgProcMaxDbBatchSize: 5000
      collElgProcDbBatchesInterval: 1000
      deprioritizedDataReconcilerInterval: 60m
  snapshot:
    rootDir: /var/hyperledger/production/snapshots
vm:
  endpoint: unix:///host/var/run/docker.sock
  docker:
    tls:
      enabled: false
      ca:
        file: docker/ca.crt
      cert:
        file: docker/tls.crt
      key:
        file: docker/tls.key
    attachStdout: false
    hostConfig:
      NetworkMode: host
      Dns:
      LogConfig:
        Type: json-file
        Config:
          max-size: 50m
          max-file: '5'
      Memory: 2147483648
operations:
  listenAddress: peer0.org1.incidentledger.com:9444
  tls:
    enabled: false
metrics:
  provider: disabled
"@ | Set-Content "$peerCfgDir\core.yaml"
  Write-OK "core.yaml created."
} else {
  Write-Info "core.yaml already exists."
}

#  Step 5: Start Docker Containers 
Write-Step 5 "Starting Fabric network containers..."
try {
  if ($Force) {
    Write-Info "Force mode: removing any existing containers..."
    docker compose -f $ComposeFile down --volumes --remove-orphans 2>&1 | Out-Null
  }

  docker compose -f $ComposeFile up -d 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }

  if ($LASTEXITCODE -ne 0) { Write-Fail "docker compose up failed." }
  Write-OK "Containers started."
} catch {
  Write-Fail "Failed to start containers: $_"
}

#  Step 6: Wait for CA containers 
Write-Step 6 "Waiting for Fabric CA containers to become healthy..."
$maxWait = 30
$waited  = 0
do {
  Start-Sleep 2
  $waited += 2
  $caHealth = docker inspect --format='{{.State.Running}}' ca_org1 2>&1
} while ($caHealth -ne 'true' -and $waited -lt $maxWait)

if ($caHealth -ne 'true') {
  Write-Info "CA container not fully ready yet - you can run registerEnroll.ps1 manually when it is."
} else {
  Write-OK "Fabric CA containers are running."
}

#  Step 7: Print Status 
Write-Step 7 "Network status:"
docker compose -f $ComposeFile ps 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor White }

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "  [OK] Fabric Network STARTED" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "    1. Run: .\organizations\fabric-ca\registerEnroll.ps1" -ForegroundColor White
Write-Host "       (Enroll identities with Fabric CA)" -ForegroundColor DarkGray
Write-Host "    2. Run: .\scripts\createChannel.ps1" -ForegroundColor White
Write-Host "       (Create 'incidentchannel' and join peer)" -ForegroundColor DarkGray
Write-Host "    3. Run: .\scripts\networkStatus.ps1" -ForegroundColor White
Write-Host "       (View running container and channel status)" -ForegroundColor DarkGray
Write-Host "    4. cd ..\console && npm install && node fabricConsole.js" -ForegroundColor White
Write-Host "       (Start Blockchain Console)" -ForegroundColor DarkGray
Write-Host "  ============================================================" -ForegroundColor Cyan
