#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# registerEnroll.sh — Fabric CA Identity Registration & Enrollment
# Phase 4 Module 4: CyberSecurity Incident Ledger
#
# Creates MSP directories and enrolls:
#   - Orderer CA Admin, Orderer node
#   - Org1 CA Admin, Org1 Peer, Org1 Admin User, Org1 User1
# ─────────────────────────────────────────────────────────────────────────────

set -e
. "$(dirname "$0")/../../../scripts/utils.sh" 2>/dev/null || true

FABRIC_CA_CLIENT_HOME=${PWD}/fabric-ca

function createOrderer() {
  infoln "Enrolling the CA admin for Orderer"

  mkdir -p ../organizations/ordererOrganizations/incidentledger.com

  export FABRIC_CA_CLIENT_HOME=${PWD}/../organizations/ordererOrganizations/incidentledger.com

  set -x
  fabric-ca-client enroll \
    -u https://admin:adminpw@localhost:9054 \
    --caname ca-orderer \
    --tls.certfiles "${PWD}/../organizations/fabric-ca/ordererOrg/ca-cert.pem"
  { set +x; } 2>/dev/null

  echo 'NodeOUs:
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
    OrganizationalUnitIdentifier: orderer' > "${PWD}/../organizations/ordererOrganizations/incidentledger.com/msp/config.yaml"

  infoln "Registering orderer node"
  set -x
  fabric-ca-client register \
    --caname ca-orderer \
    --id.name orderer \
    --id.secret ordererpw \
    --id.type orderer \
    --tls.certfiles "${PWD}/../organizations/fabric-ca/ordererOrg/ca-cert.pem"
  { set +x; } 2>/dev/null

  infoln "Registering the orderer admin user"
  set -x
  fabric-ca-client register \
    --caname ca-orderer \
    --id.name ordererAdmin \
    --id.secret ordererAdminpw \
    --id.type admin \
    --tls.certfiles "${PWD}/../organizations/fabric-ca/ordererOrg/ca-cert.pem"
  { set +x; } 2>/dev/null

  mkdir -p ../organizations/ordererOrganizations/incidentledger.com/orderers
  mkdir -p ../organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com

  infoln "Generating the orderer MSP"
  set -x
  fabric-ca-client enroll \
    -u https://orderer:ordererpw@localhost:9054 \
    --caname ca-orderer \
    -M "${PWD}/../organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/msp" \
    --csr.hosts "orderer.incidentledger.com,localhost" \
    --tls.certfiles "${PWD}/../organizations/fabric-ca/ordererOrg/ca-cert.pem"
  { set +x; } 2>/dev/null

  cp "${PWD}/../organizations/ordererOrganizations/incidentledger.com/msp/config.yaml" \
     "${PWD}/../organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/msp/config.yaml"

  infoln "Generating the orderer TLS certificates"
  set -x
  fabric-ca-client enroll \
    -u https://orderer:ordererpw@localhost:9054 \
    --caname ca-orderer \
    -M "${PWD}/../organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/tls" \
    --enrollment.profile tls \
    --csr.hosts "orderer.incidentledger.com,localhost" \
    --tls.certfiles "${PWD}/../organizations/fabric-ca/ordererOrg/ca-cert.pem"
  { set +x; } 2>/dev/null

  cp "${PWD}/../organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/tls/tlscacerts/"* \
     "${PWD}/../organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/tls/ca.crt"
  cp "${PWD}/../organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/tls/signcerts/"* \
     "${PWD}/../organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/tls/server.crt"
  cp "${PWD}/../organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/tls/keystore/"* \
     "${PWD}/../organizations/ordererOrganizations/incidentledger.com/orderers/orderer.incidentledger.com/tls/server.key"

  infoln "Generating the orderer admin MSP"
  set -x
  fabric-ca-client enroll \
    -u https://ordererAdmin:ordererAdminpw@localhost:9054 \
    --caname ca-orderer \
    -M "${PWD}/../organizations/ordererOrganizations/incidentledger.com/users/Admin@incidentledger.com/msp" \
    --tls.certfiles "${PWD}/../organizations/fabric-ca/ordererOrg/ca-cert.pem"
  { set +x; } 2>/dev/null

  cp "${PWD}/../organizations/ordererOrganizations/incidentledger.com/msp/config.yaml" \
     "${PWD}/../organizations/ordererOrganizations/incidentledger.com/users/Admin@incidentledger.com/msp/config.yaml"
}

function createOrg1() {
  infoln "Enrolling the CA admin for Org1"

  mkdir -p ../organizations/peerOrganizations/org1.incidentledger.com/

  export FABRIC_CA_CLIENT_HOME=${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/

  set -x
  fabric-ca-client enroll \
    -u https://admin:adminpw@localhost:7054 \
    --caname ca-org1 \
    --tls.certfiles "${PWD}/../organizations/fabric-ca/org1/ca-cert.pem"
  { set +x; } 2>/dev/null

  echo 'NodeOUs:
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
    OrganizationalUnitIdentifier: orderer' > "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/msp/config.yaml"

  infoln "Registering peer0"
  set -x
  fabric-ca-client register \
    --caname ca-org1 \
    --id.name peer0 \
    --id.secret peer0pw \
    --id.type peer \
    --tls.certfiles "${PWD}/../organizations/fabric-ca/org1/ca-cert.pem"
  { set +x; } 2>/dev/null

  infoln "Registering user"
  set -x
  fabric-ca-client register \
    --caname ca-org1 \
    --id.name user1 \
    --id.secret user1pw \
    --id.type client \
    --tls.certfiles "${PWD}/../organizations/fabric-ca/org1/ca-cert.pem"
  { set +x; } 2>/dev/null

  infoln "Registering the org admin"
  set -x
  fabric-ca-client register \
    --caname ca-org1 \
    --id.name org1admin \
    --id.secret org1adminpw \
    --id.type admin \
    --tls.certfiles "${PWD}/../organizations/fabric-ca/org1/ca-cert.pem"
  { set +x; } 2>/dev/null

  mkdir -p ../organizations/peerOrganizations/org1.incidentledger.com/peers
  mkdir -p ../organizations/peerOrganizations/org1.incidentledger.com/peers/peer0.org1.incidentledger.com

  infoln "Generating the peer0 MSP"
  set -x
  fabric-ca-client enroll \
    -u https://peer0:peer0pw@localhost:7054 \
    --caname ca-org1 \
    -M "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/peers/peer0.org1.incidentledger.com/msp" \
    --csr.hosts "peer0.org1.incidentledger.com,localhost" \
    --tls.certfiles "${PWD}/../organizations/fabric-ca/org1/ca-cert.pem"
  { set +x; } 2>/dev/null

  cp "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/msp/config.yaml" \
     "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/peers/peer0.org1.incidentledger.com/msp/config.yaml"

  infoln "Generating the peer0 TLS certificates"
  set -x
  fabric-ca-client enroll \
    -u https://peer0:peer0pw@localhost:7054 \
    --caname ca-org1 \
    -M "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/peers/peer0.org1.incidentledger.com/tls" \
    --enrollment.profile tls \
    --csr.hosts "peer0.org1.incidentledger.com,localhost" \
    --tls.certfiles "${PWD}/../organizations/fabric-ca/org1/ca-cert.pem"
  { set +x; } 2>/dev/null

  cp "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/peers/peer0.org1.incidentledger.com/tls/tlscacerts/"* \
     "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/peers/peer0.org1.incidentledger.com/tls/ca.crt"
  cp "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/peers/peer0.org1.incidentledger.com/tls/signcerts/"* \
     "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/peers/peer0.org1.incidentledger.com/tls/server.crt"
  cp "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/peers/peer0.org1.incidentledger.com/tls/keystore/"* \
     "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/peers/peer0.org1.incidentledger.com/tls/server.key"

  infoln "Generating the user MSP"
  set -x
  fabric-ca-client enroll \
    -u https://user1:user1pw@localhost:7054 \
    --caname ca-org1 \
    -M "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/users/User1@org1.incidentledger.com/msp" \
    --tls.certfiles "${PWD}/../organizations/fabric-ca/org1/ca-cert.pem"
  { set +x; } 2>/dev/null

  cp "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/msp/config.yaml" \
     "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/users/User1@org1.incidentledger.com/msp/config.yaml"

  infoln "Generating the org admin MSP"
  set -x
  fabric-ca-client enroll \
    -u https://org1admin:org1adminpw@localhost:7054 \
    --caname ca-org1 \
    -M "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/users/Admin@org1.incidentledger.com/msp" \
    --tls.certfiles "${PWD}/../organizations/fabric-ca/org1/ca-cert.pem"
  { set +x; } 2>/dev/null

  cp "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/msp/config.yaml" \
     "${PWD}/../organizations/peerOrganizations/org1.incidentledger.com/users/Admin@org1.incidentledger.com/msp/config.yaml"
}

function infoln() {
  echo -e "\e[36m[FABRIC-CA] $1\e[0m"
}

createOrderer
createOrg1
infoln "All identities enrolled successfully."
