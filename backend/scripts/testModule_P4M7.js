'use strict';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  testModule_P4M7.js — Phase 4 Module 7: Register Evidence on Hyperledger Fabric
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Verifies the complete Module 7 specification:
 *   1. Workflow Execution:
 *      Evidence Upload ──▶ SHA-256 ──▶ Pinata IPFS ──▶ CID ──▶ Fabric Submit ──▶ Mongo Commit
 *   2. Evidence Model Fields:
 *      - blockchainStatus (NOT_REGISTERED, REGISTERING, REGISTERED, FAILED)
 *      - fabricTransactionId
 *      - fabricRecordedAt
 *   3. Registration Guards:
 *      - Reject if SHA-256 failed or missing
 *      - Reject if Pinata upload failed or missing
 *      - Reject if Incident does not exist
 *      - Reject if Incident is archived
 *      - Prevent duplicate registration if already registered
 *   4. Chaincode Invocation:
 *      registerEvidence(incidentId, evidenceId, ipfsCid, sha256Hash, recordedBy, recordedAt)
 *   5. Incident Activity History:
 *      Action: EVIDENCE_REGISTERED_ON_BLOCKCHAIN
 *      Description: "Evidence EVD-... was registered on Hyperledger Fabric."
 *   6. Immutability Guards:
 *      - Modifying sha256Hash after registration throws error
 *      - Modifying ipfsCid after registration throws error
 *      - Modifying fabricTransactionId after registration throws error
 *      - Deleting registered evidence throws 403 error
 *   7. HTTP API Handlers:
 *      - POST /api/evidence/:evidenceId/register-blockchain
 *      - GET  /api/evidence/:evidenceId/blockchain-record
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const assert = require('assert');
const crypto = require('crypto');
const mongoose = require('mongoose');

const User = require('../models/User');
const Incident = require('../models/Incident');
const Evidence = require('../models/Evidence');
const evidenceService = require('../services/evidenceService');
const fabricService = require('../services/fabricService');
const pinataService = require('../services/pinataService');

let passedTests = 0;
let totalTests = 0;

function reportTest(name, passed, detail = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  ✔ [PASS] ${name}`);
  } else {
    console.error(`  ✖ [FAIL] ${name} ${detail ? `(${detail})` : ''}`);
  }
}

async function runModule7TestSuite() {
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('  🔗 TESTING PHASE 4 MODULE 7: HYPERLEDGER FABRIC EVIDENCE REGISTRATION');
  console.log('════════════════════════════════════════════════════════════════════\n');

  // Connect to MongoDB
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is missing in backend/.env');
  }
  await mongoose.connect(mongoUri);
  console.log('✔ Connected to MongoDB successfully.\n');

  try {
    // 0. Setup test user
    let testUser = await User.findOne({ email: 'module7_analyst@incidentledger.com' });
    if (!testUser) {
      testUser = await User.create({
        name: 'Analyst Haritha',
        email: 'module7_analyst@incidentledger.com',
        password: 'Password123!',
        role: 'Analyst',
      });
    }

    // Setup active test incident
    const testIncidentId = `INC-${Date.now()}`;
    const testIncident = await Incident.create({
      incidentId: testIncidentId,
      securityLogId: new mongoose.Types.ObjectId(),
      timestamp: new Date(),
      attackType: 'SQL_INJECTION',
      title: 'Phase 4 Module 7 Automated Ledger Test Incident',
      description: 'Test incident for verifying Hyperledger Fabric evidence registration',
      severity: 'HIGH',
      status: 'INVESTIGATING',
      reportedBy: testUser._id,
      assignedTo: testUser._id,
      activityHistory: [],
    });

    console.log(`Test Incident created: ${testIncident.incidentId} (_id: ${testIncident._id})\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: End-to-End Upload, Hash, Pinata CID, and Fabric Registration Workflow
    // ─────────────────────────────────────────────────────────────────────────
    console.log('▶ TEST 1: Complete Pipeline Workflow & Status Verification');
    const rawFileBytes = Buffer.from(
      `[SECURITY LOG FILE] Incident: ${testIncident.incidentId} Generated: ${new Date().toISOString()}\n` +
      `Payload: Unauthorized SQL injection attack vector blocked at WAF gateway.\n` +
      `Hash Entropy: ${crypto.randomBytes(32).toString('hex')}\n`
    );

    const createdEvidence = await evidenceService.collectEvidence({
      incidentMongoId: testIncident._id,
      fileBuffer: rawFileBytes,
      originalName: 'sql_injection_audit.log',
      mimeType: 'text/plain',
      description: 'Raw web application firewall audit log file',
      collectedByUserId: testUser._id,
      collectedByName: testUser.name,
    });

    reportTest('Evidence document created with unique evidenceId', Boolean(createdEvidence.evidenceId && createdEvidence.evidenceId.startsWith('EVD-')));
    reportTest('SHA-256 computed and hashStatus is GENERATED', createdEvidence.hashStatus === 'GENERATED' && Boolean(createdEvidence.sha256Hash));
    reportTest('IPFS upload completed and CID populated', Boolean(createdEvidence.ipfsCid));
    reportTest('Blockchain status is REGISTERED', createdEvidence.blockchainStatus === 'REGISTERED');
    reportTest('fabricTransactionId is populated', Boolean(createdEvidence.fabricTransactionId && createdEvidence.fabricTransactionId.startsWith('0x')));
    reportTest('fabricRecordedAt timestamp is populated', Boolean(createdEvidence.fabricRecordedAt));

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Incident Activity History Verification
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 2: Incident Activity Log Verification');
    const updatedIncident = await Incident.findById(testIncident._id);
    const fabricActivity = updatedIncident.activityHistory.find(a => a.action === 'EVIDENCE_REGISTERED_ON_BLOCKCHAIN');

    reportTest('Activity action is EVIDENCE_REGISTERED_ON_BLOCKCHAIN', Boolean(fabricActivity));
    const expectedDescRegex = new RegExp(`Evidence ${createdEvidence.evidenceId} was registered on Hyperledger Fabric.`);
    reportTest('Activity description matches exact format ("Evidence EVD-... was registered on Hyperledger Fabric.")',
      Boolean(fabricActivity && expectedDescRegex.test(fabricActivity.description))
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Guard Check: Already Registered Rejection / Idempotency
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 3: Registration Guard — Evidence Already Registered');
    const duplicateAttempt = await evidenceService.registerEvidenceOnFabric(createdEvidence.evidenceId, testUser.name);
    reportTest('Already registered evidence returns existing record without duplicate block commit',
      duplicateAttempt.fabricTransactionId === createdEvidence.fabricTransactionId
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Guard Check: Reject if Incident Does Not Exist
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 4: Registration Guard — Missing Incident');
    const orphanEvidence = new Evidence({
      evidenceId: `EVD-ORPHAN-${Date.now()}`,
      incidentId: new mongoose.Types.ObjectId(), // non-existent incident
      fileName: 'orphan.log',
      originalFileName: 'orphan.log',
      mimeType: 'text/plain',
      fileSize: 100,
      collectedBy: testUser._id,
      hashStatus: 'GENERATED',
      sha256Hash: crypto.createHash('sha256').update('orphan').digest('hex'),
      storageStatus: 'UPLOADED',
      ipfsCid: 'bafkreiorphan1234567890',
    });
    await orphanEvidence.save();

    let orphanRejected = false;
    try {
      await evidenceService.registerEvidenceOnFabric(orphanEvidence.evidenceId, testUser.name);
    } catch (e) {
      orphanRejected = true;
    }
    reportTest('Registration rejected when associated incident does not exist', orphanRejected);
    await Evidence.deleteOne({ _id: orphanEvidence._id });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: Guard Check: Reject if Incident is Archived
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 5: Registration Guard — Archived Incident');
    const archivedIncident = await Incident.create({
      incidentId: `INC-ARCHIVED-${Date.now()}`,
      securityLogId: new mongoose.Types.ObjectId(),
      timestamp: new Date(),
      attackType: 'BRUTE_FORCE',
      title: 'Archived Incident For Guard Testing',
      description: 'Incident in ARCHIVED read-only state',
      severity: 'MEDIUM',
      status: 'ARCHIVED',
      reportedBy: testUser._id,
      assignedTo: testUser._id,
      activityHistory: [],
    });

    const archivedEvidence = new Evidence({
      evidenceId: `EVD-ARCHIVED-${Date.now()}`,
      incidentId: archivedIncident._id,
      fileName: 'archived_test.log',
      originalFileName: 'archived_test.log',
      mimeType: 'text/plain',
      fileSize: 120,
      collectedBy: testUser._id,
      hashStatus: 'GENERATED',
      sha256Hash: crypto.createHash('sha256').update('archived').digest('hex'),
      storageStatus: 'UPLOADED',
      ipfsCid: 'bafkreiarchived1234567890',
    });
    await archivedEvidence.save();

    let archivedRejected = false;
    try {
      await evidenceService.registerEvidenceOnFabric(archivedEvidence.evidenceId, testUser.name);
    } catch (e) {
      archivedRejected = true;
    }
    reportTest('Registration rejected when incident status is ARCHIVED', archivedRejected);
    await Evidence.deleteOne({ _id: archivedEvidence._id });
    await Incident.deleteOne({ _id: archivedIncident._id });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: Guard Check: Reject if SHA-256 Failed or Missing
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 6: Registration Guard — SHA-256 Failed / Missing');
    const failedHashEvidence = new Evidence({
      evidenceId: `EVD-NOHASH-${Date.now()}`,
      incidentId: testIncident._id,
      fileName: 'nohash.log',
      originalFileName: 'nohash.log',
      mimeType: 'text/plain',
      fileSize: 80,
      collectedBy: testUser._id,
      hashStatus: 'FAILED',
      sha256Hash: null,
      storageStatus: 'UPLOADED',
      ipfsCid: 'bafkreinohash1234567890',
    });
    await failedHashEvidence.save();

    let noHashRejected = false;
    try {
      await evidenceService.registerEvidenceOnFabric(failedHashEvidence.evidenceId, testUser.name);
    } catch (e) {
      noHashRejected = true;
    }
    reportTest('Registration rejected when SHA-256 hashStatus !== GENERATED', noHashRejected);
    await Evidence.deleteOne({ _id: failedHashEvidence._id });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: Guard Check: Reject if Pinata / IPFS Upload Failed or Missing
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 7: Registration Guard — Pinata / IPFS Failed');
    const failedIpfsEvidence = new Evidence({
      evidenceId: `EVD-NOIPFS-${Date.now()}`,
      incidentId: testIncident._id,
      fileName: 'noipfs.log',
      originalFileName: 'noipfs.log',
      mimeType: 'text/plain',
      fileSize: 80,
      collectedBy: testUser._id,
      hashStatus: 'GENERATED',
      sha256Hash: crypto.createHash('sha256').update('noipfs').digest('hex'),
      storageStatus: 'FAILED',
      ipfsCid: null,
    });
    await failedIpfsEvidence.save();

    let noIpfsRejected = false;
    try {
      await evidenceService.registerEvidenceOnFabric(failedIpfsEvidence.evidenceId, testUser.name);
    } catch (e) {
      noIpfsRejected = true;
    }
    reportTest('Registration rejected when IPFS upload failed or CID is null', noIpfsRejected);
    await Evidence.deleteOne({ _id: failedIpfsEvidence._id });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8: Immutability Guard: Reject Modifications to Registered Evidence
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 8: Immutability Guard — Alteration Rejection');
    const registeredDoc = await Evidence.findOne({ evidenceId: createdEvidence.evidenceId });

    let hashChangeRejected = false;
    try {
      registeredDoc.sha256Hash = crypto.createHash('sha256').update('tampered').digest('hex');
      await registeredDoc.save();
    } catch (err) {
      hashChangeRejected = true;
    }
    reportTest('Modifying sha256Hash on registered evidence throws immutability error', hashChangeRejected);

    let cidChangeRejected = false;
    try {
      registeredDoc.ipfsCid = 'bafkreialteredcid1234567890';
      await registeredDoc.save();
    } catch (err) {
      cidChangeRejected = true;
    }
    reportTest('Modifying ipfsCid on registered evidence throws immutability error', cidChangeRejected);

    let txChangeRejected = false;
    try {
      registeredDoc.fabricTransactionId = '0xalteredtxid1234567890';
      await registeredDoc.save();
    } catch (err) {
      txChangeRejected = true;
    }
    reportTest('Modifying fabricTransactionId on registered evidence throws immutability error', txChangeRejected);

    let deleteRejected = false;
    try {
      await evidenceService.deleteEvidence(createdEvidence.evidenceId, testUser.name);
    } catch (err) {
      deleteRejected = true;
    }
    reportTest('Deleting registered evidence throws 403 immutability error', deleteRejected);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 9: Query Live Record & History from Hyperledger Fabric
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 9: Fabric Ledger Query & Verification');
    const ledgerRecord = await fabricService.getEvidenceFromBlockchain(createdEvidence.evidenceId);
    reportTest('Ledger query returns committed evidence record', Boolean(ledgerRecord && ledgerRecord.evidenceId === createdEvidence.evidenceId));
    reportTest('Ledger record SHA-256 matches MongoDB record', ledgerRecord.sha256Hash === createdEvidence.sha256Hash);
    reportTest('Ledger record IPFS CID matches MongoDB record', ledgerRecord.ipfsCid === createdEvidence.ipfsCid);

    const auditHistory = await fabricService.getEvidenceHistoryFromBlockchain(createdEvidence.evidenceId);
    reportTest('Ledger audit history contains at least 1 committed block transaction', Array.isArray(auditHistory) && auditHistory.length >= 1);

    const integrityVerification = await fabricService.verifyEvidenceOnBlockchain(createdEvidence.evidenceId, createdEvidence.sha256Hash);
    reportTest('On-chain cryptographic integrity returns VERIFIED', integrityVerification === 'VERIFIED');

    // Clean up test incident and evidence
    await Evidence.deleteOne({ _id: createdEvidence._id });
    await Incident.deleteOne({ _id: testIncident._id });

    console.log('\n════════════════════════════════════════════════════════════════════');
    console.log(`  ✔ MODULE 7 TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
    console.log('════════════════════════════════════════════════════════════════════\n');

    if (passedTests !== totalTests) {
      throw new Error(`Only ${passedTests}/${totalTests} tests passed!`);
    }
  } finally {
    await mongoose.disconnect();
    await fabricService.disconnect();
  }
}

runModule7TestSuite().catch(err => {
  console.error('\n✖ Module 7 test suite failed:', err);
  process.exit(1);
});
