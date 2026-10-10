const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");
const http = require("http");

const User = require("../models/User");
const Incident = require("../models/Incident");
const incidentRoutes = require("../routes/incidentRoutes");
const { processSecurityLog } = require("../services/logIngestionService");
const {
  assignIncident,
  startInvestigation,
} = require("../services/incidentService");

async function runModule4Tests() {
  console.log("==================================================");
  console.log("MODULE 4 – INVESTIGATION NOTES & ACTIVITY TRACKING TESTS");
  console.log("==================================================");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✓ Connected to MongoDB");

  // Setup Express server for HTTP API testing
  const app = express();
  app.use(express.json());
  app.use("/api/incidents", incidentRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/incidents`;
  console.log(`✓ Test Express server listening on ${baseUrl}`);

  try {
    // ── USERS SETUP ──
    const adminUser = await User.findOne({ role: "Admin" });
    const analystAlice = await User.findOne({ email: "analyst.alice@ledger.test" });
    const analystBob = await User.findOne({ email: "analyst.bob@ledger.test" });
    const regularUser = await User.findOne({ role: "User" });

    const adminToken = jwt.sign({ id: adminUser._id, role: "Admin", email: adminUser.email, name: adminUser.name }, process.env.JWT_SECRET);
    const aliceToken = jwt.sign({ id: analystAlice._id, role: "Analyst", email: analystAlice.email, name: analystAlice.name }, process.env.JWT_SECRET);
    const bobToken = jwt.sign({ id: analystBob._id, role: "Analyst", email: analystBob.email, name: analystBob.name }, process.env.JWT_SECRET);
    const userToken = jwt.sign({ id: regularUser._id, role: "User", email: regularUser.email, name: regularUser.name }, process.env.JWT_SECRET);

    // ── 1. Create a Threat Incident ──
    console.log("\n[TEST 1] Creating a new Threat Incident...");
    const testTimestamp = new Date().toISOString();
    const rawLog = `${testTimestamp} | Firewall | BRUTE_FORCE | HIGH | 203.0.113.88 | 10.0.0.22 | 52100 | 22 | TCP | Repeated failed SSH login attempts detected`;

    const savedLog = await processSecurityLog({
      source: "Firewall",
      attackType: "BRUTE_FORCE",
      severity: "HIGH",
      threat: true,
      threatCategory: "Credential Attack",
      riskScore: 78,
      sourceIP: "203.0.113.88",
      destinationIP: "10.0.0.22",
      sourcePort: 52100,
      destinationPort: 22,
      protocol: "TCP",
      message: "Repeated failed SSH login attempts detected",
      timestamp: testTimestamp,
      rawLog,
    }, "MODULE4_TEST");

    await new Promise((r) => setTimeout(r, 600));

    const incident = await Incident.findOne({ securityLogId: savedLog._id });
    if (!incident) throw new Error("Incident creation failed");
    console.log(`✓ Incident Created: ${incident.incidentId}`);

    // Verify activityHistory has action, description, performedBy, performedAt
    const createEntry = incident.activityHistory[0];
    console.log("✓ Validating INCIDENT_CREATED activity entry schema:");
    console.log(`  - action: ${createEntry.action}`);
    console.log(`  - description: "${createEntry.description}"`);
    console.log(`  - performedBy: ${createEntry.performedBy}`);
    console.log(`  - performedAt: ${createEntry.performedAt}`);
    if (!createEntry.action || !createEntry.description || !createEntry.performedBy || !createEntry.performedAt) {
      throw new Error("activityHistory entry missing required fields (action, description, performedBy, performedAt)");
    }

    // ── 2. Admin Assigns Incident to Analyst Alice ──
    console.log("\n[TEST 2] Admin Assigns Incident to Analyst Alice");
    await assignIncident(incident.incidentId, {
      analystId: analystAlice._id,
      assignedByUserId: adminUser._id,
      assignedByName: adminUser.name,
      note: "Investigate brute-force source IP.",
    });

    // ── 3. Reassignment to Analyst Bob ──
    console.log("\n[TEST 3] Admin Reassigns Incident to Analyst Bob");
    await assignIncident(incident.incidentId, {
      analystId: analystBob._id,
      assignedByUserId: adminUser._id,
      assignedByName: adminUser.name,
      note: "Reassigned to Bob for SSH credential audit.",
    });

    // ── 4. Analyst Bob Starts Investigation ──
    console.log("\n[TEST 4] Analyst Bob Starts Investigation");
    await startInvestigation(incident.incidentId, {
      userId: analystBob._id,
      userName: analystBob.name,
      notes: "Pulling auth.log from target bastion host.",
    });

    // ── 5. Add Investigation Notes via POST /api/incidents/:id/notes ──
    console.log("\n[TEST 5] Adding Investigation Notes via POST /api/incidents/:id/notes");

    // 5A: Validate empty note is rejected
    console.log("  5A: Empty note rejection test...");
    const emptyNoteRes = await fetch(`${baseUrl}/${incident.incidentId}/notes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bobToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ note: "   " }),
    });
    console.log(`  ✓ Status: ${emptyNoteRes.status} (Expected: 400 Bad Request)`);
    if (emptyNoteRes.status !== 400) throw new Error("Expected 400 for empty note!");

    // 5B: Unauthorized user (Alice) cannot add note to Bob's incident
    console.log("  5B: Unauthorized analyst (Alice) attempting to add note...");
    const unauthorizedRes = await fetch(`${baseUrl}/${incident.incidentId}/notes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${aliceToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Unauthorized note attempt by Alice" }),
    });
    console.log(`  ✓ Status: ${unauthorizedRes.status} (Expected: 403 Forbidden)`);
    if (unauthorizedRes.status !== 403) throw new Error("Expected 403 for unauthorized note addition!");

    // 5C: Non-analyst / regular user cannot add notes
    console.log("  5C: Regular user attempting to add note...");
    const regularUserRes = await fetch(`${baseUrl}/${incident.incidentId}/notes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Regular user note attempt" }),
    });
    console.log(`  ✓ Status: ${regularUserRes.status} (Expected: 403 Forbidden)`);
    if (regularUserRes.status !== 403) throw new Error("Expected 403 for non-analyst note addition!");

    // 5D: Assigned analyst (Bob) adds first note
    console.log("  5D: Assigned Analyst Bob adding Note 1...");
    const note1Res = await fetch(`${baseUrl}/${incident.incidentId}/notes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bobToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Source IP 203.0.113.88 has attempted 142 failed logins across root, admin, and test users." }),
    });
    console.log(`  ✓ Status: ${note1Res.status} (Expected: 201 Created)`);
    if (note1Res.status !== 201) throw new Error("Expected 201 from note 1 addition");

    // 5E: Assigned analyst (Bob) adds second note
    console.log("  5E: Assigned Analyst Bob adding Note 2...");
    const note2Res = await fetch(`${baseUrl}/${incident.incidentId}/notes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bobToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Edge firewall ACL rule added to drop all packets from 203.0.113.88." }),
    });
    console.log(`  ✓ Status: ${note2Res.status} (Expected: 201 Created)`);
    if (note2Res.status !== 201) throw new Error("Expected 201 from note 2 addition");

    // 5F: Admin adds a note
    console.log("  5F: Admin adding oversight Note 3...");
    const note3Res = await fetch(`${baseUrl}/${incident.incidentId}/notes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Admin verification: Confirming IP block in cloud gateway." }),
    });
    console.log(`  ✓ Status: ${note3Res.status} (Expected: 201 Created)`);
    if (note3Res.status !== 201) throw new Error("Expected 201 from note 3 addition");

    // ── 6. Verify Chronological Notes Storage ──
    console.log("\n[TEST 6] Validating Chronological Notes Storage...");
    const updatedIncident = await Incident.findOne({ incidentId: incident.incidentId });
    if (!updatedIncident.notes || updatedIncident.notes.length !== 3) {
      throw new Error(`Expected 3 structured notes, found ${updatedIncident.notes?.length}`);
    }

    console.log("✓ Notes stored in chronological order:");
    updatedIncident.notes.forEach((n, idx) => {
      console.log(`  Note #${idx + 1}:`);
      console.log(`    - Author: ${n.author}`);
      console.log(`    - Note: "${n.note}"`);
      console.log(`    - Timestamp: ${n.timestamp.toISOString()}`);
    });

    // Verify chronological ordering (t1 <= t2 <= t3)
    const t1 = new Date(updatedIncident.notes[0].timestamp).getTime();
    const t2 = new Date(updatedIncident.notes[1].timestamp).getTime();
    const t3 = new Date(updatedIncident.notes[2].timestamp).getTime();
    if (t1 > t2 || t2 > t3) {
      throw new Error("Notes are not stored in chronological order!");
    }
    console.log("✓ Verified: t1 <= t2 <= t3 (strictly chronological)");

    // ── 7. Verify Immutable Activity History Timeline (Who, What, When) ──
    console.log("\n[TEST 7] Validating Immutable Activity History Timeline...");
    console.log(`Total Activity Events Logged: ${updatedIncident.activityHistory.length}`);

    const expectedActions = [
      "INCIDENT_CREATED",
      "INCIDENT_ASSIGNED",
      "INCIDENT_REASSIGNED",
      "INVESTIGATION_STARTED",
      "NOTE_ADDED",
      "NOTE_ADDED",
      "NOTE_ADDED",
    ];

    const actualActions = updatedIncident.activityHistory.map((h) => h.action);
    console.log("Logged Actions:", actualActions);

    expectedActions.forEach((expAction) => {
      if (!actualActions.includes(expAction)) {
        throw new Error(`Missing expected action in timeline: ${expAction}`);
      }
    });

    // Check each entry has Who, What, When
    updatedIncident.activityHistory.forEach((entry, idx) => {
      if (!entry.action || !entry.description || !entry.performedBy || !entry.performedAt) {
        throw new Error(`Activity entry #${idx} is missing required timeline fields!`);
      }
      console.log(`  ● [${entry.action}] by ${entry.performedBy} at ${new Date(entry.performedAt).toLocaleTimeString()} - "${entry.description.slice(0, 50)}..."`);
    });

    // ── 8. Verify Admin Can View Activity History via GET /api/incidents/:id ──
    console.log("\n[TEST 8] Admin views incident activity history via GET /api/incidents/:id");
    const getIncRes = await fetch(`${baseUrl}/${incident.incidentId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`✓ Status: ${getIncRes.status} (Expected: 200)`);
    const incData = await getIncRes.json();
    if (!incData.incident.activityHistory || incData.incident.activityHistory.length === 0) {
      throw new Error("Admin did not receive activityHistory in GET response");
    }
    console.log(`✓ Admin successfully retrieved all ${incData.incident.activityHistory.length} timeline events`);

    console.log("\n==================================================");
    console.log("🎉 ALL MODULE 4 TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");

  } finally {
    server.close();
    await mongoose.disconnect();
    console.log("✓ Server closed and DB disconnected");
  }
}

runModule4Tests().catch((err) => {
  console.error("❌ MODULE 4 TEST FAILED:", err);
  process.exit(1);
});
