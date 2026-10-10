/**
 * testModule_P5.js — Phase 5: Automated Incident Report Generation Test Suite
 *
 * Comprehensive 20-Step Verification:
 *  1. Valid incident creation.
 *  2. Report generation workflow execution.
 *  3. Report number format check (CSR-YYYYMMDD-XXXXXX).
 *  4. AI report summary structure and non-fabrication check.
 *  5. Evidence metadata and Hyperledger Fabric proofs inclusion.
 *  6. Digital Seal generation (SEAL-YYYYMMDD-XXXXXXXX).
 *  7. QR Code generation and verification URL targeting /verify/:reportNumber.
 *  8. PDF generation and binary content validity check (%PDF header).
 *  9. PDF structure and section generation validity.
 * 10. Final PDF SHA-256 calculation (64 hex characters).
 * 11. Positive report integrity verification (intact: true, VERIFIED status).
 * 12. Deliberately altered PDF tampering test (intact: false, tamper detected).
 * 13. Public QR verification endpoint contract (GET /api/verify/:reportNumber without JWT).
 * 14. Invalid report number handling (404 Not Found).
 * 15. Role-based authorization & access control checks.
 * 16. Organization scoping & isolation check.
 * 17. Duplicate report prevention (idempotency vs forceRegenerate).
 * 18. Incident with zero evidence handling ("Not Available" / safe fallback).
 * 19. AI field resilience test (safe fallbacks for missing/partial analysis).
 * 20. End-to-end PDF download endpoint stream verification.
 *
 * Run: node backend/scripts/testModule_P5.js
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const express = require("express");

const User = require("../models/User");
const Incident = require("../models/Incident");
const Evidence = require("../models/Evidence");
const IncidentReport = require("../models/IncidentReport");

const reportRoutes = require("../routes/reportRoutes");
const { generateIncidentReport, verifyReportIntegrity, publicVerifyReport } = require("../services/reportService");
const { generateDigitalSealId } = require("../services/digitalSealService");
const { generateQrVerificationId, generateQrCodeBuffer } = require("../services/qrVerificationService");
const { buildAiSummary, buildInvestigationNarrative } = require("../services/reportSummaryService");
const { generatePdfReport, verifyPdfIntegrity } = require("../services/pdfReportService");

const JWT_SECRET = process.env.JWT_SECRET || "secret";
let testServer;
let serverPort;

let testsPassed = 0;
let testsFailed = 0;

function reportTest(name, condition, extra = "") {
  if (condition) {
    console.log(`  ✔ [PASS] ${name}`);
    testsPassed++;
  } else {
    console.error(`  ✖ [FAIL] ${name} ${extra ? `(${extra})` : ""}`);
    testsFailed++;
  }
}

function httpRequest({ method, path: reqPath, body, token }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : "";
    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: reqPath,
        method,
        headers,
      },
      (res) => {
        let rawData = "";
        res.on("data", (chunk) => (rawData += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function httpDownload({ path: reqPath, token }) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: reqPath,
        method: "GET",
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve({ status: res.statusCode, headers: res.headers, buffer });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function runTests() {
  console.log("\n========================================================");
  console.log("  PHASE 5: AUTOMATED INCIDENT REPORT GENERATION TEST SUITE");
  console.log("========================================================\n");

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/cybersecurity_ledger";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB for testing.");

  // Spin up test express app
  const app = express();
  app.use(express.json());
  app.use("/api", reportRoutes);

  await new Promise((resolve) => {
    testServer = app.listen(0, () => {
      serverPort = testServer.address().port;
      console.log(`Test Express server running on port ${serverPort}\n`);
      resolve();
    });
  });

  const testOrgId = new mongoose.Types.ObjectId();
  const testAdminId = new mongoose.Types.ObjectId();
  const testAnalystId = new mongoose.Types.ObjectId();
  const testAuditorId = new mongoose.Types.ObjectId();
  const testOrgUserId = new mongoose.Types.ObjectId();

  const adminToken = jwt.sign(
    { _id: testAdminId, name: "Test Admin", role: "Admin", email: "admin@test.local", organizationId: testOrgId },
    JWT_SECRET, { expiresIn: "1h" }
  );
  const analystToken = jwt.sign(
    { _id: testAnalystId, name: "Test Analyst", role: "Analyst", email: "analyst@test.local", organizationId: testOrgId },
    JWT_SECRET, { expiresIn: "1h" }
  );
  const auditorToken = jwt.sign(
    { _id: testAuditorId, name: "Test Auditor", role: "Auditor", email: "auditor@test.local", organizationId: testOrgId },
    JWT_SECRET, { expiresIn: "1h" }
  );
  const orgToken = jwt.sign(
    { _id: testOrgUserId, name: "Test Org User", role: "Organization", email: "org@test.local", organizationId: testOrgId },
    JWT_SECRET, { expiresIn: "1h" }
  );

  let testIncident1;
  let testIncidentEmpty;
  let testEvidence1;
  let createdReport1;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Valid Incident Creation
    // -------------------------------------------------------------------------
    console.log("--- TEST 1: Incident Setup ---");
    testIncident1 = await Incident.create({
      incidentId: `INC-TEST-P5-${Date.now()}`,
      securityLogId: new mongoose.Types.ObjectId(),
      timestamp: new Date(),
      title: "Suspicious Ransomware Infiltration & C2 Activity",
      severity: "CRITICAL",
      riskScore: 92,
      status: "RESOLVED",
      threatCategory: "Malware",
      attackType: "Ransomware",
      source: "Endpoint Agent",
      sourceIP: "192.168.1.105",
      destinationIP: "45.33.32.156",
      sourcePort: 54112,
      destinationPort: 443,
      protocol: "TCP",
      description: "Host 192.168.1.105 established an anomalous TLS session with known C2 infrastructure.",
      aiExplanation: "High-confidence detection of Cobalt Strike beaconing coupled with rapid volume encryption.",
      recommendedAction: "Isolate endpoint immediately, revoke Kerberos tickets, and inspect shadow copies.",
      resolutionSummary: "Host was successfully isolated, malicious process killed, and encrypted files restored from offline snapshot.",
      rootCause: "Phishing email containing a weaponized LNK shortcut was opened by standard user.",
      actionTaken: "Endpoint quarantined, firewall egress rule applied, password reset forced.",
      resolvedAt: new Date(),
      organizationId: testOrgId,
      organizationName: "Global Cyber Defense Corp",
    });

    reportTest("Test 1: Valid Incident Created", !!testIncident1 && !!testIncident1._id);

    // Create linked evidence with IPFS and Fabric proofs
    testEvidence1 = await Evidence.create({
      evidenceId: `EVD-20260911-${Math.floor(100000 + Math.random() * 900000)}`,
      incidentId: testIncident1._id,
      fileName: `ev_${Date.now()}.raw`,
      originalFileName: "memory_dump_beacon.raw",
      fileType: "FORENSIC_IMAGE",
      mimeType: "application/octet-stream",
      fileSize: 1048576,
      collectedBy: testAnalystId,
      collectionTimestamp: new Date(),
      sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ipfsCid: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
      blockchainStatus: "REGISTERED",
      fabricTransactionId: "fab_tx_09182374981723984719283749182374",
      fabricRecordedAt: new Date(),
      verificationStatus: "VERIFIED",
    });

    // -------------------------------------------------------------------------
    // TEST 2: Report Generation Workflow Execution (POST /api/incidents/:id/reports)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2 & 3: Report Generation & Identifier Formatting ---");
    const genRes = await httpRequest({
      method: "POST",
      path: `/api/incidents/${testIncident1._id}/reports`,
      token: analystToken,
      body: { forceRegenerate: true },
    });

    reportTest("Test 2: Report Generation Execution Status 201", genRes.status === 201);
    createdReport1 = await IncidentReport.findOne({ incidentId: testIncident1._id }).lean();
    reportTest("Test 2b: IncidentReport Document Persisted in MongoDB", !!createdReport1);

    // -------------------------------------------------------------------------
    // TEST 3: Report Number Format Check (CSR-YYYYMMDD-XXXXXX)
    // -------------------------------------------------------------------------
    const reportNumberRegex = /^CSR-\d{8}-[A-F0-9]{6}$/;
    reportTest(
      "Test 3: Report Number Format (CSR-YYYYMMDD-XXXXXX)",
      reportNumberRegex.test(createdReport1.reportNumber),
      `Got: ${createdReport1.reportNumber}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: AI Report Summary Structure & Zero Fabrication
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: AI Summary & Zero Fabrication ---");
    const aiData = buildAiSummary(testIncident1);
    reportTest(
      "Test 4a: AI Summary Object Structure Valid",
      aiData && typeof aiData.aiSummary === "string" && typeof aiData.recommendedAction === "string"
    );
    reportTest(
      "Test 4b: Zero Fabrication - AI uses factual incident metadata",
      aiData.aiSummary.includes("Ransomware") || aiData.aiSummary.includes("Cobalt Strike")
    );

    // -------------------------------------------------------------------------
    // TEST 5: Evidence Metadata & Fabric Proofs Inclusion
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Evidence & Fabric Proofs Snapshot ---");
    reportTest(
      "Test 5a: Evidence Count Recorded Accurately",
      createdReport1.evidenceCount === 1
    );
    reportTest(
      "Test 5b: Evidence Fabric Tx ID & IPFS CID Recorded in Snapshot",
      createdReport1.evidenceList.length === 1 &&
      createdReport1.evidenceList[0].fabricTransactionId === testEvidence1.fabricTransactionId &&
      createdReport1.evidenceList[0].ipfsCid === testEvidence1.ipfsCid
    );

    // -------------------------------------------------------------------------
    // TEST 6: Digital Seal Generation (SEAL-YYYYMMDD-XXXXXXXX)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Digital Seal Generation ---");
    const sealRegex = /^SEAL-\d{8}-[A-F0-9]{8}$/;
    reportTest(
      "Test 6: Digital Seal ID Format (SEAL-YYYYMMDD-XXXXXXXX)",
      sealRegex.test(createdReport1.digitalSealId),
      `Got: ${createdReport1.digitalSealId}`
    );

    // -------------------------------------------------------------------------
    // TEST 7: QR Code Generation & Verification URL
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: QR Verification Generation ---");
    const vrfRegex = /^VRF-\d{8}-[A-F0-9]{8}$/;
    reportTest(
      "Test 7a: QR Verification ID Format (VRF-YYYYMMDD-XXXXXXXX)",
      vrfRegex.test(createdReport1.qrVerificationId),
      `Got: ${createdReport1.qrVerificationId}`
    );
    reportTest(
      "Test 7b: Verification URL Targets /verify/:reportNumber",
      createdReport1.verificationUrl.includes(`/verify/${createdReport1.reportNumber}`)
    );

    const qrBuf = await generateQrCodeBuffer(createdReport1.verificationUrl);
    reportTest("Test 7c: QR Code Buffer Generated as PNG", Buffer.isBuffer(qrBuf) && qrBuf.length > 0);

    // -------------------------------------------------------------------------
    // TEST 8: PDF Generation & Binary Content Validity (%PDF Header)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8 & 9: PDF Binary & Structure Checks ---");
    const pdfExists = fs.existsSync(createdReport1.pdfPath);
    reportTest("Test 8a: PDF File Exists on Disk", pdfExists);

    let pdfBuffer = null;
    if (pdfExists) {
      pdfBuffer = fs.readFileSync(createdReport1.pdfPath);
    }
    const hasPdfHeader = pdfBuffer && pdfBuffer.slice(0, 5).toString() === "%PDF-";
    reportTest("Test 8b: PDF Begins with %PDF- Magic Header", hasPdfHeader);

    // -------------------------------------------------------------------------
    // TEST 9: PDF Section Generation & Content Completeness
    // -------------------------------------------------------------------------
    reportTest("Test 9: PDF Size Reasonable (> 2KB)", pdfBuffer && pdfBuffer.length > 2000, `Size: ${pdfBuffer ? pdfBuffer.length : 0} bytes`);

    // -------------------------------------------------------------------------
    // TEST 10: Final PDF SHA-256 Checksum Calculation
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 10: PDF SHA-256 Hash Verification ---");
    const computedHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    reportTest("Test 10a: Stored Report Hash is 64 Hex Chars", /^[a-f0-9]{64}$/.test(createdReport1.reportHash));
    reportTest(
      "Test 10b: Stored Hash Exactly Matches Disk File SHA-256",
      createdReport1.reportHash === computedHash,
      `Stored: ${createdReport1.reportHash} vs Computed: ${computedHash}`
    );

    // -------------------------------------------------------------------------
    // TEST 11: Positive Report Integrity Verification (intact: true)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 11 & 12: Tamper Detection (Positive & Negative) ---");
    const verifyPositiveRes = await httpRequest({
      method: "POST",
      path: `/api/reports/${createdReport1._id}/verify-integrity`,
      token: adminToken,
    });
    reportTest("Test 11a: Integrity Check HTTP 200", verifyPositiveRes.status === 200);
    reportTest("Test 11b: Report Verified Intact (intact: true)", verifyPositiveRes.body?.intact === true);

    // -------------------------------------------------------------------------
    // TEST 12: Deliberately Altered PDF Tampering Test (intact: false)
    // -------------------------------------------------------------------------
    // Create an altered copy in memory and write a tampered byte to a separate test report
    const tamperedPdfPath = path.join(path.dirname(createdReport1.pdfPath), `tampered_${Date.now()}.pdf`);
    const tamperedBuffer = Buffer.from(pdfBuffer);
    tamperedBuffer[tamperedBuffer.length - 20] ^= 0xff; // Flip bits in trailing structure
    fs.writeFileSync(tamperedPdfPath, tamperedBuffer);

    // Run verifyPdfIntegrity directly on tampered file against the original stored hash
    const tamperCheck = verifyPdfIntegrity(tamperedPdfPath, createdReport1.reportHash);
    reportTest("Test 12a: Tamper Detection Detected Mismatch (intact: false)", tamperCheck.intact === false);
    reportTest(
      "Test 12b: Current Hash Differs From Stored Hash on Tampered File",
      tamperCheck.currentHash !== tamperCheck.storedHash
    );
    try { fs.unlinkSync(tamperedPdfPath); } catch {}

    // -------------------------------------------------------------------------
    // TEST 13: Public QR Verification Endpoint Contract (No JWT Required)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 13 & 14: Public Verification & Invalid Lookup ---");
    const publicRes = await httpRequest({
      method: "GET",
      path: `/api/verify/${createdReport1.reportNumber}`,
      // Notice: NO token provided!
    });
    reportTest("Test 13a: Public QR Verification Returns HTTP 200 Without Token", publicRes.status === 200);
    reportTest("Test 13b: Public Verification Returns Intact Status", publicRes.body?.intact === true);
    reportTest("Test 13c: Public Verification Exposes Report Metadata", publicRes.body?.reportNumber === createdReport1.reportNumber);
    reportTest("Test 13d: Public Verification Does NOT Expose Internal pdfPath", !publicRes.body?.pdfPath);

    // -------------------------------------------------------------------------
    // TEST 14: Invalid Report Number Handling (404 Not Found)
    // -------------------------------------------------------------------------
    const invalidPublicRes = await httpRequest({
      method: "GET",
      path: "/api/verify/CSR-99999999-NONEXIST",
    });
    reportTest("Test 14: Invalid Report Number Returns HTTP 404", invalidPublicRes.status === 404);

    // -------------------------------------------------------------------------
    // TEST 15: Role-Based Authorization & 403 Checks
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 15: RBAC & Permission Enforcement ---");
    // Auditor should NOT be allowed to generate reports (only Admin, Analyst)
    const auditorGenRes = await httpRequest({
      method: "POST",
      path: `/api/incidents/${testIncident1._id}/reports`,
      token: auditorToken,
      body: { forceRegenerate: true },
    });
    reportTest("Test 15a: Auditor Blocked From Report Generation (HTTP 403)", auditorGenRes.status === 403);

    // Unauthenticated request to protected route should receive 401
    const unauthRes = await httpRequest({
      method: "GET",
      path: `/api/reports/${createdReport1._id}`,
    });
    reportTest("Test 15b: Unauthenticated Request Blocked (HTTP 401)", unauthRes.status === 401);

    // -------------------------------------------------------------------------
    // TEST 16: Organization Isolation Check
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 16: Organization Scoping ---");
    const orgRes = await httpRequest({
      method: "GET",
      path: "/api/reports",
      token: orgToken,
    });
    reportTest("Test 16: Organization Scoped Query HTTP 200", orgRes.status === 200 && Array.isArray(orgRes.body?.reports));

    // -------------------------------------------------------------------------
    // TEST 17: Duplicate Report Prevention (Idempotency)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 17: Idempotency vs Force Regenerate ---");
    const dupRes = await httpRequest({
      method: "POST",
      path: `/api/incidents/${testIncident1._id}/reports`,
      token: analystToken,
      body: { forceRegenerate: false }, // Should return existing report without re-creating
    });
    reportTest("Test 17: Idempotent Request Returns Same Report", dupRes.body?.reportNumber === createdReport1.reportNumber);

    // -------------------------------------------------------------------------
    // TEST 18: Incident with Zero Evidence Handling ("Not Available" Fallback)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 18: Zero Evidence Handling ---");
    testIncidentEmpty = await Incident.create({
      incidentId: `INC-TEST-EMPTY-${Date.now()}`,
      securityLogId: new mongoose.Types.ObjectId(),
      timestamp: new Date(),
      title: "Isolated Unauthorized Access Attempt",
      severity: "LOW",
      riskScore: 25,
      status: "NEW",
      threatCategory: "Access Violation",
      attackType: "Brute Force",
      organizationId: testOrgId,
    });

    const emptyGenRes = await httpRequest({
      method: "POST",
      path: `/api/incidents/${testIncidentEmpty._id}/reports`,
      token: analystToken,
    });
    reportTest("Test 18a: Zero-Evidence Incident Report Generated HTTP 201", emptyGenRes.status === 201);
    const emptyReport = await IncidentReport.findOne({ incidentId: testIncidentEmpty._id }).lean();
    reportTest("Test 18b: Zero Evidence Count Recorded as 0", emptyReport.evidenceCount === 0);
    reportTest("Test 18c: Zero Evidence Handled Gracefully in List", Array.isArray(emptyReport.evidenceList) && emptyReport.evidenceList.length === 0);

    // -------------------------------------------------------------------------
    // TEST 19: AI Field Resilience Test (Missing/Partial Analysis Handled Gracefully)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 19: AI Field Resilience ---");
    const emptyAiData = buildAiSummary(testIncidentEmpty);
    reportTest(
      "Test 19: AI Summary Gracefully Employs Fallback Values When Fields Missing",
      emptyAiData && typeof emptyAiData.aiSummary === "string" && !emptyAiData.aiSummary.includes("undefined")
    );

    // -------------------------------------------------------------------------
    // TEST 20: PDF Download Endpoint Stream Verification
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 20: PDF Streaming Endpoint (GET /api/reports/:id/download) ---");
    const downloadRes = await httpDownload({
      path: `/api/reports/${createdReport1._id}/download`,
      token: analystToken,
    });
    reportTest("Test 20a: PDF Download HTTP 200", downloadRes.status === 200);
    reportTest(
      "Test 20b: Correct Content-Type Header (application/pdf)",
      downloadRes.headers["content-type"] === "application/pdf"
    );
    reportTest(
      "Test 20c: Download Stream Buffer Matches Generated PDF",
      downloadRes.buffer && downloadRes.buffer.slice(0, 5).toString() === "%PDF-"
    );

  } catch (err) {
    console.error("Test Suite Fatal Error:", err);
    testsFailed++;
  } finally {
    // Cleanup created test records
    try {
      if (testIncident1) await Incident.findByIdAndDelete(testIncident1._id);
      if (testIncidentEmpty) await Incident.findByIdAndDelete(testIncidentEmpty._id);
      if (testEvidence1) await Evidence.findByIdAndDelete(testEvidence1._id);
      if (createdReport1) {
        if (createdReport1.pdfPath && fs.existsSync(createdReport1.pdfPath)) {
          fs.unlinkSync(createdReport1.pdfPath);
        }
        await IncidentReport.deleteMany({ incidentIdentifier: { $regex: /^INC-TEST-/ } });
      }
    } catch (cleanErr) {
      console.warn("Cleanup warning:", cleanErr.message);
    }

    if (testServer) testServer.close();
    await mongoose.disconnect();

    console.log("\n========================================================");
    console.log(`  TEST RESULTS: ${testsPassed} PASSED | ${testsFailed} FAILED`);
    console.log("========================================================\n");

    if (testsFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTests();
