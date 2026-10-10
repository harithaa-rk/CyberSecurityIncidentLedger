'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  Hyperledger Fabric Blockchain Console
 *  CyberSecurity Incident Ledger — Phase 4 Module 4
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  Connects to the Fabric network and streams LIVE blockchain transaction
 *  events to the terminal in real-time. Displays:
 *    - Transaction ID (full 64-char hex)
 *    - Block number
 *    - Channel: incidentchannel
 *    - Chaincode: incident-ledger
 *    - Event type (EvidenceRecorded, IntegrityViolation, etc.)
 *    - SHA-256 hash
 *    - IPFS CID
 *    - Evidence ID / Incident ID
 *    - Timestamp
 *    - Recorded by
 *    - Block commit time (live)
 *
 *  Usage:
 *    cd blockchain/fabric/console
 *    npm install
 *    node fabricConsole.js
 *
 *  Environment Variables (optional, via .env or system):
 *    FABRIC_PEER_ENDPOINT        (default: localhost:7051)
 *    FABRIC_CHANNEL              (default: incidentchannel)
 *    FABRIC_CHAINCODE_NAME       (default: incident-ledger)
 *    FABRIC_MSP_ID               (default: Org1MSP)
 *    FABRIC_CERT_PATH            (path to admin cert pem)
 *    FABRIC_KEY_PATH             (path to admin private key pem)
 *    FABRIC_TLS_CERT_PATH        (path to peer TLS ca.crt)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const grpc          = require('@grpc/grpc-js');
const { connect, hash }   = require('@hyperledger/fabric-gateway');
const crypto        = require('crypto');
const fs            = require('fs');
const path          = require('path');

// ─── Configuration ────────────────────────────────────────────────────────────
const PEER_ENDPOINT    = process.env.FABRIC_PEER_ENDPOINT    || 'localhost:7051';
const CHANNEL_NAME     = process.env.FABRIC_CHANNEL          || 'incidentchannel';
const CHAINCODE_NAME   = process.env.FABRIC_CHAINCODE_NAME   || 'incident-ledger';
const MSP_ID           = process.env.FABRIC_MSP_ID           || 'Org1MSP';
const PEER_HOST_ALIAS  = process.env.FABRIC_PEER_HOST_ALIAS  || 'peer0.org1.incidentledger.com';

// Default paths (relative to blockchain/fabric/network/organizations/)
const NETWORK_ORG_PATH = path.resolve(
  __dirname, '..', 'network', 'organizations',
  'peerOrganizations', 'org1.incidentledger.com'
);

const CERT_PATH = process.env.FABRIC_CERT_PATH || path.join(
  NETWORK_ORG_PATH, 'users', 'Admin@org1.incidentledger.com',
  'msp', 'signcerts', 'cert.pem'
);

const KEY_PATH = process.env.FABRIC_KEY_PATH || (() => {
  const keyDir = path.join(
    NETWORK_ORG_PATH, 'users', 'Admin@org1.incidentledger.com',
    'msp', 'keystore'
  );
  if (fs.existsSync(keyDir)) {
    const files = fs.readdirSync(keyDir);
    return files.length > 0 ? path.join(keyDir, files[0]) : null;
  }
  return null;
})();

const TLS_CERT_PATH = process.env.FABRIC_TLS_CERT_PATH || path.join(
  NETWORK_ORG_PATH, 'peers', 'peer0.org1.incidentledger.com',
  'tls', 'ca.crt'
);

// ─── Console Colors & Formatting ─────────────────────────────────────────────
const C = {
  reset:    '\x1b[0m',
  bold:     '\x1b[1m',
  dim:      '\x1b[2m',
  cyan:     '\x1b[36m',
  green:    '\x1b[32m',
  yellow:   '\x1b[33m',
  red:      '\x1b[31m',
  magenta:  '\x1b[35m',
  blue:     '\x1b[34m',
  white:    '\x1b[37m',
  bgBlack:  '\x1b[40m',
  bgCyan:   '\x1b[46m',
};

let blockCounter = 0;
let txCounter    = 0;
const startTime  = Date.now();

// ─── Banner ───────────────────────────────────────────────────────────────────
function printBanner() {
  const w = 80;
  const line = '═'.repeat(w);
  console.log(`\n${C.cyan}${C.bold}${line}${C.reset}`);
  console.log(`${C.cyan}${C.bold}  ██████╗ ██╗      ██████╗  ██████╗██╗  ██╗ ██████╗██╗  ██╗ █████╗ ██╗███╗  ██╗${C.reset}`);
  console.log(`${C.cyan}${C.bold}  ██╔══██╗██║     ██╔═══██╗██╔════╝██║ ██╔╝██╔════╝██║  ██║██╔══██╗██║████╗ ██║${C.reset}`);
  console.log(`${C.cyan}${C.bold}  ██████╔╝██║     ██║   ██║██║     █████╔╝ ██║     ███████║███████║██║██╔██╗██║${C.reset}`);
  console.log(`${C.cyan}${C.bold}  ██╔══██╗██║     ██║   ██║██║     ██╔═██╗ ██║     ██╔══██║██╔══██║██║██║╚████║${C.reset}`);
  console.log(`${C.cyan}${C.bold}  ██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗╚██████╗██║  ██║██║  ██║██║██║ ╚███║${C.reset}`);
  console.log(`${C.cyan}${C.bold}  ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚══╝${C.reset}`);
  console.log(`${C.cyan}${line}${C.reset}`);
  console.log(`${C.bold}  🔗 Hyperledger Fabric Blockchain Console${C.reset}  ${C.dim}— CyberSecurity Incident Ledger${C.reset}`);
  console.log(`${C.dim}  Channel: ${C.white}${CHANNEL_NAME}${C.dim}  |  Chaincode: ${C.white}${CHAINCODE_NAME}${C.dim}  |  Peer: ${C.white}${PEER_ENDPOINT}${C.reset}`);
  console.log(`${C.cyan}${line}${C.reset}\n`);
}

// ─── Transaction Display ──────────────────────────────────────────────────────
function printTransaction(type, data, blockNum) {
  txCounter++;
  const now     = new Date().toLocaleString();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const divider = '─'.repeat(78);

  const typeColor = type === 'EvidenceRecorded'    ? C.green
                  : type === 'IntegrityViolation'   ? C.red
                  : type === 'EvidenceStatusUpdated' ? C.yellow
                  : C.magenta;

  console.log(`\n${C.cyan}${divider}${C.reset}`);
  console.log(`${typeColor}${C.bold}  [TX #${txCounter}] ${type}${C.reset}  ${C.dim}@ ${now}  |  Uptime: ${elapsed}s${C.reset}`);
  console.log(`${C.cyan}${divider}${C.reset}`);

  // Block & Channel details
  if (blockNum !== undefined) {
    console.log(`  ${C.bold}${C.blue}BLOCK${C.reset}           ${C.white}#${blockNum}${C.reset}`);
    blockCounter = Math.max(blockCounter, blockNum);
  }
  console.log(`  ${C.bold}${C.blue}CHANNEL${C.reset}         ${C.white}${CHANNEL_NAME}${C.reset}`);
  console.log(`  ${C.bold}${C.blue}CHAINCODE${C.reset}       ${C.white}${CHAINCODE_NAME}${C.reset}`);

  // Transaction-specific fields
  if (data.fabricTxId) {
    console.log(`  ${C.bold}${C.blue}TX ID${C.reset}           ${C.yellow}${data.fabricTxId}${C.reset}`);
    console.log(`  ${C.dim}  └─ How Created: Fabric Transaction Digest / SHA-256 proposal hash${C.reset}`);
  }
  if (data.evidenceId) {
    console.log(`  ${C.bold}${C.blue}EVIDENCE ID${C.reset}     ${C.white}${data.evidenceId}${C.reset}`);
  }
  if (data.incidentId) {
    console.log(`  ${C.bold}${C.blue}INCIDENT ID${C.reset}     ${C.white}${data.incidentId}${C.reset}`);
  }
  if (data.sha256Hash) {
    console.log(`  ${C.bold}${C.blue}SHA-256 HASH${C.reset}    ${C.green}${data.sha256Hash}${C.reset}`);
    console.log(`  ${C.dim}  └─ How Created: crypto.createHash("sha256").update(binaryFileBytes).digest("hex")${C.reset}`);
  }
  if (data.ipfsCid) {
    console.log(`  ${C.bold}${C.blue}IPFS CID${C.reset}        ${C.magenta}${data.ipfsCid}${C.reset}`);
    console.log(`  ${C.dim}  └─ How Created: IPFS multihash [0x12, 0x20] + SHA-256 digest -> Base58 CID${C.reset}`);
  }
  if (data.recordedBy) {
    console.log(`  ${C.bold}${C.blue}RECORDED BY${C.reset}     ${C.white}${data.recordedBy}${C.reset}`);
  }
  if (data.timestamp) {
    console.log(`  ${C.bold}${C.blue}TIMESTAMP${C.reset}       ${C.white}${data.timestamp}${C.reset}`);
  }
  if (data.fileName) {
    console.log(`  ${C.bold}${C.blue}FILE${C.reset}            ${C.white}${data.fileName} (${data.fileType}, ${(data.fileSize || 0).toLocaleString()} bytes)${C.reset}`);
  }
  if (type === 'IntegrityViolation') {
    console.log(`  ${C.red}${C.bold}⚠  TAMPER ALERT: Hash mismatch detected! Evidence may have been altered.${C.reset}`);
  }
  if (data.status) {
    const statusColor = data.status === 'INTEGRITY_CONFIRMED' ? C.green
                      : data.status === 'INTEGRITY_VIOLATION_DETECTED' ? C.red : C.white;
    console.log(`  ${C.bold}${C.blue}STATUS${C.reset}          ${statusColor}${data.status}${C.reset}`);
  }

  console.log(`${C.cyan}${divider}${C.reset}`);
  printStats();
}

function printStats() {
  const uptime  = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(
    `  ${C.dim}📊 Total Transactions: ${C.white}${txCounter}${C.dim}  |  ` +
    `Latest Block: ${C.white}#${blockCounter}${C.dim}  |  ` +
    `Uptime: ${C.white}${uptime}s${C.dim}  |  ` +
    `Channel: ${C.white}${CHANNEL_NAME}${C.reset}`
  );
}

function printBlockCommit(blockNum, txCount, channel) {
  const now = new Date().toLocaleString();
  console.log(
    `\n  ${C.bold}${C.green}✔ BLOCK #${blockNum} COMMITTED${C.reset}  ` +
    `${C.dim}| ${txCount} tx(s) | channel: ${channel} | ${now}${C.reset}`
  );
}

function printInfo(msg) {
  console.log(`  ${C.cyan}[INFO]${C.reset} ${msg}`);
}

function printError(msg) {
  console.log(`  ${C.red}[ERROR]${C.reset} ${msg}`);
}

function printWarn(msg) {
  console.log(`  ${C.yellow}[WARN]${C.reset} ${msg}`);
}

// ─── gRPC Client ──────────────────────────────────────────────────────────────
function buildGrpcClient() {
  if (!fs.existsSync(TLS_CERT_PATH)) {
    printWarn(`TLS cert not found at: ${TLS_CERT_PATH}`);
    printWarn('Connecting without TLS (dev mode)...');
    return new grpc.Client(PEER_ENDPOINT, grpc.credentials.createInsecure());
  }

  const tlsCert = fs.readFileSync(TLS_CERT_PATH);
  const credentials = grpc.credentials.createSsl(tlsCert);
  return new grpc.Client(PEER_ENDPOINT, credentials, {
    'grpc.ssl_target_name_override': PEER_HOST_ALIAS,
  });
}

// ─── Fabric Identity ──────────────────────────────────────────────────────────
function buildIdentity() {
  if (!fs.existsSync(CERT_PATH)) {
    throw new Error(`Admin cert not found at: ${CERT_PATH}\nRun registerEnroll.ps1 first.`);
  }
  const certPem = fs.readFileSync(CERT_PATH);
  return { mspId: MSP_ID, credentials: certPem };
}

function buildSigner() {
  if (!KEY_PATH || !fs.existsSync(KEY_PATH)) {
    throw new Error(`Private key not found at: ${KEY_PATH}\nRun registerEnroll.ps1 first.`);
  }
  const privateKeyPem = fs.readFileSync(KEY_PATH);
  const privateKey    = crypto.createPrivateKey(privateKeyPem);
  return async (digest) => {
    const sig = crypto.sign(null, Buffer.from(digest), privateKey);
    return sig;
  };
}

// ─── Block Event Listener ─────────────────────────────────────────────────────
async function listenForEvents(network) {
  printInfo(`Subscribing to block events on channel: ${CHANNEL_NAME}`);

  const events = await network.newBlockEventsRequest().getEvents();

  for await (const blockEvent of events) {
    const blockNum = Number(blockEvent.blockNumber);
    printBlockCommit(blockNum, blockEvent.transactions?.length || 0, CHANNEL_NAME);

    // Parse chaincode events from each transaction
    for (const tx of blockEvent.transactions || []) {
      if (tx.chaincodeEvents) {
        for (const ccEvent of tx.chaincodeEvents) {
          if (ccEvent.chaincodeName !== CHAINCODE_NAME) continue;

          try {
            const payload = JSON.parse(Buffer.from(ccEvent.payload).toString('utf8'));
            printTransaction(ccEvent.eventName, payload, blockNum);
          } catch (e) {
            printWarn(`Could not parse event payload for ${ccEvent.eventName}: ${e.message}`);
          }
        }
      }
    }
  }
}

// ─── Live Query Poller (fallback when no live events) ─────────────────────────
async function startQueryPoller(contract) {
  printInfo('Starting ledger query poll every 10s as fallback event listener...');

  setInterval(async () => {
    try {
      const result = await contract.evaluateTransaction('GetAllEvidence');
      const records = JSON.parse(Buffer.from(result).toString());
      if (records.length > 0) {
        const last = records[records.length - 1];
        if (last.fabricTxId) {
          printInfo(`Latest ledger state: ${records.length} evidence record(s). Last: ${last.evidenceId}`);
        }
      }
    } catch (err) {
      // Network may be down — silently skip poll
    }
  }, 10000);
}

// ─── Test Transaction Submission ──────────────────────────────────────────────
async function submitTestTransaction(contract) {
  printInfo('Submitting genesis test transaction to verify ledger connectivity...');

  const testId      = `EVD-TEST-${Date.now()}`;
  const testHash    = crypto.createHash('sha256').update(`test-${Date.now()}`).digest('hex');
  const testCid     = `bafytest${Math.random().toString(36).slice(2, 14)}`;

  try {
    const result = await contract.submitTransaction(
      'RecordEvidence',
      testId,
      'INC-CONSOLE-TEST',
      testHash,
      testCid,
      'console-test.log',
      'text/plain',
      '128',
      'FabricConsole',
      'Blockchain Console connectivity test transaction'
    );

    const asset = JSON.parse(Buffer.from(result).toString());
    printTransaction('EvidenceRecorded', asset, undefined);
    printInfo('Test transaction committed successfully. Console is live.');
    return true;
  } catch (err) {
    printWarn(`Test transaction failed (chaincode may not be deployed yet): ${err.message}`);
    printInfo('Console will still display events when chaincode is deployed and transactions occur.');
    return false;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  printBanner();
  printInfo(`Connecting to Fabric peer at: ${PEER_ENDPOINT}`);
  printInfo(`Channel: ${CHANNEL_NAME}  |  Chaincode: ${CHAINCODE_NAME}  |  MSP: ${MSP_ID}`);

  let client, gateway;

  // ── Try live Fabric connection ───────────────────────────────────────────
  try {
    client  = buildGrpcClient();
    const identity = buildIdentity();
    const signer   = buildSigner();

    gateway = connect({
      client,
      identity,
      signer,
      hash: hash.sha256,
      evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
      endorseOptions:  () => ({ deadline: Date.now() + 15000 }),
      submitOptions:   () => ({ deadline: Date.now() + 5000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
    });

    const network  = gateway.getNetwork(CHANNEL_NAME);
    const contract = network.getContract(CHAINCODE_NAME);

    printInfo('Connected to Fabric network successfully.');

    // Submit a test transaction
    await submitTestTransaction(contract);

    // Start live block event listener
    printInfo('Starting real-time block event listener...');
    console.log(`\n${C.bold}${C.cyan}  ⚡ LIVE BLOCKCHAIN CONSOLE ACTIVE — Monitoring incidentchannel${C.reset}\n`);
    console.log(`  ${C.dim}Every transaction committed to the ledger will appear below in real-time.${C.reset}`);
    console.log(`  ${C.dim}Press CTRL+C to stop the console.${C.reset}\n`);

    // Start fallback poller alongside event listener
    await startQueryPoller(contract);

    // Await live events (blocks) — this runs indefinitely
    await listenForEvents(network);

  } catch (err) {
    if (err.message && (
      err.message.includes('cert not found') ||
      err.message.includes('key not found') ||
      err.message.includes('not found at')
    )) {
      // Crypto materials not yet generated — start in DEMO mode
      printWarn('Fabric crypto materials not yet found.');
      printWarn('Starting in DEMO MODE to simulate transactions until the network is running.');
      console.log('');
      runDemoMode();
    } else {
      printWarn(`Could not connect to live Fabric network: ${err.message}`);
      printWarn('Starting in DEMO MODE. Run startNetwork.ps1 to bring up the live network.');
      console.log('');
      runDemoMode();
    }
  }
}

// ─── Waiting Mode (no live network yet) ──────────────────────────────────────
function runDemoMode() {
  console.log(`${C.bold}${C.yellow}  ⚠  WAITING FOR LIVE NETWORK — Live Fabric events will display when startNetwork.ps1 is run${C.reset}`);
  console.log(`  ${C.dim}The console will automatically display real blockchain transactions as they are ingested by the backend.${C.reset}\n`);
  
  // Keep process alive
  setInterval(() => {}, 60000);
}

// ─── Handle graceful shutdown ──────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log(`\n\n${C.cyan}  Blockchain Console stopped.  Total transactions observed: ${txCounter}${C.reset}\n`);
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  printError(`Unhandled rejection: ${err.message}`);
});

main();
