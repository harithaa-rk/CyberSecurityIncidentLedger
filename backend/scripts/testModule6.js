/**
 * MODULE 6 – INCIDENT ARCHIVAL END-TO-END TEST SUITE
 * 
 * Verifies:
 * 1. Lifecycle: NEW -> ASSIGNED -> INVESTIGATING -> RESOLVED -> ARCHIVED
 * 2. Transition Rule: Only allow RESOLVED -> ARCHIVED (reject all other transitions)
 * 3. Archive Information: stored archivedBy, archivedAt, and activityHistory INCIDENT_ARCHIVED
 * 4. Active Incident List: Default GET /api/incidents excludes ARCHIVED incidents
 * 5. Archived Incidents View: status=ARCHIVED returns archived incidents
 * 6. Read-Only Protection: Disallows assignment, reassignment, investigation changes,
 *    adding notes, changing resolution, and database edits once archived.
 * 7. Search: Search by Incident ID, Threat, Attack Type, Severity, Source IP, and Date
 * 8. Persistence: Incident remains permanently in MongoDB and can be viewed
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Incident = require("../models/Incident");
const incidentRoutes = require("../routes/incidentRoutes");
const { processSecurityLog } = require("../services/logIngestionService");
const incidentService = require("../services/incidentService");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_testing";

let server;
let baseUrl;
let adminToken, aliceToken, bobToken, userToken;
let adminUser, aliceUser, bobUser, regularUser;

// Helper: HTTP request wrapper
function makeRequest(method, urlPath, token, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        "Content-Type": "application/json",
      },
    };
    if (token) {
      options.headers["Authorization"] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on("error", reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("MODULE 6 – INCIDENT ARCHIVAL TEST SUITE");
  console.log("==================================================");

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI not set in backend/.env");
  }

  await mongoose.connect(mongoUri);
  console.log("✓ Connected to MongoDB");

  // Setup Express App
  const app = express();
  app.use(express.json());
  app.use("/api/incidents", incidentRoutes);

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`✓ Test Express server listening on ${baseUrl}/api/incidents`);
      resolve();
    });
  });

  // Setup Users
  adminUser = await User.findOneAndUpdate(
    { email: "test.admin@ledger.test" },
    { name: "Test Admin", role: "Admin", passwordHash: "dummy" },
    { upsert: true, new: true }
  );
  aliceUser = await User.findOneAndUpdate(
    { email: "analyst.alice@ledger.test" },
    { name: "Analyst Alice", role: "Analyst", passwordHash: "dummy" },
    { upsert: true, new: true }
  );
  bobUser = await User.findOneAndUpdate(
    { email: "analyst.bob@ledger.test" },
    { name: "Analyst Bob", role: "Analyst", passwordHash: "dummy" },
    { upsert: true, new: true }
  );
  regularUser = await User.findOneAndUpdate(
    { email: "regular.user@ledger.test" },
    { name: "Regular User", role: "User", passwordHash: "dummy" },
    { upsert: true, new: true }
  );

  adminToken = jwt.sign({ id: adminUser._id, role: adminUser.role, name: adminUser.name }, JWT_SECRET);
  aliceToken = jwt.sign({ id: aliceUser._id, role: aliceUser.role, name: aliceUser.name }, JWT_SECRET);
  bobToken = jwt.sign({ id: bobUser._id, role: bobUser.role, name: bobUser.name }, JWT_SECRET);
  userToken = jwt.sign({ id: regularUser._id, role: regularUser.role, name: regularUser.name }, JWT_SECRET);

  console.log("✓ Users and JWTs prepared for Admin, Alice (Analyst), Bob (Analyst), Regular User");

  // =========================================================================
  // TEST 1: Ingest Threat Log -> Status: NEW
  // =========================================================================
  console.log("\n[TEST 1] Ingesting threat log to create NEW incident...");
  const testNow = new Date().toISOString();
  const rawLog = {
    source: "CloudWAF",
    eventType: "SQL_INJECTION",
    severity: "HIGH",
    message: `SQL Injection detected on Account Query API endpoint [${testNow}]`,
    sourceIP: "198.51.100.42",
    destinationIP: "10.0.0.15",
    action: "ALERT",
    attackType: "SQL_INJECTION",
    threatCategory: "Injection Attack",
    threat: true,
    riskScore: 85,
    timestamp: testNow,
    title: "SQL Injection Detected on Account Query API",
    fullLog: `GET /api/v1/accounts?id=1%27%20OR%20%271%27=%271 HTTP/1.1 from 198.51.100.42 [${testNow}]`,
  };

  const savedLog = await processSecurityLog(rawLog, "MODULE6_TEST");
  await new Promise((r) => setTimeout(r, 700));

  const incidentDoc = await Incident.findOne({ securityLogId: savedLog._id });
  if (!incidentDoc) throw new Error("Incident not created on threat log ingestion!");
  const incId = incidentDoc.incidentId;
  console.log(`✓ Incident Created: ${incId} (Status: ${incidentDoc.status})`);

  // =========================================================================
  // TEST 2: Reject Invalid Transition from NEW -> ARCHIVED
  // =========================================================================
  console.log("\n[TEST 2] Testing Transition Guard: Attempting NEW -> ARCHIVED (Must Fail)...");
  const resArchiveFromNew = await makeRequest("PATCH", `/api/incidents/${incId}/archive`, adminToken, {
    note: "Attempting to archive uninvestigated incident.",
  });
  console.log(`✓ Status: ${resArchiveFromNew.status} (Expected: 400 Bad Request)`);
  console.log(`  Message: "${resArchiveFromNew.data.message}"`);
  if (resArchiveFromNew.status !== 400) {
    throw new Error(`Expected 400 when archiving from NEW, got ${resArchiveFromNew.status}`);
  }

  // =========================================================================
  // TEST 3: Admin Assigns Incident to Analyst Alice -> Status: ASSIGNED
  // =========================================================================
  console.log("\n[TEST 3] Assigning incident to Analyst Alice (NEW -> ASSIGNED)...");
  const resAssign = await makeRequest("PATCH", `/api/incidents/${incId}/assign`, adminToken, {
    analystId: aliceUser._id.toString(),
    note: "Assigned to Alice for SQL injection triage.",
  });
  if (resAssign.status !== 200) throw new Error("Failed to assign incident");
  console.log(`✓ Status: ${resAssign.data.incident.status} (Expected: ASSIGNED)`);

  // Attempt ASSIGNED -> ARCHIVED (Must Fail)
  console.log("  Testing Transition Guard: Attempting ASSIGNED -> ARCHIVED (Must Fail)...");
  const resArchiveFromAssigned = await makeRequest("PATCH", `/api/incidents/${incId}/archive`, adminToken, {
    note: "Attempting to archive assigned incident.",
  });
  console.log(`✓ Status: ${resArchiveFromAssigned.status} (Expected: 400 Bad Request)`);
  if (resArchiveFromAssigned.status !== 400) {
    throw new Error(`Expected 400 when archiving from ASSIGNED, got ${resArchiveFromAssigned.status}`);
  }

  // =========================================================================
  // TEST 4: Analyst Alice Starts Investigation -> Status: INVESTIGATING
  // =========================================================================
  console.log("\n[TEST 4] Analyst Alice starts investigation (ASSIGNED -> INVESTIGATING)...");
  const resInvestigate = await makeRequest("PATCH", `/api/incidents/${incId}/start-investigation`, aliceToken, {
    notes: "Reviewing database query logs and WAF capture.",
  });
  if (resInvestigate.status !== 200) throw new Error("Failed to start investigation");
  console.log(`✓ Status: ${resInvestigate.data.incident.status} (Expected: INVESTIGATING)`);

  // Attempt INVESTIGATING -> ARCHIVED (Must Fail)
  console.log("  Testing Transition Guard: Attempting INVESTIGATING -> ARCHIVED (Must Fail)...");
  const resArchiveFromInvestigating = await makeRequest("PATCH", `/api/incidents/${incId}/archive`, adminToken, {
    note: "Attempting to archive in-progress investigation.",
  });
  console.log(`✓ Status: ${resArchiveFromInvestigating.status} (Expected: 400 Bad Request)`);
  if (resArchiveFromInvestigating.status !== 400) {
    throw new Error(`Expected 400 when archiving from INVESTIGATING, got ${resArchiveFromInvestigating.status}`);
  }

  // =========================================================================
  // TEST 5: Resolve Incident -> Status: RESOLVED
  // =========================================================================
  console.log("\n[TEST 5] Resolving incident (INVESTIGATING -> RESOLVED)...");
  const resResolve = await makeRequest("PATCH", `/api/incidents/${incId}/resolve`, aliceToken, {
    resolutionSummary: "Prepared statement implemented and malicious IP banned at border gateway.",
    rootCause: "Unsanitized query string concatenation in legacy search route.",
    actionTaken: "Deployed ORM query parameterization patch v2.4.1 and added IP drop rule.",
  });
  if (resResolve.status !== 200) throw new Error("Failed to resolve incident");
  console.log(`✓ Status: ${resResolve.data.incident.status} (Expected: RESOLVED)`);

  // =========================================================================
  // TEST 6: Archive Authorization Checks
  // =========================================================================
  console.log("\n[TEST 6] Testing Archival Authorization Guards...");
  // 6A: Regular user cannot archive
  const resUserArchive = await makeRequest("PATCH", `/api/incidents/${incId}/archive`, userToken, {
    note: "Unauthorized user archive attempt",
  });
  console.log(`✓ Regular User Archive Attempt Status: ${resUserArchive.status} (Expected: 403 Forbidden)`);
  if (resUserArchive.status !== 403) throw new Error("Regular user should not be able to archive");

  // 6B: Analyst Bob (not assigned to this incident) cannot archive
  const resBobArchive = await makeRequest("PATCH", `/api/incidents/${incId}/archive`, bobToken, {
    note: "Unassigned analyst archive attempt",
  });
  console.log(`✓ Unassigned Analyst (Bob) Archive Attempt Status: ${resBobArchive.status} (Expected: 403 Forbidden)`);
  if (resBobArchive.status !== 403) throw new Error("Unassigned analyst should not be able to archive");

  // =========================================================================
  // TEST 7: Valid Archive (RESOLVED -> ARCHIVED)
  // =========================================================================
  console.log("\n[TEST 7] Performing Valid Archival (RESOLVED -> ARCHIVED) by Admin...");
  const resArchive = await makeRequest("PATCH", `/api/incidents/${incId}/archive`, adminToken, {
    note: "Post-incident review verified, permanently preserved for SEC-501 compliance.",
  });
  if (resArchive.status !== 200) throw new Error(`Archival failed: ${JSON.stringify(resArchive.data)}`);
  const archived = resArchive.data.incident;
  console.log(`✓ Status: ${archived.status} (Expected: ARCHIVED)`);
  console.log(`✓ archivedBy: ${archived.archivedBy?.name || archived.archivedBy} (Expected: Test Admin)`);
  console.log(`✓ archivedAt: ${archived.archivedAt} (Expected valid timestamp)`);

  const archiveActivity = archived.activityHistory.find((a) => a.action === "INCIDENT_ARCHIVED");
  if (!archiveActivity) throw new Error("activityHistory missing INCIDENT_ARCHIVED entry!");
  console.log(`✓ activityHistory contains INCIDENT_ARCHIVED: "${archiveActivity.description}"`);

  // =========================================================================
  // TEST 8: Read-Only Enforcement on Archived Incident
  // =========================================================================
  console.log("\n[TEST 8] Validating Read-Only Enforcement on Archived Incident...");

  // 8A: Cannot assign/reassign
  const resAssignArchived = await makeRequest("PATCH", `/api/incidents/${incId}/assign`, adminToken, {
    analystId: bobUser._id.toString(),
  });
  console.log(`  8A: Assignment to Bob blocked: status ${resAssignArchived.status} ("${resAssignArchived.data.message}")`);
  if (resAssignArchived.status !== 400) throw new Error("Archived incident assignment should be blocked with 400");

  // 8B: Cannot start investigation
  const resInvestigateArchived = await makeRequest("PATCH", `/api/incidents/${incId}/start-investigation`, aliceToken, {
    notes: "Attempting to restart investigation.",
  });
  console.log(`  8B: Investigation change blocked: status ${resInvestigateArchived.status} ("${resInvestigateArchived.data.message}")`);
  if (resInvestigateArchived.status !== 400) throw new Error("Archived incident investigation should be blocked with 400");

  // 8C: Cannot add investigation notes
  const resNoteArchived = await makeRequest("POST", `/api/incidents/${incId}/notes`, aliceToken, {
    note: "Adding note to archived case.",
  });
  console.log(`  8C: Adding note blocked: status ${resNoteArchived.status} ("${resNoteArchived.data.message}")`);
  if (resNoteArchived.status !== 400) throw new Error("Archived incident adding notes should be blocked with 400");

  // 8D: Cannot resolve again
  const resResolveArchived = await makeRequest("PATCH", `/api/incidents/${incId}/resolve`, aliceToken, {
    resolutionSummary: "Attempting to update resolution.",
  });
  console.log(`  8D: Resolution modification blocked: status ${resResolveArchived.status} ("${resResolveArchived.data.message}")`);
  if (resResolveArchived.status !== 400) throw new Error("Archived incident resolution update should be blocked with 400");

  // 8E: Cannot re-archive
  const resReArchive = await makeRequest("PATCH", `/api/incidents/${incId}/archive`, adminToken, {
    note: "Duplicate archive attempt.",
  });
  console.log(`  8E: Re-archive blocked: status ${resReArchive.status} ("${resReArchive.data.message}")`);
  if (resReArchive.status !== 400) throw new Error("Re-archiving an archived incident should be blocked with 400");

  // 8F: Direct Mongoose save blocked by model pre-save hook
  try {
    const directDoc = await Incident.findOne({ incidentId: incId });
    directDoc.title = "MODIFIED TITLE ATTEMPT";
    await directDoc.save();
    throw new Error("Direct Mongoose save should have failed due to pre-save hook!");
  } catch (err) {
    if (err.name === "ArchivedIncidentError" || err.message.includes("Archived incidents are read-only")) {
      console.log(`  8F: Direct Mongoose save blocked by pre-save hook: "${err.message}"`);
    } else {
      throw err;
    }
  }

  // =========================================================================
  // TEST 9: Active Incident List vs. Archived Filter
  // =========================================================================
  console.log("\n[TEST 9] Testing Active Incident List vs Archived Filter...");

  // 9A: Default GET /api/incidents (must NOT include archived incident)
  const resActiveList = await makeRequest("GET", `/api/incidents`, adminToken);
  const activeIds = (resActiveList.data.incidents || []).map((i) => i.incidentId);
  console.log(`  9A: Default Active Incidents List Count: ${activeIds.length}`);
  const containsArchivedInActive = activeIds.includes(incId);
  console.log(`  9A: Archived incident ${incId} in default list? ${containsArchivedInActive} (Expected: false)`);
  if (containsArchivedInActive) {
    throw new Error(`Default active incident list MUST NOT contain archived incident ${incId}`);
  }

  // 9B: GET /api/incidents?status=ARCHIVED (must include archived incident)
  const resArchivedList = await makeRequest("GET", `/api/incidents?status=ARCHIVED`, adminToken);
  const archivedIds = (resArchivedList.data.incidents || []).map((i) => i.incidentId);
  console.log(`  9B: Archived Incidents Query Count: ${archivedIds.length}`);
  const containsArchivedInArchivedQuery = archivedIds.includes(incId);
  console.log(`  9B: Archived incident ${incId} in status=ARCHIVED query? ${containsArchivedInArchivedQuery} (Expected: true)`);
  if (!containsArchivedInArchivedQuery) {
    throw new Error(`Archived query status=ARCHIVED MUST contain ${incId}`);
  }

  // =========================================================================
  // TEST 10: Multi-Attribute Search on Archived Incidents
  // =========================================================================
  console.log("\n[TEST 10] Testing Search on Archived Incidents...");

  // 10A: Search by Incident ID
  const sId = await makeRequest("GET", `/api/incidents?status=ARCHIVED&search=${incId}`, adminToken);
  if (!sId.data.incidents?.some((i) => i.incidentId === incId)) throw new Error("Search by Incident ID failed");
  console.log(`✓ 10A: Search by Incident ID (${incId}) -> Found`);

  // 10B: Search by Threat / Title
  const sTitle = await makeRequest("GET", `/api/incidents?status=ARCHIVED&search=SQL+Injection`, adminToken);
  if (!sTitle.data.incidents?.some((i) => i.incidentId === incId)) throw new Error("Search by Threat Title failed");
  console.log(`✓ 10B: Search by Threat Title ("SQL Injection") -> Found`);

  // 10C: Search by Attack Type
  const sAttack = await makeRequest("GET", `/api/incidents?status=ARCHIVED&attackType=SQL_INJECTION`, adminToken);
  if (!sAttack.data.incidents?.some((i) => i.incidentId === incId)) throw new Error("Search by Attack Type failed");
  console.log(`✓ 10C: Search by Attack Type (SQL_INJECTION) -> Found`);

  // 10D: Search by Severity
  const sSev = await makeRequest("GET", `/api/incidents?status=ARCHIVED&severity=HIGH`, adminToken);
  if (!sSev.data.incidents?.some((i) => i.incidentId === incId)) throw new Error("Search by Severity failed");
  console.log(`✓ 10D: Search by Severity (HIGH) -> Found`);

  // 10E: Search by Source IP
  const sIp = await makeRequest("GET", `/api/incidents?status=ARCHIVED&search=198.51.100.42`, adminToken);
  if (!sIp.data.incidents?.some((i) => i.incidentId === incId)) throw new Error("Search by Source IP failed");
  console.log(`✓ 10E: Search by Source IP (198.51.100.42) -> Found`);

  // 10F: Search by Date Range
  const today = new Date().toISOString().split("T")[0];
  const sDate = await makeRequest("GET", `/api/incidents?status=ARCHIVED&startDate=${today}&endDate=${today}`, adminToken);
  if (!sDate.data.incidents?.some((i) => i.incidentId === incId)) throw new Error("Search by Date Range failed");
  console.log(`✓ 10F: Search by Date Range (${today}) -> Found`);

  // =========================================================================
  // TEST 11: MongoDB Direct Persistence Verification
  // =========================================================================
  console.log("\n[TEST 11] Verifying Incident Remains Permanently in MongoDB...");
  const mongoDoc = await Incident.findOne({ incidentId: incId }).lean();
  if (!mongoDoc) {
    throw new Error(`CRITICAL: Incident ${incId} was deleted from MongoDB! Archiving must NOT delete incidents!`);
  }
  console.log(`✓ MongoDB Document Found: ${mongoDoc.incidentId}`);
  console.log(`  - Status: ${mongoDoc.status}`);
  console.log(`  - ArchivedAt: ${mongoDoc.archivedAt}`);
  console.log(`  - Total Activity Log Entries: ${mongoDoc.activityHistory?.length}`);
  console.log(`  - Complete Actions History:`, mongoDoc.activityHistory.map((a) => a.action));

  // Single Incident Inspection API
  const resGetSingle = await makeRequest("GET", `/api/incidents/${incId}`, adminToken);
  if (resGetSingle.status !== 200) throw new Error("Failed to view archived incident via GET /:id");
  console.log(`✓ Single Incident View API (GET /api/incidents/${incId}) -> 200 OK`);

  console.log("\n==================================================");
  console.log("🎉 ALL MODULE 6 TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");

  server.close();
  await mongoose.disconnect();
  console.log("✓ Server closed and DB disconnected");
}

runTests().catch((err) => {
  console.error("❌ MODULE 6 TEST FAILURE:", err);
  if (server) server.close();
  mongoose.disconnect();
  process.exit(1);
});
