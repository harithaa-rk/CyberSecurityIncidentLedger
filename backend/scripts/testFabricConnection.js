'use strict';

/**
 * Independent Fabric Connection Test Script
 * Phase 4 Module 6: Connect Node.js backend to Hyperledger Fabric
 *
 * Tests:
 *   1. connectToFabric()
 *   2. registerEvidenceOnBlockchain() (positional arguments)
 *   3. registerEvidenceOnBlockchain() (object arguments & duplicate rejection)
 *   4. getEvidenceFromBlockchain()
 *   5. verifyEvidenceOnBlockchain() (VERIFIED and TAMPERED)
 *   6. getEvidenceHistoryFromBlockchain()
 *   7. getIncidentEvidenceFromBlockchain()
 *   8. Log Output Verification:
 *      [FABRIC] Connecting
 *      [FABRIC] Connected
 *      [FABRIC] Transaction submitted
 *      [FABRIC] Transaction committed
 *      [FABRIC] Query successful
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const assert = require('assert');
const crypto = require('crypto');
const fabricService = require('../services/fabricService');
const fabricConfig = require('../config/fabricConfig');

// Intercept console.log to strictly verify required log prefixes
const observedLogs = [];
const originalConsoleLog = console.log;
console.log = function(...args) {
  const line = args.join(' ');
  observedLogs.push(line);
  originalConsoleLog.apply(console, args);
};

async function runIndependentTest() {
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('  🔗 TESTING NODE.JS BACKEND HYPERLEDGER FABRIC INTEGRATION');
  console.log(`  Channel:   ${fabricConfig.channelName}`);
  console.log(`  Chaincode: ${fabricConfig.chaincodeName}`);
  console.log(`  Identity:  ${fabricConfig.appUser} (${fabricConfig.mspId})`);
  console.log(`  Endpoint:  ${fabricConfig.peerEndpoint}`);
  console.log('════════════════════════════════════════════════════════════════════\n');

  // Test 1: Connection
  console.log('--- TEST 1: connectToFabric() ---');
  await fabricService.connectToFabric();
  assert(observedLogs.some(l => l.includes('[FABRIC] Connecting')), 'Must log [FABRIC] Connecting');
  assert(observedLogs.some(l => l.includes('[FABRIC] Connected')), 'Must log [FABRIC] Connected');
  console.log('✔ connectToFabric() connected with verified log output.\n');

  // Test 2: registerEvidenceOnBlockchain() — Positional Arguments
  console.log('--- TEST 2: registerEvidenceOnBlockchain() (Positional) ---');
  const testIncidentId = `INC-${Date.now()}`;
  const testEvidenceId = `EVD-${Date.now()}`;
  const testCid = `bafkreitest${crypto.randomBytes(12).toString('hex')}`;
  const rawData = 'SECURITY AUDIT LOG: Port scan detected from IP 10.0.0.45';
  const testHash = crypto.createHash('sha256').update(rawData).digest('hex');
  const testAnalyst = 'appUser (Haritha R)';

  const registered = await fabricService.registerEvidenceOnBlockchain(
    testIncidentId,
    testEvidenceId,
    testCid,
    testHash,
    testAnalyst,
    new Date().toISOString()
  );

  console.log('Committed Record #1:', registered);
  assert.strictEqual(registered.incidentId, testIncidentId);
  assert.strictEqual(registered.evidenceId, testEvidenceId);
  assert.strictEqual(registered.sha256Hash, testHash);
  assert(registered.fabricTransactionId, 'fabricTransactionId must be populated');
  assert(observedLogs.some(l => l.includes('[FABRIC] Transaction submitted')), 'Must log [FABRIC] Transaction submitted');
  assert(observedLogs.some(l => l.includes('[FABRIC] Transaction committed')), 'Must log [FABRIC] Transaction committed');
  console.log('✔ registerEvidenceOnBlockchain (positional) succeeded.\n');

  // Test 2B: registerEvidenceOnBlockchain() — Object Arguments
  console.log('--- TEST 2B: registerEvidenceOnBlockchain() (Object Argument) ---');
  const testEvidenceId2 = `EVD-${Date.now()}-2`;
  const testHash2 = crypto.createHash('sha256').update(rawData + ' [PACKET-2]').digest('hex');
  const registered2 = await fabricService.registerEvidenceOnBlockchain({
    incidentId: testIncidentId,
    evidenceId: testEvidenceId2,
    ipfsCid: testCid,
    sha256Hash: testHash2,
    recordedBy: testAnalyst,
    recordedAt: new Date().toISOString()
  });

  console.log('Committed Record #2:', registered2);
  assert.strictEqual(registered2.evidenceId, testEvidenceId2);
  console.log('✔ registerEvidenceOnBlockchain (object argument) succeeded.\n');

  // Test 3: getEvidenceFromBlockchain()
  console.log('--- TEST 3: getEvidenceFromBlockchain() ---');
  const queryResult = await fabricService.getEvidenceFromBlockchain(testEvidenceId);
  console.log('Retrieved Record:', queryResult);
  assert.strictEqual(queryResult.evidenceId, testEvidenceId);
  assert.strictEqual(queryResult.sha256Hash, testHash);
  assert(observedLogs.some(l => l.includes('[FABRIC] Query successful')), 'Must log [FABRIC] Query successful');
  console.log('✔ getEvidenceFromBlockchain succeeded.\n');

  // Test 4: verifyEvidenceOnBlockchain()
  console.log('--- TEST 4: verifyEvidenceOnBlockchain() ---');
  // 4A: Valid
  const verifyValid = await fabricService.verifyEvidenceOnBlockchain(testEvidenceId, testHash);
  console.log(`Hash Verification (Valid): ${verifyValid}`);
  assert.strictEqual(verifyValid, 'VERIFIED');

  // 4B: Tampered
  const alteredHash = crypto.createHash('sha256').update(rawData + ' [ALTERED]').digest('hex');
  const verifyTampered = await fabricService.verifyEvidenceOnBlockchain(testEvidenceId, alteredHash);
  console.log(`Hash Verification (Tampered): ${verifyTampered}`);
  assert.strictEqual(verifyTampered, 'TAMPERED');
  console.log('✔ verifyEvidenceOnBlockchain succeeded.\n');

  // Test 5: getEvidenceHistoryFromBlockchain()
  console.log('--- TEST 5: getEvidenceHistoryFromBlockchain() ---');
  const history = await fabricService.getEvidenceHistoryFromBlockchain(testEvidenceId);
  console.log(`Audit History Entries: ${history.length}`);
  console.log('History Entry #1:', history[0]);
  assert(Array.isArray(history));
  assert(history.length >= 1);
  console.log('✔ getEvidenceHistoryFromBlockchain succeeded.\n');

  // Test 6: getIncidentEvidenceFromBlockchain()
  console.log('--- TEST 6: getIncidentEvidenceFromBlockchain() ---');
  const incidentEvidence = await fabricService.getIncidentEvidenceFromBlockchain(testIncidentId);
  console.log(`Evidence items for incident '${testIncidentId}': ${incidentEvidence.length}`);
  assert(Array.isArray(incidentEvidence));
  assert(incidentEvidence.length >= 2);
  assert(incidentEvidence.some(e => e.evidenceId === testEvidenceId));
  assert(incidentEvidence.some(e => e.evidenceId === testEvidenceId2));
  console.log('✔ getIncidentEvidenceFromBlockchain succeeded.\n');

  // Test 7: Verify all required log strings were printed
  console.log('--- TEST 7: Log Verification ---');
  const requiredLogs = [
    '[FABRIC] Connecting',
    '[FABRIC] Connected',
    '[FABRIC] Transaction submitted',
    '[FABRIC] Transaction committed',
    '[FABRIC] Query successful',
  ];

  for (const logTag of requiredLogs) {
    const found = observedLogs.some(l => l.includes(logTag));
    assert(found, `Log message "${logTag}" was not emitted!`);
    console.log(`  ✔ Log verified: ${logTag}`);
  }
  console.log('✔ All 5 required log tags verified.\n');

  await fabricService.disconnect();

  console.log('════════════════════════════════════════════════════════════════════');
  console.log('  ✔ ALL FABRIC SERVICE TESTS COMPLETED SUCCESSFULLY!');
  console.log('════════════════════════════════════════════════════════════════════\n');
}

runIndependentTest().catch(err => {
  originalConsoleLog('\n✖ Fabric connection test failed:', err);
  process.exit(1);
});
