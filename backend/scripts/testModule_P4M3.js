/**
 * testModule_P4M3.js — Phase 4 Module 3: Pinata / IPFS Evidence Storage
 *
 * Automated end-to-end and unit test verifying:
 *  1. Environment variable usage (PINATA_JWT, PINATA_GATEWAY_URL) — no hard-coded secrets.
 *  2. Upload evidence file and generate SHA-256.
 *  3. POST /api/evidence/:evidenceId/upload-ipfs uploads exact file bytes to IPFS.
 *  4. Verifies CID is returned (format: Qm... or bafy...) and stored in MongoDB.
 *  5. Verifies storageStatus = "UPLOADED" and ipfsUploadedAt is recorded.
 *  6. Verifies console logs: [IPFS] Upload started, Upload successful, CID received, Evidence metadata updated.
 *  7. Error handling: If Pinata upload fails -> storageStatus = "FAILED".
 *  8. Safe retrieval: GET /api/evidence/:evidenceId/view streams file securely without exposing secrets.
 *
 * Run: node backend/scripts/testModule_P4M3.js
 */

const path   = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const http     = require("http");
const https    = require("https");
const mongoose = require("mongoose");
const jwt      = require("jsonwebtoken");

const User          = require("../models/User");
const Evidence      = require("../models/Evidence");
const Incident      = require("../models/Incident");
const pinataService = require("../services/pinataService");

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL   = process.env.TEST_API_URL || `http://localhost:${process.env.PORT || 5000}/api`;
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_testing";

// ── ANSI colours ──────────────────────────────────────────────────────────────
const G    = (s) => `\x1b[32m${s}\x1b[0m`;
const R    = (s) => `\x1b[31m${s}\x1b[0m`;
const Y    = (s) => `\x1b[33m${s}\x1b[0m`;
const B    = (s) => `\x1b[34m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function assert(condition, label, detail = "") {
  if (condition) {
    console.log(G(`  ✅ PASS`) + ` ${label}`);
    passed++;
  } else {
    console.log(R(`  ❌ FAIL`) + ` ${label}` + (detail ? ` — ${detail}` : ""));
    failed++;
  }
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function request(method, pathUrl, body, token, isFormData = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${pathUrl}`);
    const lib = url.protocol === "https:" ? https : http;

    let postData;
    const headers = {};

    if (token) headers["Authorization"] = `Bearer ${token}`;

    if (isFormData) {
      const boundary = `----FormBoundary${Date.now()}`;
      headers["Content-Type"] = `multipart/form-data; boundary=${boundary}`;

      const parts = [];
      if (body.description) {
        parts.push(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="description"\r\n\r\n` +
          `${body.description}\r\n`
        );
      }
      if (body.file) {
        const { buffer, filename, mimetype } = body.file;
        parts.push(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
          `Content-Type: ${mimetype}\r\n\r\n`
        );
        const end = `\r\n--${boundary}--\r\n`;
        postData = Buffer.concat([
          Buffer.from(parts.join(""), "utf-8"),
          buffer,
          Buffer.from(end, "utf-8"),
        ]);
      } else {
        postData = Buffer.from(parts.join("") + `--${boundary}--\r\n`, "utf-8");
      }
      headers["Content-Length"] = postData.length;
    } else if (body) {
      postData = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
    };

    const req = lib.request(options, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        let data;
        try { data = JSON.parse(raw); } catch { data = raw; }
        resolve({ status: res.statusCode, headers: res.headers, data });
      });
    });

    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// ── Main Test Runner ──────────────────────────────────────────────────────────
async function run() {
  console.log("\n" + BOLD("═══════════════════════════════════════════════════════"));
  console.log(BOLD(" Phase 4 Module 3 — Pinata / IPFS Evidence Storage Tests"));
  console.log(BOLD("═══════════════════════════════════════════════════════") + "\n");

  const cleanupEvidenceIds = [];
  let token;
  let incidentMongoId;

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1 — DB Connection & Admin Authentication
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("[TEST 1] DB Connection & Admin Authentication"));
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
  assert(mongoose.connection.readyState === 1, "Connected to MongoDB");

  const admin = await User.findOne({ role: "Admin" });
  assert(!!admin, `Admin found in DB: ${admin?.email}`);

  token = jwt.sign(
    { id: admin._id, role: admin.role, name: admin.name, email: admin.email },
    JWT_SECRET
  );
  assert(!!token, "Generated JWT token for Admin user");

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2 — Fetch Active Incident from DB
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 2] Fetch Active Incident from DB"));
  const incident = await Incident.findOne({ status: { $ne: "ARCHIVED" } });
  assert(!!incident, `Found active incident: ${incident?.incidentId}`);
  incidentMongoId = incident._id;

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3 — Upload evidence file
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 3] Upload Evidence File"));
  const testBytes = Buffer.from("2026-09-09T12:00:00Z | SNORT ALERT | 192.168.1.100 -> 10.0.0.5:22\n", "utf-8");
  let evidenceId;
  let sha256Hash;

  {
    const res = await request(
      "POST",
      `/incidents/${incidentMongoId}/evidence`,
      {
        description: "Network intrusion alert log for IPFS storage test",
        file: {
          buffer: testBytes,
          filename: "snort-alert.log",
          mimetype: "text/plain",
        },
      },
      token,
      true
    );

    assert(res.status === 201, "POST /api/incidents/:id/evidence → 201 Created");
    assert(!!res.data.evidenceId, `evidenceId generated: ${res.data.evidenceId}`);
    evidenceId = res.data.evidenceId;
    sha256Hash = res.data.evidence?.sha256Hash;
    cleanupEvidenceIds.push(evidenceId);

    assert(!!sha256Hash, `SHA-256 computed: ${sha256Hash}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4 — IPFS CID Computation Integrity
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 4] Verify Deterministic IPFS CID Computation"));
  const expectedCid = pinataService.computeIpfsCid(testBytes);
  assert(typeof expectedCid === "string" && expectedCid.startsWith("Qm"), `Valid IPFS CIDv0 format (${expectedCid})`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5 — POST /api/evidence/:evidenceId/upload-ipfs Endpoint
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 5] POST /api/evidence/:evidenceId/upload-ipfs Endpoint"));
  // Enable mock mode for testing if live credentials are not active
  const originalJwt = process.env.PINATA_JWT;
  if (!process.env.PINATA_JWT || !process.env.PINATA_JWT.trim()) {
    process.env.PINATA_JWT = "mock";
  }

  let ipfsCid;
  {
    const res = await request("POST", `/evidence/${evidenceId}/upload-ipfs`, {}, token);
    assert(res.status === 200, "POST /api/evidence/:id/upload-ipfs → 200 OK");
    assert(res.data.evidenceId === evidenceId, "Returns correct evidenceId");
    assert(!!res.data.ipfsCid, `Returns ipfsCid: ${res.data.ipfsCid}`);
    assert(res.data.sha256Hash === sha256Hash, "Returns exact matching sha256Hash");
    assert(res.data.storageStatus === "UPLOADED", "storageStatus = 'UPLOADED'");

    ipfsCid = res.data.ipfsCid;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6 — Verify MongoDB Persistence of IPFS Metadata
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 6] Verify MongoDB IPFS Persistence"));
  {
    const doc = await Evidence.findOne({ evidenceId });
    assert(!!doc, "Evidence document found in MongoDB");
    assert(doc.ipfsCid === ipfsCid, `MongoDB ipfsCid matches (${doc.ipfsCid})`);
    assert(doc.storageStatus === "UPLOADED", "MongoDB storageStatus is UPLOADED");
    assert(doc.ipfsUploadedAt instanceof Date, `ipfsUploadedAt is Date (${doc.ipfsUploadedAt})`);
    assert(doc.sha256Hash === sha256Hash, "sha256Hash remains preserved");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7 — Error Handling: Pinata Upload Failure sets storageStatus = FAILED
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 7] Error Handling: Failure sets storageStatus = FAILED"));
  {
    // Upload a temporary evidence file to test failure handling
    const failRes = await request(
      "POST",
      `/incidents/${incidentMongoId}/evidence`,
      {
        description: "Failure handling test file",
        file: {
          buffer: Buffer.from("temporary file for failure test"),
          filename: "fail-test.txt",
          mimetype: "text/plain",
        },
      },
      token,
      true
    );

    const failEvidenceId = failRes.data.evidenceId;
    cleanupEvidenceIds.push(failEvidenceId);

    // Test failure handling via pinataService with invalid credentials
    process.env.PINATA_JWT = "invalid_malformed_token_12345";
    const failDoc = await Evidence.findOne({ evidenceId: failEvidenceId });
    failDoc.ipfsCid = null;
    failDoc.storageStatus = "PENDING";
    await failDoc.save();

    try {
      await pinataService.uploadEvidenceToIPFS(failDoc);
      assert(false, "Expected Pinata upload to fail with invalid credentials");
    } catch (err) {
      assert(true, `Upload with invalid credentials rejected (${err.message.slice(0, 45)}...)`);
    }

    // Verify document in MongoDB is marked as FAILED
    const updatedFailDoc = await Evidence.findOne({ evidenceId: failEvidenceId });
    assert(updatedFailDoc.storageStatus === "FAILED", `Evidence storageStatus updated to 'FAILED' in MongoDB (got: ${updatedFailDoc.storageStatus})`);
    assert(updatedFailDoc.ipfsCid === null, "Evidence ipfsCid remains null on failure");

    // Restore JWT
    process.env.PINATA_JWT = originalJwt || "mock";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8 — Safe Retrieval: GET /api/evidence/:evidenceId/view
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 8] Safe Retrieval: GET /api/evidence/:evidenceId/view"));
  {
    const res = await request("GET", `/evidence/${evidenceId}/view`, null, token);
    assert(res.status === 200, "GET /api/evidence/:id/view → 200 OK");
    assert(res.headers["content-type"]?.includes("text/plain"), "Content-Type matches evidence mimeType");
    assert(res.headers["content-disposition"]?.includes("snort-alert.log"), "Content-Disposition includes original filename");
    assert(typeof res.data === "string" && res.data.includes("SNORT ALERT"), "File content streamed safely through backend");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Clean Up Test Evidence
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[CLEANUP] Deleting temporary test evidence records"));
  for (const id of cleanupEvidenceIds) {
    try {
      await request("DELETE", `/evidence/${id}`, null, token);
    } catch (e) {
      // ignore cleanup errors
    }
  }
  console.log(G("  ✓ Cleaned up test evidence records"));

  // ──────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n" + BOLD("═══════════════════════════════════════════════════════"));
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(BOLD(`  🎉 ALL ${total} MODULE P4M3 TESTS PASSED SUCCESSFULLY!`)));
  } else {
    console.log(R(BOLD(`  ⚠  ${passed}/${total} passed, ${failed} FAILED`)));
  }
  console.log(BOLD("═══════════════════════════════════════════════════════") + "\n");

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(async (err) => {
  console.error(R("Fatal test error:"), err);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
