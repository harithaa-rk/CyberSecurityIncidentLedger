#!/usr/bin/env node
'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  CyberSecurity Incident Ledger — Live Blockchain & Block Creation Console
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  Displays how hashes are created and streams real-time block creations to CMD:
 *   - SHA-256 Hash Generation Breakdown (Payload -> 256-bit Digest)
 *   - Pinata / IPFS CID Generation Breakdown (Multihash + Base58)
 *   - Blockchain Transaction Hash Generation (Entropy String -> 0x TXID)
 *   - Live Block Mining & Ledger Commits (Block #, Gas, Contract Address)
 *
 *  Usage:
 *    cd backend
 *    node scripts/blockConsole.js
 * ═══════════════════════════════════════════════════════════════════════════════
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const crypto   = require('crypto');
const readline = require('readline');
const BlockchainTransaction = require('../models/BlockchainTransaction');
const SecurityLog = require('../models/SecurityLog');

// ─── Colors for CMD / PowerShell ──────────────────────────────────────────────
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
  bgDark:   '\x1b[40m',
};

const CONTRACT_ADDRESS = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://CyberLedgerBC:CyberLedgerBC2005@cyberledgerbc.4gvtzma.mongodb.net/?appName=CyberLedgerBC';

// ─── Banner & How Hashes Are Created Explanation ──────────────────────────────
function printBanner() {
  const w = 82;
  const double = '═'.repeat(w);
  const single = '─'.repeat(w);

  console.clear();
  console.log(`\n${C.cyan}${C.bold}${double}${C.reset}`);
  console.log(`${C.cyan}${C.bold}   ██████╗ ██╗      ██████╗  ██████╗██╗  ██╗ ██████╗██╗  ██╗ █████╗ ██╗███╗  ██╗   ${C.reset}`);
  console.log(`${C.cyan}${C.bold}   ██╔══██╗██║     ██╔═══██╗██╔════╝██║ ██╔╝██╔════╝██║  ██║██╔══██╗██║████╗ ██║   ${C.reset}`);
  console.log(`${C.cyan}${C.bold}   ██████╔╝██║     ██║   ██║██║     █████╔╝ ██║     ███████║███████║██║██╔██╗██║   ${C.reset}`);
  console.log(`${C.cyan}${C.bold}   ██╔══██╗██║     ██║   ██║██║     ██╔═██╗ ██║     ██╔══██║██╔══██║██║██║╚████║   ${C.reset}`);
  console.log(`${C.cyan}${C.bold}   ██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗╚██████╗██║  ██║██║  ██║██║██║ ╚███║   ${C.reset}`);
  console.log(`${C.cyan}${C.bold}   ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚══╝   ${C.reset}`);
  console.log(`${C.cyan}${double}${C.reset}`);
  console.log(`${C.bold}  ⛓️  CYBERSECURITY INCIDENT LEDGER — LIVE BLOCKCHAIN & BLOCK CREATION MONITOR${C.reset}`);
  console.log(`${C.dim}  Smart Contract: ${C.white}${CONTRACT_ADDRESS}${C.dim}  |  Ledger DB: ${C.white}MongoDB Atlas${C.reset}`);
  console.log(`${C.cyan}${double}${C.reset}\n`);

  console.log(`${C.bold}${C.yellow}══════════════════════════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.yellow}  🔬 CRYPTOGRAPHIC HASH GENERATION ARCHITECTURE (HOW EACH HASH IS FORMED)${C.reset}`);
  console.log(`${C.bold}${C.yellow}══════════════════════════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`
  ${C.bold}${C.blue}1. SHA-256 PAYLOAD / EVIDENCE HASH:${C.reset}
     ${C.dim}• Input:${C.reset} Raw log file content / binary packet bytes / full log line
     ${C.dim}• Algorithm:${C.reset} SHA-256 (Secure Hash Algorithm 256-bit, FIPS PUB 180-4)
     ${C.dim}• Formula:${C.reset}   ${C.green}hash = "0x" + crypto.createHash("sha256").update(bytes).digest("hex")${C.reset}
     ${C.dim}• Purpose:${C.reset}   Provides strict tamper-evident cryptographic fingerprint.
                  If a single byte or timestamp changes, the hash changes completely.

  ${C.bold}${C.magenta}2. PINATA / IPFS CONTENT IDENTIFIER (CID):${C.reset}
     ${C.dim}• Input:${C.reset} SHA-256 digest of the exact evidence file or raw payload
     ${C.dim}• Format:${C.reset}  IPFS Multihash with prefix 0x12 (sha2-256) + 0x20 (32 bytes length)
     ${C.dim}• Formula:${C.reset}   ${C.magenta}cid = "Qm" + Base58Encode(Buffer.concat([0x12, 0x20, sha256Buffer]))${C.reset}
     ${C.dim}• Purpose:${C.reset}   Decentralized, immutable content addressing in IPFS / Pinata cloud.

  ${C.bold}${C.yellow}3. BLOCKCHAIN TRANSACTION ID (txHash):${C.reset}
     ${C.dim}• Input Entropy:${C.reset} Combine ${C.white}[Incident ID] + [SHA-256] + [IPFS CID] + [Timestamp]${C.reset}
     ${C.dim}• Formula:${C.reset}       ${C.yellow}txHash = "0x" + crypto.createHash("sha256").update(entropy).digest("hex")${C.reset}
     ${C.dim}• Purpose:${C.reset}       Uniquely seals this security incident into an immutable ledger transaction.

  ${C.bold}${C.green}4. BLOCK CREATION & SEQUENTIAL CHAINING:${C.reset}
     ${C.dim}• Block Height:${C.reset}  ${C.green}blockNumber = latestBlock.blockNumber + 1${C.reset} (starts at #14820100)
     ${C.dim}• Block Header:${C.reset}  Transaction Hash + Smart Contract Address + Gas Units + Timestamp
     ${C.dim}• Immutable:${C.reset}     Saved to ledger state and broadcast to all nodes/dashboard in real-time.
`);
  console.log(`${C.cyan}${double}${C.reset}\n`);
}

// ─── Format & Print a Single Block Creation ──────────────────────────────────
function printBlockCreation(tx, incidentDetails = null, isLive = true) {
  const w = 82;
  const double = '═'.repeat(w);
  const single = '─'.repeat(w);

  const prefix = isLive ? '⚡ [LIVE BLOCK MINED]' : '📦 [LEDGER BLOCK ARCHIVE]';
  const headerColor = isLive ? C.green : C.cyan;

  console.log(`\n${headerColor}${C.bold}${double}${C.reset}`);
  console.log(`${headerColor}${C.bold}  🧱 BLOCK #${tx.blockNumber} CREATED & COMMITTED TO LEDGER  ${C.yellow}${prefix}${C.reset}`);
  console.log(`${headerColor}${single}${C.reset}`);

  console.log(`  ${C.bold}${C.blue}BLOCK HEIGHT:${C.reset}           ${C.bold}#${tx.blockNumber}${C.reset}`);
  console.log(`  ${C.bold}${C.blue}INCIDENT / LOG ID:${C.reset}      ${C.bold}${C.white}${tx.logId}${C.reset}`);

  if (incidentDetails) {
    if (incidentDetails.attackType) {
      console.log(`  ${C.bold}${C.blue}ATTACK CLASSIFICATION:${C.reset}  ${C.red}${C.bold}${incidentDetails.attackType}${C.reset} (${incidentDetails.severity || 'UNKNOWN'})`);
    }
    if (incidentDetails.source || incidentDetails.sourceIP) {
      console.log(`  ${C.bold}${C.blue}NETWORK CONTEXT:${C.reset}        ${incidentDetails.sourceIP || '127.0.0.1'} ➜ ${incidentDetails.destinationIP || '127.0.0.1'} [${incidentDetails.protocol || 'TCP'}]`);
    }
    if (incidentDetails.hash) {
      console.log(`  ${C.bold}${C.green}SHA-256 HASH:${C.reset}           ${C.green}${incidentDetails.hash}${C.reset}`);
      console.log(`  ${C.dim}  └─ How Created: SHA-256(Raw Log Payload Bytes)${C.reset}`);
    }
    if (incidentDetails.cid) {
      console.log(`  ${C.bold}${C.magenta}PINATA / IPFS CID:${C.reset}      ${C.magenta}${incidentDetails.cid}${C.reset}`);
      console.log(`  ${C.dim}  └─ How Created: Multihash [0x12, 0x20] + SHA-256 digest ➜ Base58${C.reset}`);
    }
  }

  console.log(`  ${C.bold}${C.yellow}BLOCKCHAIN TXID:${C.reset}        ${C.bold}${C.yellow}${tx.txHash}${C.reset}`);
  console.log(`  ${C.dim}  └─ How Created: "0x" + SHA-256("${tx.logId}-<hash>-<cid>-<timestamp>")${C.reset}`);
  console.log(`  ${C.bold}${C.blue}SMART CONTRACT:${C.reset}         ${C.white}${tx.contractAddress || CONTRACT_ADDRESS}${C.reset}`);
  console.log(`  ${C.bold}${C.blue}GAS CONSUMPTION:${C.reset}        ${(tx.gasUsed || 21000).toLocaleString()} units`);
  console.log(`  ${C.bold}${C.blue}LEDGER STATUS:${C.reset}          ${C.green}${C.bold}✔ ${tx.status || 'Confirmed'}${C.reset}`);
  console.log(`  ${C.bold}${C.blue}MINED AT:${C.reset}               ${C.dim}${new Date(tx.createdAt || Date.now()).toLocaleString()}${C.reset}`);
  console.log(`${headerColor}${double}${C.reset}\n`);
}

// ─── Live Poller & Polling for Real-Time Backend Commits ──────────────────────
async function startLiveLedgerWatcher() {
  let knownTxIds = new Set();

  // Load existing transactions
  const existing = await BlockchainTransaction.find().sort({ createdAt: -1 }).limit(100);
  existing.forEach(t => knownTxIds.add(t.txHash));

  // Display the 3 most recent blocks in the ledger
  const recent3 = existing.slice(0, 3).reverse();
  if (recent3.length > 0) {
    console.log(`${C.cyan}${C.bold}  📜 RECENT COMMITTED BLOCKS IN LEDGER ARCHIVE:${C.reset}`);
    for (const item of recent3) {
      const logDoc = await SecurityLog.findOne({ incidentId: item.logId }).select('attackType severity sourceIP destinationIP protocol hash cid');
      printBlockCreation(item, logDoc, false);
    }
  }

  const latest = existing[0];
  const currentHeight = latest ? latest.blockNumber : 14820100;

  console.log(`${C.bold}${C.green}  ⚡ LIVE LEDGER LISTENER ACTIVE${C.reset}`);
  console.log(`  ${C.dim}Current Blockchain Height: ${C.white}Block #${currentHeight}${C.dim} | Listening for new real-time blocks from backend...${C.reset}`);
  console.log(`  ${C.dim}Press ${C.white}[Ctrl+C]${C.dim} to exit.${C.reset}\n`);

  // Poll every 1.5 seconds for newly added BlockchainTransactions
  setInterval(async () => {
    try {
      const newTxs = await BlockchainTransaction.find().sort({ createdAt: -1 }).limit(5);
      for (const tx of newTxs.reverse()) {
        if (!knownTxIds.has(tx.txHash)) {
          knownTxIds.add(tx.txHash);
          const logDoc = await SecurityLog.findOne({ incidentId: tx.logId }).select('attackType severity sourceIP destinationIP protocol hash cid');
          printBlockCreation(tx, logDoc, true);
        }
      }
    } catch (pollErr) {
      // transient connection error
    }
  }, 1500);
}

// ─── Main Entry Point ────────────────────────────────────────────────────────
async function main() {
  printBanner();

  console.log(`  ${C.cyan}[CONNECTING]${C.reset} Connecting to Blockchain MongoDB Ledger...`);

  try {
    await mongoose.connect(MONGO_URI);
    console.log(`  ${C.green}[CONNECTED]${C.reset} MongoDB connection established.`);
    console.log(`  ${C.dim}Database: ${mongoose.connection.name} @ ${mongoose.connection.host}${C.reset}\n`);

    await startLiveLedgerWatcher();
  } catch (err) {
    console.error(`  ${C.red}[ERROR] Could not connect to MongoDB: ${err.message}${C.reset}`);
    process.exit(1);
  }
}

main();
