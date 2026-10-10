'use strict';

/**
 * Fabric Configuration — CyberSecurity Incident Ledger
 * Phase 4 Module 6: Connect Node.js backend to Hyperledger Fabric
 *
 * Reads configuration strictly from environment variables without hardcoded credentials.
 * Provides fallback auto-discovery for local development crypto paths.
 */

const fs = require('fs');
const path = require('path');

// Auto-discovery base directory for Org1 peer artifacts
const NETWORK_ORG_PATH = path.resolve(
  __dirname, '..', '..', 'blockchain', 'fabric', 'network',
  'organizations', 'peerOrganizations', 'org1.incidentledger.com'
);

// Resolve user signcert
const resolveDefaultCertPath = () => {
  const candidates = [
    path.join(NETWORK_ORG_PATH, 'users', 'Admin@org1.incidentledger.com', 'msp', 'signcerts', 'cert.pem'),
    path.join(NETWORK_ORG_PATH, 'users', 'User1@org1.incidentledger.com', 'msp', 'signcerts', 'cert.pem'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
};

// Resolve user private key from keystore
const resolveDefaultKeyPath = () => {
  const keyDirs = [
    path.join(NETWORK_ORG_PATH, 'users', 'Admin@org1.incidentledger.com', 'msp', 'keystore'),
    path.join(NETWORK_ORG_PATH, 'users', 'User1@org1.incidentledger.com', 'msp', 'keystore'),
  ];
  for (const dir of keyDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      if (files.length > 0) return path.join(dir, files[0]);
    }
  }
  return null;
};

// Resolve peer TLS root CA certificate
const resolveDefaultTlsCertPath = () => {
  const candidate = path.join(
    NETWORK_ORG_PATH, 'peers', 'peer0.org1.incidentledger.com',
    'tls', 'ca.crt'
  );
  return fs.existsSync(candidate) ? candidate : null;
};

const fabricConfig = {
  // Channel & Chaincode
  channelName:     process.env.FABRIC_CHANNEL_NAME     || 'incidentchannel',
  chaincodeName:   process.env.FABRIC_CHAINCODE_NAME   || 'incident-ledger',

  // Organization & Identity
  mspId:           process.env.FABRIC_MSP_ID           || 'Org1MSP',
  appUser:         process.env.FABRIC_APP_USER         || 'appUser',

  // Peer Network Endpoint
  peerEndpoint:    process.env.FABRIC_PEER_ENDPOINT    || 'localhost:7051',
  peerHostAlias:   process.env.FABRIC_PEER_HOST_ALIAS  || 'peer0.org1.incidentledger.com',

  // Wallet / Identity Store Path
  walletPath:      process.env.FABRIC_WALLET_PATH      || path.resolve(__dirname, '..', 'wallet'),

  // Certificates & Crypto Paths (env variable takes precedence over auto-discovery)
  certPath:        process.env.FABRIC_CERT_PATH        || resolveDefaultCertPath(),
  keyPath:         process.env.FABRIC_KEY_PATH         || resolveDefaultKeyPath(),
  tlsCertPath:     process.env.FABRIC_TLS_CERT_PATH    || resolveDefaultTlsCertPath(),

  // Connection Profile
  connectionProfile: process.env.FABRIC_CONNECTION_PROFILE || null,

  // Timeouts & Policies
  commitTimeoutSeconds: parseInt(process.env.FABRIC_COMMIT_TIMEOUT || '30', 10),
  endorseTimeoutSeconds: parseInt(process.env.FABRIC_ENDORSE_TIMEOUT || '30', 10),
};

module.exports = fabricConfig;
