/**
 * testModule_P4M8.js — Phase 4 Module 8: Hyperledger Fabric Evidence Integrity Verification
 *
 * Automated verification suite:
 *  1. Complete Verification Flow (VERIFIED match):
 *     - Collect evidence -> generate SHA-256 -> upload IPFS -> register on Fabric.
 *     - Execute verifyEvidenceIntegrity(evidenceId).
 *     - Validates IPFS file retrieval, SHA-256 calculation, Fabric on-chain query, hash comparison.
 *     - Validates verificationStatus = "VERIFIED", lastVerifiedAt, lastVerifiedBy.
 *     - Validates Incident activity log: action = EVIDENCE_VERIFIED.
 *  2. Tamper Detection Flow (TAMPERED mismatch):
 *     - Execute verification with tampered file bytes.
 *     - Validates verificationStatus = "TAMPERED" and currentHash !== blockchainHash.
 *     - Validates Incident activity log: action = EVIDENCE_TAMPER_DETECTED.
 *     - Validates Hyperledger Fabric on-chain record is UNTOUCHED (never overwritten on mismatch).
 *     - Validates mismatch remains permanently visible in audit trail.
 *  3. Verification Guards:
 *     - Rejection if evidence not registered on Fabric.
 *     - Rejection if evidence missing IPFS CID.
 *     - Rejection if evidence does not exist.
 *  4. HTTP REST API Endpoint:
 *     - POST /api/evidence/:evidenceId/verify returns exact JSON response contract.
 *
 * Run: node backend/scripts/testModule_P4M8.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const http = require('http');
const crypto = require('crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Incident = require('../models/Incident');
const Evidence = require('../models/Evidence');
const hashService = require('../services/hashService');
const pinataService = require('../services/pinataService');
const express = require('express');
const fabricService = require('../services/fabricService');
const evidenceService = require('../services/evidenceService');
const evidenceRoutes = require('../routes/evidenceRoutes');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
let testServer;
let serverPort;

let testsPassed = 0;
let testsFailed = 0;

function reportTest(name, condition, extra = '') {
  if (condition) {
    console.log(`  ✔ [PASS] ${name}`);
    testsPassed++;
  } else {
    console.error(`  ✖ [FAIL] ${name} ${extra ? `(${extra})` : ''}`);
    testsFailed++;
  }
}

function httpRequest({ method, path: reqPath, body, token }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: serverPort,
        path: reqPath,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            parsed = raw;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runModule8TestSuite() {
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('  🛡️ TESTING PHASE 4 MODULE 8: FABRIC EVIDENCE INTEGRITY VERIFICATION');
  console.log('════════════════════════════════════════════════════════════════════\n');

  // Connect to MongoDB
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✔ Connected to MongoDB successfully.\n');
  }

  // Start isolated test HTTP server for REST API route verification
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api', evidenceRoutes);

  testServer = await new Promise((resolve) => {
    const s = testApp.listen(0, '127.0.0.1', () => resolve(s));
  });
  serverPort = testServer.address().port;

  try {
    // 0. Setup test user
    let testUser = await User.findOne({ email: 'module8_analyst@incidentledger.com' });
    if (!testUser) {
      testUser = await User.create({
        name: 'Analyst Michael',
        email: 'module8_analyst@incidentledger.com',
        password: 'Password123!',
        role: 'Analyst',
      });
    }

    const authToken = jwt.sign(
      { id: testUser._id, name: testUser.name, role: testUser.role, email: testUser.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Setup active test incident
    const testIncidentId = `INC-M8-${Date.now()}`;
    const testIncident = await Incident.create({
      incidentId: testIncidentId,
      securityLogId: new mongoose.Types.ObjectId(),
      timestamp: new Date(),
      attackType: 'RANSOMWARE_EXPLOIT',
      title: 'Phase 4 Module 8 Integrity Verification Incident',
      description: 'Incident for testing Hyperledger Fabric integrity verification and tamper detection',
      severity: 'CRITICAL',
      status: 'INVESTIGATING',
      reportedBy: testUser._id,
      assignedTo: testUser._id,
      activityHistory: [],
    });

    console.log(`Test Incident created: ${testIncident.incidentId} (_id: ${testIncident._id})\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Positive Verification Flow (Original Integrity Confirmed)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('▶ TEST 1: Positive Integrity Verification (VERIFIED)');

    const originalFileBytes = Buffer.from(
      `[CRITICAL EVIDENCE FILE] Incident: ${testIncident.incidentId}\n` +
      `Timestamp: ${new Date().toISOString()}\n` +
      `Payload: Ransomware decryption binary payload intercepted at proxy.\n` +
      `Entropy: ${crypto.randomBytes(32).toString('hex')}\n`
    );
    const expectedOriginalSha256 = hashService.generateSha256(originalFileBytes);

    const collectedEvidence = await evidenceService.collectEvidence({
      incidentMongoId: testIncident._id,
      fileBuffer: originalFileBytes,
      originalName: 'ransomware_proxy_dump.bin',
      mimeType: 'application/octet-stream',
      description: 'Intercepted ransomware proxy dump file',
      collectedByUserId: testUser._id,
      collectedByName: testUser.name,
    });

    reportTest('Evidence collected and registered on Fabric', collectedEvidence.blockchainStatus === 'REGISTERED' && Boolean(collectedEvidence.fabricTransactionId));

    // Execute integrity verification
    const verificationResult = await evidenceService.verifyEvidenceIntegrity(
      collectedEvidence.evidenceId,
      testUser.name
    );

    reportTest('verificationStatus is VERIFIED', verificationResult.verificationStatus === 'VERIFIED');
    reportTest('currentHash matches original file SHA-256', verificationResult.currentHash === expectedOriginalSha256);
    reportTest('blockchainHash matches original file SHA-256', verificationResult.blockchainHash === expectedOriginalSha256);
    reportTest('currentHash matches blockchainHash exactly', verificationResult.currentHash === verificationResult.blockchainHash);
    reportTest('lastVerifiedAt timestamp recorded', Boolean(verificationResult.lastVerifiedAt));
    reportTest('lastVerifiedBy recorded analyst name', verificationResult.lastVerifiedBy === testUser.name);

    // Verify MongoDB update
    const dbEvidenceAfterVerify = await Evidence.findOne({ evidenceId: collectedEvidence.evidenceId });
    reportTest('MongoDB evidence verificationStatus updated to VERIFIED', dbEvidenceAfterVerify.verificationStatus === 'VERIFIED');
    reportTest('MongoDB lastVerifiedBy matches analyst', dbEvidenceAfterVerify.lastVerifiedBy === testUser.name);

    // Verify Incident Activity Log
    const incidentAfterVerify = await Incident.findById(testIncident._id);
    const verifyActivity = incidentAfterVerify.activityHistory.find(
      (a) => a.action === 'EVIDENCE_VERIFIED'
    );
    reportTest('Incident activity logged EVIDENCE_VERIFIED', Boolean(verifyActivity));
    reportTest(
      'Activity description matches format ("Evidence EVD-... integrity confirmed...")',
      verifyActivity && verifyActivity.description.includes(`Evidence ${collectedEvidence.evidenceId} integrity confirmed against Hyperledger Fabric record.`)
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Tamper Detection Flow (TAMPERED Discrepancy Detected)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 2: Tamper Detection Verification (TAMPERED)');

    // Create deliberately tampered file bytes (simulating modified content in storage/gateway)
    const tamperedBytes = Buffer.concat([
      originalFileBytes,
      Buffer.from('\n[MALICIOUS INJECTION]: Hostile rootkit instruction injected post-registration.\n')
    ]);
    const expectedTamperedHash = hashService.generateSha256(tamperedBytes);

    reportTest('Tampered file hash differs from original hash', expectedTamperedHash !== expectedOriginalSha256);

    // Execute verification with tampered file bytes
    const tamperResult = await evidenceService.verifyEvidenceIntegrity(
      collectedEvidence.evidenceId,
      'Auditor Inspector',
      tamperedBytes
    );

    reportTest('verificationStatus is TAMPERED', tamperResult.verificationStatus === 'TAMPERED');
    reportTest('currentHash reflects tampered file hash', tamperResult.currentHash === expectedTamperedHash);
    reportTest('blockchainHash preserves original immutable Fabric hash', tamperResult.blockchainHash === expectedOriginalSha256);
    reportTest('currentHash does NOT match blockchainHash', tamperResult.currentHash !== tamperResult.blockchainHash);

    // Verify MongoDB evidence status updated to TAMPERED
    const dbEvidenceAfterTamper = await Evidence.findOne({ evidenceId: collectedEvidence.evidenceId });
    reportTest('MongoDB evidence verificationStatus updated to TAMPERED', dbEvidenceAfterTamper.verificationStatus === 'TAMPERED');

    // Verify Incident Activity Log has EVIDENCE_TAMPER_DETECTED
    const incidentAfterTamper = await Incident.findById(testIncident._id);
    const tamperActivity = incidentAfterTamper.activityHistory.find(
      (a) => a.action === 'EVIDENCE_TAMPER_DETECTED'
    );
    reportTest('Incident activity logged EVIDENCE_TAMPER_DETECTED', Boolean(tamperActivity));
    reportTest(
      'Tamper activity description notes mismatch and tamper event',
      tamperActivity && tamperActivity.description.includes('Tampering detected')
    );

    // Verify Hyperledger Fabric ledger record was NOT modified after mismatch
    const fabricDirectQuery = await fabricService.getEvidenceFromBlockchain(collectedEvidence.evidenceId);
    reportTest(
      'Hyperledger Fabric blockchain record was NOT modified after tamper detection',
      fabricDirectQuery.sha256Hash === expectedOriginalSha256
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Verification Guards
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 3: Verification Guards');

    // Guard A: Evidence not registered on blockchain
    const unregEvidence = new Evidence({
      evidenceId: `EVD-UNREG-${Date.now()}`,
      incidentId: testIncident._id,
      fileName: 'unreg.log',
      originalFileName: 'unreg.log',
      mimeType: 'text/plain',
      fileSize: 100,
      collectedBy: testUser._id,
      hashStatus: 'GENERATED',
      sha256Hash: crypto.randomBytes(32).toString('hex'),
      storageStatus: 'UPLOADED',
      ipfsCid: 'bafkreiunreg1234567890',
      blockchainStatus: 'NOT_REGISTERED',
      fabricTransactionId: null,
    });
    await unregEvidence.save();

    let unregRejected = false;
    try {
      await evidenceService.verifyEvidenceIntegrity(unregEvidence.evidenceId, testUser.name);
    } catch (e) {
      unregRejected = true;
    }
    reportTest('Verification rejected when evidence is NOT_REGISTERED on Fabric', unregRejected);
    await Evidence.deleteOne({ _id: unregEvidence._id });

    // Guard B: Evidence missing IPFS CID
    const missingCidEvidence = new Evidence({
      evidenceId: `EVD-NOCID-${Date.now()}`,
      incidentId: testIncident._id,
      fileName: 'nocid.log',
      originalFileName: 'nocid.log',
      mimeType: 'text/plain',
      fileSize: 100,
      collectedBy: testUser._id,
      hashStatus: 'GENERATED',
      sha256Hash: crypto.randomBytes(32).toString('hex'),
      storageStatus: 'PENDING',
      ipfsCid: null,
      blockchainStatus: 'REGISTERED',
      fabricTransactionId: '0x' + crypto.randomBytes(32).toString('hex'),
    });
    await missingCidEvidence.save();

    let noCidRejected = false;
    try {
      await evidenceService.verifyEvidenceIntegrity(missingCidEvidence.evidenceId, testUser.name);
    } catch (e) {
      noCidRejected = true;
    }
    reportTest('Verification rejected when evidence is missing IPFS CID', noCidRejected);
    await Evidence.deleteOne({ _id: missingCidEvidence._id });

    // Guard C: Non-existent evidence
    let nonExistentRejected = false;
    try {
      await evidenceService.verifyEvidenceIntegrity('EVD-NONEXISTENT-999999', testUser.name);
    } catch (e) {
      nonExistentRejected = true;
    }
    reportTest('Verification rejected when evidence does not exist (404)', nonExistentRejected);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: HTTP REST API Contract Verification
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n▶ TEST 4: HTTP POST /api/evidence/:evidenceId/verify Contract');

    const httpRes = await httpRequest({
      method: 'POST',
      path: `/api/evidence/${collectedEvidence.evidenceId}/verify`,
      token: authToken,
    });
    console.log('DEBUG httpRes:', httpRes.status, httpRes.data);

    reportTest('HTTP status is 200 OK', httpRes.status === 200);
    reportTest('Response contains evidenceId', httpRes.data?.evidenceId === collectedEvidence.evidenceId);
    reportTest('Response contains blockchainHash', Boolean(httpRes.data?.blockchainHash));
    reportTest('Response contains currentHash', Boolean(httpRes.data?.currentHash));
    reportTest('Response contains verificationStatus (VERIFIED | TAMPERED)', ['VERIFIED', 'TAMPERED'].includes(httpRes.data?.verificationStatus));

    // Cleanup test incident and evidence
    await Evidence.deleteOne({ _id: collectedEvidence._id });
    await Incident.deleteOne({ _id: testIncident._id });
    await User.deleteOne({ _id: testUser._id });

    console.log('\n════════════════════════════════════════════════════════════════════');
    if (testsFailed === 0) {
      console.log(`  ✔ MODULE 8 TEST RESULTS: ${testsPassed} / ${testsPassed} PASSED`);
    } else {
      console.error(`  ✖ MODULE 8 TEST RESULTS: ${testsFailed} FAILED out of ${testsPassed + testsFailed}`);
    }
    console.log('════════════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n✖ Module 8 test suite encountered unhandled error:', err);
    testsFailed++;
  } finally {
    if (testServer) testServer.close();
    await mongoose.disconnect();
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

runModule8TestSuite();
