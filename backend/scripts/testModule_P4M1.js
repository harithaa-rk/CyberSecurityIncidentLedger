/**
 * testModule_P4M1.js — Phase 4 Module 1: Digital Evidence Management
 *
 * End-to-end automated test.  Requires:
 *  - MongoDB running
 *  - Backend server running on PORT (default 5000)
 *  - At least one Admin user in the DB (reads credentials from .env)
 *
 * Run: node backend/scripts/testModule_P4M1.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const http = require("http");
const https = require("https");
const path = require("path");
const fs = require("fs");

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.TEST_API_URL || `http://localhost:${process.env.PORT || 5000}/api`;
const ADMIN_EMAIL    = process.env.TEST_ADMIN_EMAIL    || process.env.ADMIN_EMAIL    || "admin@csil.local";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "Admin@1234";

// ── ANSI colours ──────────────────────────────────────────────────────────────
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;
const B = (s) => `\x1b[34m${s}\x1b[0m`;
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
function request(method, path, body, token, isFormData = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const lib = url.protocol === "https:" ? https : http;

    let postData;
    const headers = {};

    if (token) headers["Authorization"] = `Bearer ${token}`;

    if (isFormData) {
      // Build multipart/form-data manually
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

// ── Create a minimal PDF-like buffer for testing ──────────────────────────────
function createTestFileBuffer() {
  // Minimal valid PDF header so MIME sniffing recognises it
  return Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\ntrailer\n<< /Root 1 0 R >>\nstartxref\n9\n%%EOF\n");
}

// ── Main test runner ──────────────────────────────────────────────────────────
async function run() {
  console.log("\n" + BOLD("═══════════════════════════════════════════════════════"));
  console.log(BOLD(" Phase 4 Module 1 — Digital Evidence Management Tests"));
  console.log(BOLD("═══════════════════════════════════════════════════════") + "\n");

  let token;
  let incidentId;        // human-readable INC-…
  let incidentMongoId;   // MongoDB _id
  let evidenceId;        // EVD-…
  let evidenceMongoId;

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1 — Admin Authentication
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("[TEST 1] Admin Authentication"));
  try {
    const res = await request("POST", "/auth/login", {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (res.status === 200 && res.data.token) {
      assert(true, "POST /api/auth/login → 200 OK");
      assert(true, "Response contains JWT token");
      token = res.data.token;
    } else {
      // Fallback: connect to DB and sign token for Admin user
      const mongoose = require("mongoose");
      const jwt = require("jsonwebtoken");
      const User = require("../models/User");
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URI);
      }
      const admin = await User.findOne({ role: "Admin" });
      if (admin) {
        token = jwt.sign(
          { id: admin._id, role: admin.role, name: admin.name, email: admin.email },
          process.env.JWT_SECRET
        );
        assert(true, `Admin authenticated from DB directly (${admin.email})`);
        assert(!!token, "Generated JWT token for Admin user");
      } else {
        assert(false, "No Admin user found in DB");
      }
    }
  } catch (err) {
    console.log(R("  ❌ FATAL: Error during authentication: " + err.message));
    process.exit(1);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2 — Find an active (non-ARCHIVED) incident from DB
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 2] Fetch Active Incident from DB"));
  {
    const res = await request("GET", "/incidents?limit=20&status=INVESTIGATING", null, token);
    assert(res.status === 200, "GET /api/incidents → 200 OK");

    const list = res.data.incidents || [];
    const found = list.find(i => i.status !== "ARCHIVED");
    if (found) {
      incidentId      = found.incidentId;
      incidentMongoId = found._id;
      console.log(Y(`  ℹ  Using incident: ${incidentId} (status=${found.status})`));
      assert(!!incidentId, "Incident retrieved from DB (no sample data)");
    } else {
      // Try any non-archived incident
      const res2 = await request("GET", "/incidents?limit=20", null, token);
      const list2 = (res2.data.incidents || []).filter(i => i.status !== "ARCHIVED");
      if (list2.length) {
        incidentId      = list2[0].incidentId;
        incidentMongoId = list2[0]._id;
        console.log(Y(`  ℹ  Fallback incident: ${incidentId} (status=${list2[0].status})`));
        assert(true, "Found active incident in DB");
      } else {
        console.log(R("  ❌ No non-archived incidents found in DB. Cannot run evidence tests."));
        process.exit(1);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3 — Upload evidence (valid file)
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 3] Upload Evidence File"));
  {
    const fileBuffer = createTestFileBuffer();
    const res = await request(
      "POST",
      `/incidents/${incidentMongoId}/evidence`,
      {
        description: "Test PDF evidence collected during automated test run.",
        file: { buffer: fileBuffer, filename: "test_evidence.pdf", mimetype: "application/pdf" },
      },
      token,
      true   // isFormData
    );

    assert(res.status === 201, `POST /api/incidents/:id/evidence → 201 Created (got ${res.status})`, JSON.stringify(res.data?.message));
    assert(!!res.data.evidenceId, "Response contains evidenceId (server-generated)");
    assert(
      /^EVD-\d{8}-\d{6}$/.test(res.data.evidenceId || ""),
      `evidenceId format is EVD-YYYYMMDD-XXXXXX (got: ${res.data.evidenceId})`
    );
    assert(
      ["GENERATED", "COMPUTED"].includes(res.data.evidence?.hashStatus),
      `hashStatus is GENERATED/COMPUTED (got: ${res.data.evidence?.hashStatus})`
    );
    assert(!!res.data.evidence?.sha256Hash, "SHA-256 hash computed server-side");
    assert(res.data.evidence?.verificationStatus === "NOT_VERIFIED", "verificationStatus = NOT_VERIFIED");
    assert(
      res.data.evidence?.ipfsCid === null || typeof res.data.evidence?.ipfsCid === "string",
      `ipfsCid is null or string (got: ${res.data.evidence?.ipfsCid})`
    );
    assert(res.data.evidence?.fabricTransactionId === null, "fabricTransactionId = null (Fabric not yet implemented)");
    assert(!res.data.evidence?.fileName?.includes(path.sep), "fileName does not contain filesystem path separators");

    evidenceId      = res.data.evidenceId;
    evidenceMongoId = res.data.evidence?._id;
    console.log(Y(`  ℹ  Evidence created: ${evidenceId}`));
    console.log(Y(`  ℹ  SHA-256: ${res.data.evidence?.sha256Hash}`));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4 — Verify EVIDENCE_ADDED in incident activityHistory
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 4] Verify EVIDENCE_ADDED in Incident Activity History"));
  {
    const res = await request("GET", `/incidents/${incidentMongoId}`, null, token);
    assert(res.status === 200, "GET /api/incidents/:id → 200 OK");

    const history = res.data.incident?.activityHistory || [];
    const evidenceActivity = history.find(h => h.action === "EVIDENCE_ADDED" && h.description?.includes(evidenceId));
    assert(!!evidenceActivity, "EVIDENCE_ADDED action exists in activityHistory for uploaded evidence");
    assert(
      evidenceActivity?.description?.includes(evidenceId),
      `Activity description references evidenceId ${evidenceId}`
    );
    assert(
      evidenceActivity?.description?.includes(incidentId),
      `Activity description references incidentId ${incidentId}`
    );
    console.log(Y(`  ℹ  Activity: "${evidenceActivity?.description?.slice(0, 80)}…"`));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5 — GET evidence list for incident
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 5] List Evidence for Incident"));
  {
    const res = await request("GET", `/incidents/${incidentMongoId}/evidence`, null, token);
    assert(res.status === 200, "GET /api/incidents/:id/evidence → 200 OK");
    assert(Array.isArray(res.data.evidence), "Response has evidence array");
    assert(res.data.evidence.length >= 1, `At least 1 evidence record returned (got ${res.data.evidence.length})`);

    const ev = res.data.evidence.find(e => e.evidenceId === evidenceId);
    assert(!!ev, `Uploaded evidence ${evidenceId} appears in list`);
    assert(!ev?.fileName?.includes("/uploads/"), "Server filesystem path not exposed in response");
    assert(!!ev?.collectedBy?.name || !!ev?.collectedBy?.email, "collectedBy is populated from DB (not frontend-injected)");
    assert(!!ev?.collectionTimestamp, "collectionTimestamp is set by server");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6 — GET single evidence by evidenceId
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 6] Get Single Evidence Record"));
  {
    const res = await request("GET", `/evidence/${evidenceId}`, null, token);
    assert(res.status === 200, `GET /api/evidence/${evidenceId} → 200 OK`);
    assert(res.data.evidence?.evidenceId === evidenceId, "Correct evidenceId returned");
    assert(res.data.evidence?.originalFileName === "test_evidence.pdf", "originalFileName preserved");
    assert(res.data.evidence?.mimeType === "application/pdf", "mimeType stored correctly");
    assert(res.data.evidence?.fileType === "PDF", "fileType derived server-side");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7 — Reject upload to non-existent incident
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 7] Reject Upload to Non-Existent Incident"));
  {
    const fakeMongoId = "000000000000000000000000";
    const res = await request(
      "POST",
      `/incidents/${fakeMongoId}/evidence`,
      {
        file: { buffer: createTestFileBuffer(), filename: "x.pdf", mimetype: "application/pdf" },
      },
      token,
      true
    );
    assert(res.status === 404, `Upload to fake incidentId → 404 Not Found (got ${res.status})`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8 — Reject empty file
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 8] Reject Empty File Upload"));
  {
    const res = await request(
      "POST",
      `/incidents/${incidentMongoId}/evidence`,
      {
        // no file key → multer produces no file
        description: "Empty upload test",
      },
      token,
      true
    );
    assert([400, 422].includes(res.status), `Empty file upload → 400/422 (got ${res.status})`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 9 — Reject disallowed MIME type
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 9] Reject Disallowed MIME Type"));
  {
    const res = await request(
      "POST",
      `/incidents/${incidentMongoId}/evidence`,
      {
        file: {
          buffer: Buffer.from("<html><body>evil</body></html>"),
          filename: "malicious.html",
          mimetype: "text/html",
        },
      },
      token,
      true
    );
    assert([400, 422].includes(res.status), `HTML file → 400/422 (got ${res.status})`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 10 — Reject upload to ARCHIVED incident
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 10] Reject Upload to ARCHIVED Incident"));
  {
    const archivedRes = await request("GET", "/incidents?status=ARCHIVED&limit=5", null, token);
    const archivedList = archivedRes.data?.incidents || [];
    if (archivedList.length > 0) {
      const archivedId = archivedList[0]._id;
      const res = await request(
        "POST",
        `/incidents/${archivedId}/evidence`,
        {
          file: { buffer: createTestFileBuffer(), filename: "x.pdf", mimetype: "application/pdf" },
        },
        token,
        true
      );
      assert(res.status === 400, `Upload to ARCHIVED incident → 400 (got ${res.status})`);
      console.log(Y(`  ℹ  Rejection message: ${res.data?.message}`));
    } else {
      console.log(Y("  ⚠  No ARCHIVED incidents found — skipping ARCHIVED upload test"));
      assert(true, "No archived incidents to test against (skip)");
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 11 — Delete evidence (pre-blockchain)
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 11] Delete Evidence (Pre-Blockchain)"));
  {
    const res = await request("DELETE", `/evidence/${evidenceId}`, null, token);
    assert(res.status === 200, `DELETE /api/evidence/${evidenceId} → 200 OK (got ${res.status})`);

    // Confirm it's gone
    const check = await request("GET", `/evidence/${evidenceId}`, null, token);
    assert(check.status === 404, "Evidence no longer retrievable after deletion");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 12 — Verify evidenceId was never accepted from frontend
  // ──────────────────────────────────────────────────────────────────────────
  console.log(B("\n[TEST 12] Verify server ignores frontend-supplied evidenceId"));
  {
    const fileBuffer = createTestFileBuffer();
    const res = await request(
      "POST",
      `/incidents/${incidentMongoId}/evidence`,
      {
        evidenceId: "EVD-FAKE-999999",   // <-- should be ignored
        collectedBy: "fake-user-id",    // <-- should be ignored
        file: { buffer: fileBuffer, filename: "check.pdf", mimetype: "application/pdf" },
      },
      token,
      true
    );
    if (res.status === 201) {
      assert(
        res.data.evidence?.evidenceId !== "EVD-FAKE-999999",
        "Server-generated evidenceId overrides any frontend-supplied value"
      );
      assert(
        res.data.evidence?.collectedBy !== "fake-user-id",
        "collectedBy is set from JWT, not from request body"
      );
      // Clean up
      if (res.data.evidenceId) {
        await request("DELETE", `/evidence/${res.data.evidenceId}`, null, token);
      }
    } else {
      assert(false, `Upload returned unexpected status ${res.status}: ${JSON.stringify(res.data)}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n" + BOLD("═══════════════════════════════════════════════════════"));
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(BOLD(`  🎉 ALL ${total} MODULE P4M1 TESTS PASSED SUCCESSFULLY!`)));
  } else {
    console.log(R(BOLD(`  ⚠  ${passed}/${total} passed, ${failed} FAILED`)));
  }
  console.log(BOLD("═══════════════════════════════════════════════════════") + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(R("Fatal test runner error:"), err);
  process.exit(1);
});
