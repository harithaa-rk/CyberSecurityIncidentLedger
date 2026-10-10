/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const assert = require('assert');
const IncidentLedger = require('../lib/incidentLedger');

// ─────────────────────────────────────────────────────────────────────────────
// Mock Fabric Chaincode Stub & Context for Unit & Integration Testing
// ─────────────────────────────────────────────────────────────────────────────
class MockHistoryIterator {
  constructor(historyList) {
    this.historyList = historyList || [];
    this.index = 0;
  }

  async next() {
    if (this.index < this.historyList.length) {
      const val = this.historyList[this.index++];
      return { value: val, done: false };
    }
    return { value: null, done: true };
  }

  async close() {}
}

class MockStateIterator {
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

class MockChaincodeStub {
  constructor() {
    this.state = new Map();
    this.history = new Map();
    this.events = [];
    this.currentTxId = 'tx_' + Math.random().toString(36).substring(2, 12);
    this.txTimestampSeconds = Math.floor(Date.now() / 1000);
  }

  getTxID() {
    return this.currentTxId;
  }

  getTxTimestamp() {
    return {
      seconds: { low: this.txTimestampSeconds, high: 0 },
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
      txId: this.currentTxId,
      timestamp: { seconds: { low: this.txTimestampSeconds } },
      isDelete: false,
      value: buffer,
    });
  }

  async getHistoryForKey(key) {
    const list = this.history.get(key) || [];
    return new MockHistoryIterator(list);
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
    return new MockStateIterator(records);
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
    return new MockStateIterator(matched);
  }

  setEvent(name, payload) {
    this.events.push({ name, payload: JSON.parse(payload.toString('utf8')) });
  }
}

class MockContext {
  constructor() {
    this.stub = new MockChaincodeStub();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('  🧪 HYPERLEDGER FABRIC CHAINCODE TEST SUITE (PHASE 4 MODULE 5)     ');
  console.log('  Contract: IncidentLedger                                         ');
  console.log('  Channel:  incidentchannel                                        ');
  console.log('════════════════════════════════════════════════════════════════════\n');

  const contract = new IncidentLedger();
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  \x1b[32m✔\x1b[0m ${name}`);
      passed++;
    } catch (err) {
      console.error(`  \x1b[31m✖\x1b[0m ${name}`);
      console.error(`    \x1b[31mError: ${err.message}\x1b[0m`);
      failed++;
    }
  }

  const sampleIncidentId = 'INC-20260909-224500';
  const sampleEvidenceId = 'EVD-20260909-227152';
  const sampleCid        = 'bafkreid5z264h7h63xuvv6ox2s5cwt5v5r5y4f3vve7eb56s6d4rz4zbu';
  const sampleSha256     = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const sampleUser       = 'Haritha R';

  // ── TEST GROUP 1: registerEvidence() ─────────────────────────────────────────
  console.log('\x1b[36m[GROUP 1] registerEvidence() Tests\x1b[0m');

  await test('1.1 Should successfully register valid evidence on the ledger', async () => {
    const ctx = new MockContext();
    ctx.stub.currentTxId = 'tx_evidence_001_abc';
    const resultStr = await contract.registerEvidence(
      ctx,
      sampleIncidentId,
      sampleEvidenceId,
      sampleCid,
      sampleSha256,
      sampleUser,
      '2026-09-09T12:32:23.000Z'
    );

    const record = JSON.parse(resultStr);
    assert.strictEqual(record.incidentId, sampleIncidentId);
    assert.strictEqual(record.evidenceId, sampleEvidenceId);
    assert.strictEqual(record.ipfsCid, sampleCid);
    assert.strictEqual(record.sha256Hash, sampleSha256.toLowerCase());
    assert.strictEqual(record.recordedBy, sampleUser);
    assert.strictEqual(record.fabricTransactionId, 'tx_evidence_001_abc');
    assert.strictEqual(record.recordedAt, '2026-09-09T12:32:23.000Z');

    // Verify state was saved
    const stored = await ctx.stub.getState(sampleEvidenceId);
    assert(stored && stored.length > 0);

    // Verify event was emitted
    assert.strictEqual(ctx.stub.events.length, 1);
    assert.strictEqual(ctx.stub.events[0].name, 'EvidenceRegistered');
    assert.strictEqual(ctx.stub.events[0].payload.evidenceId, sampleEvidenceId);
  });

  await test('1.2 Should reject duplicate evidenceId to prevent overwriting blockchain state', async () => {
    const ctx = new MockContext();
    await contract.registerEvidence(ctx, sampleIncidentId, sampleEvidenceId, sampleCid, sampleSha256, sampleUser);

    // Second registration must fail
    await assert.rejects(
      async () => {
        await contract.registerEvidence(ctx, sampleIncidentId, sampleEvidenceId, sampleCid, sampleSha256, 'Another User');
      },
      /already exists on the ledger/
    );
  });

  await test('1.3 Should validate required parameters (incidentId, evidenceId, ipfsCid, sha256Hash)', async () => {
    const ctx = new MockContext();
    await assert.rejects(async () => contract.registerEvidence(ctx, '', 'EVD-1', sampleCid, sampleSha256), /incidentId is required/);
    await assert.rejects(async () => contract.registerEvidence(ctx, sampleIncidentId, '', sampleCid, sampleSha256), /evidenceId is required/);
    await assert.rejects(async () => contract.registerEvidence(ctx, sampleIncidentId, 'EVD-1', '', sampleSha256), /ipfsCid is required/);
    await assert.rejects(async () => contract.registerEvidence(ctx, sampleIncidentId, 'EVD-1', sampleCid, ''), /sha256Hash is required/);
  });

  await test('1.4 Should validate SHA-256 format strictly (must be 64-char hex)', async () => {
    const ctx = new MockContext();
    // Too short
    await assert.rejects(async () => contract.registerEvidence(ctx, sampleIncidentId, 'EVD-1', sampleCid, 'abc12345'), /Invalid sha256Hash format/);
    // Invalid characters (not hex)
    const invalidHex = 'g'.repeat(64);
    await assert.rejects(async () => contract.registerEvidence(ctx, sampleIncidentId, 'EVD-1', sampleCid, invalidHex), /Invalid sha256Hash format/);
  });

  // ── TEST GROUP 2: getEvidence() & evidenceExists() ───────────────────────────
  console.log('\n\x1b[36m[GROUP 2] getEvidence() & evidenceExists() Tests\x1b[0m');

  await test('2.1 evidenceExists() should accurately report existence', async () => {
    const ctx = new MockContext();
    assert.strictEqual(await contract.evidenceExists(ctx, sampleEvidenceId), false);
    await contract.registerEvidence(ctx, sampleIncidentId, sampleEvidenceId, sampleCid, sampleSha256, sampleUser);
    assert.strictEqual(await contract.evidenceExists(ctx, sampleEvidenceId), true);
  });

  await test('2.2 getEvidence() should return exact ledger record for valid evidenceId', async () => {
    const ctx = new MockContext();
    await contract.registerEvidence(ctx, sampleIncidentId, sampleEvidenceId, sampleCid, sampleSha256, sampleUser);
    const resultJson = await contract.getEvidence(ctx, sampleEvidenceId);
    const parsed = JSON.parse(resultJson);
    assert.strictEqual(parsed.evidenceId, sampleEvidenceId);
    assert.strictEqual(parsed.sha256Hash, sampleSha256.toLowerCase());
  });

  await test('2.3 getEvidence() should throw error if evidence does not exist', async () => {
    const ctx = new MockContext();
    await assert.rejects(
      async () => contract.getEvidence(ctx, 'NONEXISTENT-EVIDENCE-ID'),
      /does not exist on the ledger/
    );
  });

  // ── TEST GROUP 3: verifyEvidenceHash() ───────────────────────────────────────
  console.log('\n\x1b[36m[GROUP 3] verifyEvidenceHash() Tests\x1b[0m');

  await test('3.1 Should return "VERIFIED" when current hash matches stored blockchain hash', async () => {
    const ctx = new MockContext();
    await contract.registerEvidence(ctx, sampleIncidentId, sampleEvidenceId, sampleCid, sampleSha256, sampleUser);

    const status = await contract.verifyEvidenceHash(ctx, sampleEvidenceId, sampleSha256);
    assert.strictEqual(status, 'VERIFIED');
  });

  await test('3.2 Should return "TAMPERED" when current hash does not match stored blockchain hash', async () => {
    const ctx = new MockContext();
    await contract.registerEvidence(ctx, sampleIncidentId, sampleEvidenceId, sampleCid, sampleSha256, sampleUser);

    const tamperedHash = 'f'.repeat(64);
    const status = await contract.verifyEvidenceHash(ctx, sampleEvidenceId, tamperedHash);
    assert.strictEqual(status, 'TAMPERED');
  });

  // ── TEST GROUP 4: getEvidenceHistory() ───────────────────────────────────────
  console.log('\n\x1b[36m[GROUP 4] getEvidenceHistory() Tests\x1b[0m');

  await test('4.1 getEvidenceHistory() should return chronological blockchain transaction list', async () => {
    const ctx = new MockContext();
    ctx.stub.currentTxId = 'tx_genesis_evidence_1';
    await contract.registerEvidence(ctx, sampleIncidentId, sampleEvidenceId, sampleCid, sampleSha256, sampleUser);

    const historyJson = await contract.getEvidenceHistory(ctx, sampleEvidenceId);
    const history = JSON.parse(historyJson);
    assert(Array.isArray(history));
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].txId, 'tx_genesis_evidence_1');
    assert.strictEqual(history[0].value.evidenceId, sampleEvidenceId);
    assert.strictEqual(history[0].isDelete, false);
  });

  // ── TEST GROUP 5: getIncidentEvidence() ─────────────────────────────────────
  console.log('\n\x1b[36m[GROUP 5] getIncidentEvidence() Tests\x1b[0m');

  await test('5.1 getIncidentEvidence() should return all evidence for an incident', async () => {
    const ctx = new MockContext();
    const ev1 = 'EVD-20260909-000001';
    const ev2 = 'EVD-20260909-000002';
    const evOther = 'EVD-20260909-000003';

    await contract.registerEvidence(ctx, sampleIncidentId, ev1, sampleCid, sampleSha256, sampleUser);
    await contract.registerEvidence(ctx, sampleIncidentId, ev2, sampleCid, sampleSha256, sampleUser);
    await contract.registerEvidence(ctx, 'INC-ANOTHER-999999', evOther, sampleCid, sampleSha256, sampleUser);

    const resultJson = await contract.getIncidentEvidence(ctx, sampleIncidentId);
    const records = JSON.parse(resultJson);
    assert.strictEqual(records.length, 2);
    const ids = records.map(r => r.evidenceId);
    assert(ids.includes(ev1));
    assert(ids.includes(ev2));
    assert(!ids.includes(evOther));
  });

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log(`  RESULT: Passed ${passed} / ${passed + failed} Tests`);
  console.log('════════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
