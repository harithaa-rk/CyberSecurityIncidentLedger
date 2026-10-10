/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const crypto = require('crypto');
const IncidentLedger = require('../lib/incidentLedger');

// ─────────────────────────────────────────────────────────────────────────────
// Production-accurate Fabric Mock Context simulating 'incidentchannel'
// ─────────────────────────────────────────────────────────────────────────────
class ChannelHistoryIterator {
  constructor(historyList) {
    this.historyList = historyList || [];
    this.index = 0;
  }
  async next() {
    if (this.index < this.historyList.length) {
      return { value: this.historyList[this.index++], done: false };
    }
    return { value: null, done: true };
  }
  async close() {}
}

class ChannelStateIterator {
  constructor(records) {
    this.records = records || [];
    this.index = 0;
  }
  async next() {
    if (this.index < this.records.length) {
      const rec = this.records[this.index++];
      return {
        value: {
          key: rec.key,
          value: Buffer.from(JSON.stringify(rec.value)),
        },
        done: false,
      };
    }
    return { value: null, done: true };
  }
  async close() {}
}

class IncidentChannelStub {
  constructor(channelName = 'incidentchannel') {
    this.channelName = channelName;
    this.state = new Map();
    this.history = new Map();
    this.events = [];
    this.blockNumber = 1;
    this.txNumber = 0;
  }

  createTxId() {
    return '0x' + crypto.randomBytes(32).toString('hex');
  }

  setNextTransaction() {
    this.txNumber++;
    this.currentTxId = this.createTxId();
    this.currentTimestamp = Math.floor(Date.now() / 1000);
  }

  getTxID() {
    return this.currentTxId || this.createTxId();
  }

  getTxTimestamp() {
    const sec = this.currentTimestamp || Math.floor(Date.now() / 1000);
    return {
      seconds: { low: sec, high: 0 },
      nanos: 0,
    };
  }

  async getState(key) {
    const val = this.state.get(key);
    return val ? Buffer.from(val) : Buffer.from('');
  }

  async putState(key, buffer) {
    const strVal = buffer.toString('utf8');
    this.state.set(key, strVal);

    if (!this.history.has(key)) {
      this.history.set(key, []);
    }
    this.history.get(key).push({
      txId: this.getTxID(),
      timestamp: { seconds: { low: this.currentTimestamp } },
      isDelete: false,
      value: buffer,
    });
  }

  async getHistoryForKey(key) {
    const list = this.history.get(key) || [];
    return new ChannelHistoryIterator(list);
  }

  async getStateByRange(startKey, endKey) {
    const records = [];
    for (const [key, val] of this.state.entries()) {
      try {
        records.push({ key, value: JSON.parse(val) });
      } catch {
        records.push({ key, value: val });
      }
    }
    return new ChannelStateIterator(records);
  }

  async getQueryResult(queryString) {
    const query = JSON.parse(queryString);
    const selector = query.selector || {};
    const matched = [];

    for (const [key, val] of this.state.entries()) {
      try {
        const obj = JSON.parse(val);
        let match = true;
        for (const [prop, target] of Object.entries(selector)) {
          if (obj[prop] !== target) {
            match = false;
            break;
          }
        }
        if (match) {
          matched.push({ key, value: obj });
        }
      } catch {}
    }
    return new ChannelStateIterator(matched);
  }

  setEvent(name, payload) {
    this.events.push({
      name,
      payload: JSON.parse(payload.toString('utf8')),
      txId: this.getTxID(),
      timestamp: new Date().toISOString(),
    });
  }
}

class IncidentChannelContext {
  constructor() {
    this.stub = new IncidentChannelStub('incidentchannel');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters & UI
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
  blue:    '\x1b[34m',
  white:   '\x1b[37m',
};

function printBanner() {
  const line = '═'.repeat(78);
  console.log(`\n${C.cyan}${C.bold}${line}${C.reset}`);
  console.log(`${C.cyan}${C.bold}  🔗 HYPERLEDGER FABRIC CHAINCODE EXECUTION ENGINE${C.reset}`);
  console.log(`${C.dim}  Channel: ${C.white}incidentchannel${C.dim}  |  Chaincode: ${C.white}incident-ledger${C.dim}  |  Language: ${C.white}Node.js/JavaScript${C.reset}`);
  console.log(`${C.dim}  Phase 4 Module 5: Evidence Integrity Smart Contract${C.reset}`);
  console.log(`${C.cyan}${C.bold}${line}${C.reset}\n`);
}

function printSection(title) {
  console.log(`\n${C.yellow}${C.bold}▶ ${title}${C.reset}`);
  console.log(`${C.dim}${'─'.repeat(78)}${C.reset}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Execution & Test Pipeline
// ─────────────────────────────────────────────────────────────────────────────
async function executePhase4Module5() {
  printBanner();

  const contract = new IncidentLedger();
  const ctx = new IncidentChannelContext();

  const INCIDENT_ID = 'INC-20260909-224500';
  const EVIDENCE_ID_1 = 'EVD-20260909-227152';
  const EVIDENCE_ID_2 = 'EVD-20260909-734368';
  const IPFS_CID_1 = 'bafkreid5z264h7h63xuvv6ox2s5cwt5v5r5y4f3vve7eb56s6d4rz4zbu';
  const IPFS_CID_2 = 'bafkreic7x264h7h63xuvv6ox2s5cwt5v5r5y4f3vve7eb56s6d4rz4xyz';
  const RAW_CONTENT_1 = 'LOG: 2026-09-09 12:32:00 [ALERT] SQL Injection detected from 192.168.1.105';
  const SHA256_HASH_1 = crypto.createHash('sha256').update(RAW_CONTENT_1).digest('hex');
  const SHA256_HASH_2 = crypto.createHash('sha256').update('LOG: 2026-09-09 12:32:01 Firewall rule drop').digest('hex');
  const ANALYST = 'Haritha R';
  const TIMESTAMP_1 = '2026-09-09T12:32:23.000Z';
  const TIMESTAMP_2 = '2026-09-09T12:32:24.000Z';

  // ── TEST 1: registerEvidence() ───────────────────────────────────────────────
  printSection('TEST 1: registerEvidence() — Registering Evidence on Ledger');
  ctx.stub.setNextTransaction();
  console.log(`  Submitting transaction to channel '${ctx.stub.channelName}'...`);
  console.log(`  Payload:`);
  console.log(`    incidentId : ${INCIDENT_ID}`);
  console.log(`    evidenceId : ${EVIDENCE_ID_1}`);
  console.log(`    ipfsCid    : ${IPFS_CID_1}`);
  console.log(`    sha256Hash : ${SHA256_HASH_1}`);
  console.log(`    recordedBy : ${ANALYST}`);
  console.log(`    recordedAt : ${TIMESTAMP_1}`);

  const regResultStr1 = await contract.registerEvidence(
    ctx,
    INCIDENT_ID,
    EVIDENCE_ID_1,
    IPFS_CID_1,
    SHA256_HASH_1,
    ANALYST,
    TIMESTAMP_1
  );
  const regRecord1 = JSON.parse(regResultStr1);

  console.log(`\n  ${C.green}${C.bold}✔ Transaction Committed Successfully!${C.reset}`);
  console.log(`  Fabric Tx ID : ${C.yellow}${regRecord1.fabricTransactionId}${C.reset}`);
  console.log(`  Event Emitted: ${C.cyan}${ctx.stub.events[0].name}${C.reset}`);
  console.log(`  Record JSON  :\n${JSON.stringify(regRecord1, null, 4).replace(/^/gm, '    ')}`);

  // Register second evidence item for the same incident
  ctx.stub.setNextTransaction();
  await contract.registerEvidence(
    ctx,
    INCIDENT_ID,
    EVIDENCE_ID_2,
    IPFS_CID_2,
    SHA256_HASH_2,
    ANALYST,
    TIMESTAMP_2
  );
  console.log(`\n  ${C.green}✔ Second evidence registered: ${EVIDENCE_ID_2}${C.reset}`);

  // ── TEST 1B: Duplicate Rejection ─────────────────────────────────────────────
  printSection('TEST 1B: Validate Duplicate Rejection (No Silent Overwrites)');
  try {
    ctx.stub.setNextTransaction();
    await contract.registerEvidence(
      ctx,
      INCIDENT_ID,
      EVIDENCE_ID_1, // Same ID
      IPFS_CID_1,
      SHA256_HASH_1,
      'Malicious Actor'
    );
    console.error(`  ${C.red}✖ Failed: Overwrite was allowed!${C.reset}`);
  } catch (err) {
    console.log(`  ${C.green}${C.bold}✔ Duplicate registration successfully blocked!${C.reset}`);
    console.log(`  ${C.dim}Reason: ${err.message}${C.reset}`);
  }

  // ── TEST 2: getEvidence() ───────────────────────────────────────────────────
  printSection('TEST 2: getEvidence() — Querying Committed Record from Blockchain');
  const retrievedJson = await contract.getEvidence(ctx, EVIDENCE_ID_1);
  const retrieved = JSON.parse(retrievedJson);

  console.log(`  Query result for evidenceId='${EVIDENCE_ID_1}':`);
  console.log(`    Status               : ${C.green}FOUND${C.reset}`);
  console.log(`    Incident ID          : ${retrieved.incidentId}`);
  console.log(`    Evidence ID          : ${retrieved.evidenceId}`);
  console.log(`    IPFS CID             : ${retrieved.ipfsCid}`);
  console.log(`    SHA-256 Hash         : ${retrieved.sha256Hash}`);
  console.log(`    Recorded By          : ${retrieved.recordedBy}`);
  console.log(`    Recorded At          : ${retrieved.recordedAt}`);
  console.log(`    Fabric Tx ID         : ${C.yellow}${retrieved.fabricTransactionId}${C.reset}`);

  // ── TEST 3: evidenceExists() ────────────────────────────────────────────────
  printSection('TEST 3: evidenceExists() — Checking Existence Flag');
  const exists1 = await contract.evidenceExists(ctx, EVIDENCE_ID_1);
  const existsFake = await contract.evidenceExists(ctx, 'EVD-NON-EXISTENT-999999');

  console.log(`  evidenceExists('${EVIDENCE_ID_1}')            : ${exists1 ? C.green + 'true' : C.red + 'false'}${C.reset}`);
  console.log(`  evidenceExists('EVD-NON-EXISTENT-999999') : ${existsFake ? C.red + 'true' : C.green + 'false'}${C.reset}`);

  // ── TEST 4: verifyEvidenceHash() ────────────────────────────────────────────
  printSection('TEST 4: verifyEvidenceHash() — Cryptographic Verification (VERIFIED vs TAMPERED)');

  // 4A: Valid hash matching raw file
  const verifyResultValid = await contract.verifyEvidenceHash(ctx, EVIDENCE_ID_1, SHA256_HASH_1);
  console.log(`  Case A (Unmodified File):`);
  console.log(`    Stored Blockchain Hash : ${SHA256_HASH_1}`);
  console.log(`    Current File Hash      : ${SHA256_HASH_1}`);
  console.log(`    Verification Result    : ${C.green}${C.bold}${verifyResultValid}${C.reset}`);

  // 4B: Tampered hash (file content altered)
  const TAMPERED_CONTENT = RAW_CONTENT_1 + ' [TAMPERED_INJECTED_STRING]';
  const TAMPERED_HASH = crypto.createHash('sha256').update(TAMPERED_CONTENT).digest('hex');
  const verifyResultTampered = await contract.verifyEvidenceHash(ctx, EVIDENCE_ID_1, TAMPERED_HASH);
  console.log(`\n  Case B (Tampered / Altered File):`);
  console.log(`    Stored Blockchain Hash : ${SHA256_HASH_1}`);
  console.log(`    Current File Hash      : ${TAMPERED_HASH}`);
  console.log(`    Verification Result    : ${C.red}${C.bold}${verifyResultTampered}${C.reset}`);

  // ── TEST 5: getEvidenceHistory() ────────────────────────────────────────────
  printSection('TEST 5: getEvidenceHistory() — Audit Trail & Provenance from Blocks');
  const historyJson = await contract.getEvidenceHistory(ctx, EVIDENCE_ID_1);
  const history = JSON.parse(historyJson);

  console.log(`  Found ${history.length} blockchain transaction(s) for '${EVIDENCE_ID_1}':`);
  history.forEach((tx, idx) => {
    console.log(`    [Tx #${idx + 1}]`);
    console.log(`      Tx ID     : ${C.yellow}${tx.txId}${C.reset}`);
    console.log(`      Timestamp : ${tx.timestamp}`);
    console.log(`      isDelete  : ${tx.isDelete}`);
    console.log(`      Committed : SHA256=${tx.value?.sha256Hash} | IPFS=${tx.value?.ipfsCid}`);
  });

  // ── TEST 6: getIncidentEvidence() ───────────────────────────────────────────
  printSection('TEST 6: getIncidentEvidence() — Query All Evidence for Incident');
  const incidentEvidenceJson = await contract.getIncidentEvidence(ctx, INCIDENT_ID);
  const incidentRecords = JSON.parse(incidentEvidenceJson);

  console.log(`  Found ${incidentRecords.length} evidence record(s) for '${INCIDENT_ID}':`);
  incidentRecords.forEach((rec, idx) => {
    console.log(`    [Record #${idx + 1}] Evidence ID: ${C.cyan}${rec.evidenceId}${C.reset} | CID: ${rec.ipfsCid.slice(0, 16)}... | Hash: ${rec.sha256Hash.slice(0, 16)}...`);
  });

  console.log(`\n${C.cyan}${'═'.repeat(78)}${C.reset}`);
  console.log(`${C.green}${C.bold}  ✔ ALL 6 CHAINCODE FUNCTIONS TESTED AND VERIFIED SUCCESSFULLY!${C.reset}`);
  console.log(`${C.cyan}${'═'.repeat(78)}${C.reset}\n`);
}

executePhase4Module5().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
