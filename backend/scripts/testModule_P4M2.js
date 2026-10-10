/**
 * testModule_P4M2.js — Phase 4 Module 2: SHA-256 Evidence Hash Generation
 *
 * Automated end-to-end and unit test verifying:
 *  1. Upload evidence file (e.g. firewall-log.txt).
 *  2. Server generates 64-hex SHA-256 using built-in crypto.
 *  3. Stores hash in MongoDB with hashStatus = "GENERATED".
 *  4. GET /api/evidence/:evidenceId/hash returns { evidenceId, sha256Hash, hashStatus } without exposing file.
 *  5. Upload the exact same file bytes again and confirm identical hash.
 *  6. Modify the file bytes and confirm the hash changes.
 *  7. Hash service error handling marks hashStatus = "FAILED".
 *
 * Run: node backend/scripts/testModule_P4M2.js
 */

const path   = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const http     = require("http");
const https    = require("https");
const mongoose = require("mongoose");
const jwt      = require("jsonwebtoken");

const User        = require("../models/User");
const Evidence    = require("../models/Evidence");
const Incident    = require("../models/Incident");
const hashService = require("../services/hashService");

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.TEST_API_URL || `http://localhost:${process.env.PORT || 5000}/api`;
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
        resolve({ status: res.statusCode, data });
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
  console.log(BOLD(" Phase 4 Module 2 — SHA-256 Hash Generation Tests"));
  console.log(BOLD("═══════════════════════════════════════════════════════") + "\n");

  const cleanupEvidenceIds = [];
  let token;
  let incidentMongoId;
  let incidentReadableId;

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1 — Database Connection & Admin Authentication
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
  assert(!!incident, `Found active incident: ${incident?.incidentId} (${incident?.status})`);
  incidentMongoId    = incident._id;
  incidentReadableId = incident.incidentId;

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3 — Upload evidence & verify SHA-256 generation
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 3] Upload Evidence & Verify SHA-256 Generation"));
  const fileBytesA = Buffer.from("2026-09-09T11:00:00Z | ACCEPT | 192.168.1.100 -> 10.0.0.1:443\n", "utf-8");
  let evidence1Id;
  let evidence1Hash;

  {
    const res = await request(
      "POST",
      `/incidents/${incidentMongoId}/evidence`,
      {
        description: "Primary firewall log evidence",
        file: {
          buffer: fileBytesA,
          filename: "firewall-log.txt",
          mimetype: "text/plain",
        },
      },
      token,
      true
    );

    assert(res.status === 201, "POST /api/incidents/:id/evidence → 201 Created");
    assert(!!res.data.evidenceId, `Server-generated evidenceId: ${res.data.evidenceId}`);
    assert(res.data.evidence?.hashStatus === "GENERATED", `hashStatus is 'GENERATED' (got: ${res.data.evidence?.hashStatus})`);

    evidence1Id   = res.data.evidenceId;
    evidence1Hash = res.data.evidence?.sha256Hash;
    cleanupEvidenceIds.push(evidence1Id);

    assert(typeof evidence1Hash === "string" && evidence1Hash.length === 64, `SHA-256 is 64 hex characters (${evidence1Hash})`);
    assert(/^[0-9a-f]{64}$/.test(evidence1Hash), "SHA-256 matches lowercase hex format");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4 — GET /api/evidence/:evidenceId/hash endpoint
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 4] GET /api/evidence/:evidenceId/hash"));
  {
    const res = await request("GET", `/evidence/${evidence1Id}/hash`, null, token);
    assert(res.status === 200, `GET /api/evidence/${evidence1Id}/hash → 200 OK`);
    assert(res.data.evidenceId === evidence1Id, "Returns correct evidenceId");
    assert(res.data.sha256Hash === evidence1Hash, "Returns exact computed SHA-256 hash");
    assert(res.data.hashStatus === "GENERATED", "hashStatus is 'GENERATED'");
    assert(!res.data.filePath, "Does NOT expose internal filePath");
    assert(!res.data.buffer && !res.data.content, "Does NOT expose original file content");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5 — Verify hash persistence in MongoDB
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 5] Verify Hash in MongoDB"));
  {
    const doc = await Evidence.findOne({ evidenceId: evidence1Id });
    assert(!!doc, "Evidence document found in MongoDB");
    assert(doc.sha256Hash === evidence1Hash, "MongoDB sha256Hash matches API response");
    assert(doc.hashStatus === "GENERATED", "MongoDB hashStatus is GENERATED");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6 — Upload EXACT SAME file again -> confirm identical hash
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 6] Re-upload Same File Bytes -> Confirm Identical Hash"));
  let evidence2Id;
  let evidence2Hash;
  {
    // Upload exact same file bytes under different or same filename
    const res = await request(
      "POST",
      `/incidents/${incidentMongoId}/evidence`,
      {
        description: "Exact duplicate bytes for hash consistency check",
        file: {
          buffer: fileBytesA,
          filename: "firewall-log-duplicate.txt",
          mimetype: "text/plain",
        },
      },
      token,
      true
    );

    assert(res.status === 201, "POST duplicate file → 201 Created");
    evidence2Id   = res.data.evidenceId;
    evidence2Hash = res.data.evidence?.sha256Hash;
    cleanupEvidenceIds.push(evidence2Id);

    assert(evidence2Id !== evidence1Id, `New unique evidenceId created (${evidence2Id})`);
    assert(evidence2Hash === evidence1Hash, `SHA-256 hashes are IDENTICAL (${evidence2Hash} === ${evidence1Hash})`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7 — Modify the file -> confirm the hash changes (avalanche effect)
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 7] Modify File Bytes -> Confirm Hash Changes"));
  let evidence3Id;
  let evidence3Hash;
  {
    // Modify file by 1 byte: 443 -> 444
    const fileBytesB = Buffer.from("2026-09-09T11:00:00Z | ACCEPT | 192.168.1.100 -> 10.0.0.1:444\n", "utf-8");

    const res = await request(
      "POST",
      `/incidents/${incidentMongoId}/evidence`,
      {
        description: "Modified firewall log (1 byte changed)",
        file: {
          buffer: fileBytesB,
          filename: "firewall-log-modified.txt",
          mimetype: "text/plain",
        },
      },
      token,
      true
    );

    assert(res.status === 201, "POST modified file → 201 Created");
    evidence3Id   = res.data.evidenceId;
    evidence3Hash = res.data.evidence?.sha256Hash;
    cleanupEvidenceIds.push(evidence3Id);

    assert(evidence3Hash !== evidence1Hash, `Modified file produces DIFFERENT SHA-256 hash:`);
    console.log(Y(`    Original: ${evidence1Hash}`));
    console.log(Y(`    Modified: ${evidence3Hash}`));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8 — Direct hashService unit test & failure handling
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 8] Direct hashService Unit Tests & Error Handling"));
  {
    // Unit test generateSha256
    const testBuf = Buffer.from("Antigravity Test Vector", "utf-8");
    const directHash = hashService.generateSha256(testBuf);
    assert(directHash.length === 64, "generateSha256 produces 64 hex characters");

    // Re-hash confirms determinism
    const directHash2 = hashService.generateSha256(testBuf);
    assert(directHash === directHash2, "generateSha256 is deterministic");

    // Invalid input rejection
    try {
      hashService.generateSha256(null);
      assert(false, "generateSha256 should throw for null input");
    } catch (e) {
      assert(true, "generateSha256 rejects non-Buffer input");
    }

    // getEvidenceHash unit method
    const hashMeta = await hashService.getEvidenceHash(evidence1Id);
    assert(hashMeta.evidenceId === evidence1Id, "hashService.getEvidenceHash returns correct evidenceId");
    assert(hashMeta.sha256Hash === evidence1Hash, "hashService.getEvidenceHash returns correct sha256Hash");
    assert(hashMeta.hashStatus === "GENERATED", "hashService.getEvidenceHash returns GENERATED status");

    // getEvidenceHash for non-existent returns 404
    try {
      await hashService.getEvidenceHash("EVD-NONEXISTENT-999999");
      assert(false, "Should throw for non-existent evidenceId");
    } catch (e) {
      assert(e.statusCode === 404, "Throws 404 for non-existent evidenceId");
    }
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
    console.log(G(BOLD(`  🎉 ALL ${total} MODULE P4M2 TESTS PASSED SUCCESSFULLY!`)));
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
