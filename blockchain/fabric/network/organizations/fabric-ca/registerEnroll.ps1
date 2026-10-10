# ─────────────────────────────────────────────────────────────────────────────
# registerEnroll.ps1 — Windows PowerShell Fabric CA Registration & Enrollment
# Phase 4 Module 4: CyberSecurity Incident Ledger
#
# Registers and enrolls:
#   - Orderer CA admin, Orderer node
#   - Org1 CA admin, Org1 Peer0, Org1 User1, Org1 Admin
#
# Run from: blockchain/fabric/network/organizations/fabric-ca/
# ─────────────────────────────────────────────────────────────────────────────

param(
  [switch]$SkipOrdCA,
  [switch]$SkipOrg1CA
)

$ErrorActionPreference = "Stop"
$ScriptRoot = $PSScriptRoot
$NetworkRoot = Resolve-Path "$ScriptRoot\..\.."
$OrgRoot     = "$NetworkRoot\organizations"
$env:PATH += ";$NetworkRoot\bin"

function Write-FabricInfo { param($msg)
  Write-Host "[FABRIC-CA] $msg" -ForegroundColor Cyan
}
function Write-FabricOK { param($msg)
  Write-Host "[FABRIC-CA] OK: $msg" -ForegroundColor Green
}
function Write-FabricError { param($msg)
  Write-Host "[FABRIC-CA] ERROR: $msg" -ForegroundColor Red; exit 1
}

if (-not (Get-Command "fabric-ca-client" -ErrorAction SilentlyContinue)) {
  Write-FabricError "fabric-ca-client not found. Download Fabric binaries and add to PATH."
}

# ── Orderer CA ───────────────────────────────────────────────────────────────
if (-not $SkipOrdCA) {
  Write-FabricInfo "Enrolling the CA admin for Orderer org"
  $env:FABRIC_CA_CLIENT_HOME = "$OrgRoot\ordererOrganizations\incidentledger.com"
  New-Item -ItemType Directory -Force -Path $env:FABRIC_CA_CLIENT_HOME | Out-Null

  & fabric-ca-client enroll `
    -u https://admin:adminpw@localhost:9054 `
    --caname ca-orderer `
    --tls.certfiles "$OrgRoot\fabric-ca\ordererOrg\ca-cert.pem"

  $nodeOUs = @"
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/localhost-9054-ca-orderer.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/localhost-9054-ca-orderer.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/localhost-9054-ca-orderer.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/localhost-9054-ca-orderer.pem
    OrganizationalUnitIdentifier: orderer
"@
  $mspConfig = "$OrgRoot\ordererOrganizations\incidentledger.com\msp\config.yaml"
  New-Item -ItemType Directory -Force -Path (Split-Path $mspConfig) | Out-Null
  $nodeOUs | Set-Content $mspConfig

  Write-FabricInfo "Registering orderer"
  & fabric-ca-client register `
    --caname ca-orderer `
    --id.name orderer --id.secret ordererpw --id.type orderer `
    --tls.certfiles "$OrgRoot\fabric-ca\ordererOrg\ca-cert.pem"

  Write-FabricInfo "Registering orderer admin"
  & fabric-ca-client register `
    --caname ca-orderer `
    --id.name ordererAdmin --id.secret ordererAdminpw --id.type admin `
    --tls.certfiles "$OrgRoot\fabric-ca\ordererOrg\ca-cert.pem"

  $ordMSP = "$OrgRoot\ordererOrganizations\incidentledger.com\orderers\orderer.incidentledger.com\msp"
  New-Item -ItemType Directory -Force -Path $ordMSP | Out-Null

  Write-FabricInfo "Generating orderer MSP"
  & fabric-ca-client enroll `
    -u https://orderer:ordererpw@localhost:9054 `
    --caname ca-orderer `
    -M $ordMSP `
    --csr.hosts "orderer.incidentledger.com,localhost" `
    --tls.certfiles "$OrgRoot\fabric-ca\ordererOrg\ca-cert.pem"

  Copy-Item $mspConfig "$ordMSP\config.yaml" -Force

  $ordTLS = "$OrgRoot\ordererOrganizations\incidentledger.com\orderers\orderer.incidentledger.com\tls"
  New-Item -ItemType Directory -Force -Path $ordTLS | Out-Null

  Write-FabricInfo "Generating orderer TLS certs"
  & fabric-ca-client enroll `
    -u https://orderer:ordererpw@localhost:9054 `
    --caname ca-orderer `
    -M $ordTLS `
    --enrollment.profile tls `
    --csr.hosts "orderer.incidentledger.com,localhost" `
    --tls.certfiles "$OrgRoot\fabric-ca\ordererOrg\ca-cert.pem"

  $ordTlsCa = (Get-ChildItem "$ordTLS\tlscacerts\*")[0].FullName
  Copy-Item $ordTlsCa "$ordTLS\ca.crt" -Force
  Copy-Item (Get-ChildItem "$ordTLS\signcerts\*")[0].FullName  "$ordTLS\server.crt" -Force
  Copy-Item (Get-ChildItem "$ordTLS\keystore\*")[0].FullName   "$ordTLS\server.key" -Force

  New-Item -ItemType Directory -Force -Path "$OrgRoot\ordererOrganizations\incidentledger.com\msp\tlscacerts", "$ordMSP\tlscacerts" | Out-Null
  Copy-Item $ordTlsCa "$OrgRoot\ordererOrganizations\incidentledger.com\msp\tlscacerts\tlsca.incidentledger.com-cert.pem" -Force
  Copy-Item $ordTlsCa "$ordMSP\tlscacerts\tlsca.incidentledger.com-cert.pem" -Force

  Write-FabricInfo "Generating orderer admin MSP"
  $ordAdminMSP = "$OrgRoot\ordererOrganizations\incidentledger.com\users\Admin@incidentledger.com\msp"
  New-Item -ItemType Directory -Force -Path $ordAdminMSP, "$ordAdminMSP\tlscacerts" | Out-Null
  & fabric-ca-client enroll `
    -u https://ordererAdmin:ordererAdminpw@localhost:9054 `
    --caname ca-orderer `
    -M $ordAdminMSP `
    --tls.certfiles "$OrgRoot\fabric-ca\ordererOrg\ca-cert.pem"
  Copy-Item $mspConfig "$ordAdminMSP\config.yaml" -Force
  Copy-Item $ordTlsCa "$ordAdminMSP\tlscacerts\tlsca.incidentledger.com-cert.pem" -Force

  Write-FabricOK "Orderer identities enrolled."
}

# ── Org1 CA ──────────────────────────────────────────────────────────────────
if (-not $SkipOrg1CA) {
  Write-FabricInfo "Enrolling the CA admin for Org1"
  $env:FABRIC_CA_CLIENT_HOME = "$OrgRoot\peerOrganizations\org1.incidentledger.com"
  New-Item -ItemType Directory -Force -Path $env:FABRIC_CA_CLIENT_HOME | Out-Null

  & fabric-ca-client enroll `
    -u https://admin:adminpw@localhost:7054 `
    --caname ca-org1 `
    --tls.certfiles "$OrgRoot\fabric-ca\org1\ca-cert.pem"

  $nodeOUs1 = @"
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/localhost-7054-ca-org1.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/localhost-7054-ca-org1.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/localhost-7054-ca-org1.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/localhost-7054-ca-org1.pem
    OrganizationalUnitIdentifier: orderer
"@
  $org1Config = "$OrgRoot\peerOrganizations\org1.incidentledger.com\msp\config.yaml"
  New-Item -ItemType Directory -Force -Path (Split-Path $org1Config) | Out-Null
  $nodeOUs1 | Set-Content $org1Config

  foreach ($id in @(
    @{name="peer0"; secret="peer0pw"; type="peer"},
    @{name="user1"; secret="user1pw"; type="client"},
    @{name="org1admin"; secret="org1adminpw"; type="admin"}
  )) {
    Write-FabricInfo "Registering $($id.name)"
    & fabric-ca-client register `
      --caname ca-org1 `
      --id.name $id.name --id.secret $id.secret --id.type $id.type `
      --tls.certfiles "$OrgRoot\fabric-ca\org1\ca-cert.pem"
  }

  $peerMSP = "$OrgRoot\peerOrganizations\org1.incidentledger.com\peers\peer0.org1.incidentledger.com\msp"
  New-Item -ItemType Directory -Force -Path $peerMSP | Out-Null
  Write-FabricInfo "Generating peer0 MSP"
  & fabric-ca-client enroll `
    -u https://peer0:peer0pw@localhost:7054 `
    --caname ca-org1 `
    -M $peerMSP `
    --csr.hosts "peer0.org1.incidentledger.com,localhost" `
    --tls.certfiles "$OrgRoot\fabric-ca\org1\ca-cert.pem"
  Copy-Item $org1Config "$peerMSP\config.yaml" -Force

  $peerTLS = "$OrgRoot\peerOrganizations\org1.incidentledger.com\peers\peer0.org1.incidentledger.com\tls"
  New-Item -ItemType Directory -Force -Path $peerTLS | Out-Null
  Write-FabricInfo "Generating peer0 TLS certs"
  & fabric-ca-client enroll `
    -u https://peer0:peer0pw@localhost:7054 `
    --caname ca-org1 `
    -M $peerTLS `
    --enrollment.profile tls `
    --csr.hosts "peer0.org1.incidentledger.com,localhost" `
    --tls.certfiles "$OrgRoot\fabric-ca\org1\ca-cert.pem"
  $peerTlsCa = (Get-ChildItem "$peerTLS\tlscacerts\*")[0].FullName
  Copy-Item $peerTlsCa "$peerTLS\ca.crt" -Force
  Copy-Item (Get-ChildItem "$peerTLS\signcerts\*")[0].FullName  "$peerTLS\server.crt" -Force
  Copy-Item (Get-ChildItem "$peerTLS\keystore\*")[0].FullName   "$peerTLS\server.key" -Force

  New-Item -ItemType Directory -Force -Path "$OrgRoot\peerOrganizations\org1.incidentledger.com\msp\tlscacerts", "$peerMSP\tlscacerts" | Out-Null
  Copy-Item $peerTlsCa "$OrgRoot\peerOrganizations\org1.incidentledger.com\msp\tlscacerts\ca.crt" -Force
  Copy-Item $peerTlsCa "$peerMSP\tlscacerts\ca.crt" -Force

  Write-FabricInfo "Generating org admin MSP"
  $adminMSP = "$OrgRoot\peerOrganizations\org1.incidentledger.com\users\Admin@org1.incidentledger.com\msp"
  New-Item -ItemType Directory -Force -Path $adminMSP, "$adminMSP\tlscacerts" | Out-Null
  & fabric-ca-client enroll `
    -u https://org1admin:org1adminpw@localhost:7054 `
    --caname ca-org1 `
    -M $adminMSP `
    --tls.certfiles "$OrgRoot\fabric-ca\org1\ca-cert.pem"
  Copy-Item $org1Config "$adminMSP\config.yaml" -Force
  Copy-Item $peerTlsCa "$adminMSP\tlscacerts\ca.crt" -Force

  Write-FabricOK "Org1 identities enrolled."
}

Write-FabricOK "All Fabric CA identities successfully registered and enrolled."
