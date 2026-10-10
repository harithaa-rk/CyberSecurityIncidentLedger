const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Incident = require("../models/Incident");
const SecurityLog = require("../models/SecurityLog");
const { processSecurityLog } = require("../services/logIngestionService");
const {
  listIncidents,
  getIncidentById,
  assignIncident,
  startInvestigation,
  addInvestigationNote,
  getEligibleAnalysts,
} = require("../services/incidentService");

async function runModule3Tests() {
  console.log("==================================================");
  console.log("MODULE 3 – INCIDENT ASSIGNMENT & INVESTIGATION TESTS");
  console.log("==================================================");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✓ Connected to MongoDB");

  try {
    // ── STEP 0: Set up Users (Admin, Analyst A, Analyst B, Regular User) ──
    const passwordHash = await bcrypt.hash("Password123!", 10);

    const adminUser = await User.findOneAndUpdate(
      { email: "test.admin@ledger.test" },
      { name: "Test Admin", email: "test.admin@ledger.test", password: passwordHash, role: "Admin", isActive: true },
      { upsert: true, new: true }
    );
    console.log(`✓ Admin user ready: ${adminUser.name} (${adminUser._id})`);

    const analystA = await User.findOneAndUpdate(
      { email: "analyst.alice@ledger.test" },
      { name: "Analyst Alice", email: "analyst.alice@ledger.test", password: passwordHash, role: "Analyst", isActive: true },
      { upsert: true, new: true }
    );
    console.log(`✓ Analyst A ready: ${analystA.name} (${analystA._id})`);

    const analystB = await User.findOneAndUpdate(
      { email: "analyst.bob@ledger.test" },
      { name: "Analyst Bob", email: "analyst.bob@ledger.test", password: passwordHash, role: "Analyst", isActive: true },
      { upsert: true, new: true }
    );
    console.log(`✓ Analyst B ready: ${analystB.name} (${analystB._id})`);

    const regularUser = await User.findOneAndUpdate(
      { email: "regular.user@ledger.test" },
      { name: "Regular User", email: "regular.user@ledger.test", password: passwordHash, role: "User", isActive: true },
      { upsert: true, new: true }
    );
    console.log(`✓ Regular User ready: ${regularUser.name} (${regularUser.role})`);

    // Verify getEligibleAnalysts returns only Analyst role
    const eligibleAnalysts = await getEligibleAnalysts();
    const nonAnalystInList = eligibleAnalysts.find(a => a.role !== "Analyst");
    if (nonAnalystInList) {
      throw new Error(`getEligibleAnalysts returned non-analyst user: ${nonAnalystInList.name} (${nonAnalystInList.role})`);
    }
    console.log(`✓ getEligibleAnalysts validated: all ${eligibleAnalysts.length} returned users have role 'Analyst'`);

    // ── STEP 1: Admin creates threat → Incident NEW ──
    console.log("\n[TEST 1] Admin creates threat → Incident NEW");
    const testTimestamp = new Date().toISOString();
    const rawLog = `${testTimestamp} | Snort | SQL_INJECTION | CRITICAL | 198.51.100.42 | 10.0.0.15 | 44123 | 443 | TCP | Automated penetration attempt detected in SQL payload`;

    const savedLog = await processSecurityLog({
      source: "Snort",
      attackType: "SQL_INJECTION",
      severity: "CRITICAL",
      threat: true,
      threatCategory: "Injection Attack",
      riskScore: 92,
      sourceIP: "198.51.100.42",
      destinationIP: "10.0.0.15",
      sourcePort: 44123,
      destinationPort: 443,
      protocol: "TCP",
      message: "Automated penetration attempt detected in SQL payload",
      timestamp: testTimestamp,
      rawLog,
    }, "MODULE3_TEST");

    // Wait a brief moment for async incident creation
    await new Promise((r) => setTimeout(r, 600));

    const incident = await Incident.findOne({ securityLogId: savedLog._id });
    if (!incident) {
      throw new Error(`Incident was not auto-created for SecurityLog ${savedLog.incidentId}`);
    }

    console.log(`✓ Incident Created: ${incident.incidentId}`);
    console.log(`  - Status: ${incident.status} (Expected: NEW)`);
    console.log(`  - assignedTo: ${incident.assignedTo} (Expected: null)`);
    if (incident.status !== "NEW") throw new Error(`Expected status NEW, got ${incident.status}`);
    if (incident.assignedTo !== null) throw new Error(`Expected assignedTo null, got ${incident.assignedTo}`);

    // ── STEP 2: Unassigned Incidents Filter ──
    console.log("\n[TEST 2] Query Unassigned Incidents (assignedTo=unassigned)");
    const unassignedQuery = await listIncidents({ assignedTo: "unassigned" });
    const foundInUnassigned = unassignedQuery.incidents.some(i => i.incidentId === incident.incidentId);
    if (!foundInUnassigned) {
      throw new Error("Newly created incident was not found in assignedTo=unassigned query!");
    }
    console.log(`✓ Incident ${incident.incidentId} successfully returned in unassigned query`);

    // ── STEP 3: Assign incident to non-analyst must fail ──
    console.log("\n[TEST 3] Role Validation: Attempt to assign to non-analyst user");
    let assignmentFailedAsExpected = false;
    try {
      await assignIncident(incident.incidentId, {
        analystId: regularUser._id,
        assignedByUserId: adminUser._id,
        assignedByName: adminUser.name,
      });
    } catch (err) {
      assignmentFailedAsExpected = true;
      console.log(`✓ Assignment to non-analyst rejected as expected: "${err.message}"`);
    }
    if (!assignmentFailedAsExpected) {
      throw new Error("Validation failed! An incident was assigned to a non-analyst user.");
    }

    // ── STEP 4: Admin assigns incident to Analyst Alice → Incident ASSIGNED ──
    console.log("\n[TEST 4] Admin assigns Analyst Alice → Incident ASSIGNED");
    const assignedIncident = await assignIncident(incident.incidentId, {
      analystId: analystA._id,
      assignedByUserId: adminUser._id,
      assignedByName: adminUser.name,
      note: "Please triage immediately.",
    });

    console.log(`✓ Incident Status: ${assignedIncident.status} (Expected: ASSIGNED)`);
    console.log(`  - Assigned To: ${assignedIncident.assignedTo?.name} (${assignedIncident.assignedTo?._id})`);
    console.log(`  - Assigned By: ${assignedIncident.assignedBy?.name}`);
    console.log(`  - Assigned At: ${assignedIncident.assignedAt}`);
    if (assignedIncident.status !== "ASSIGNED") throw new Error(`Expected status ASSIGNED, got ${assignedIncident.status}`);
    if (assignedIncident.assignedTo?._id.toString() !== analystA._id.toString()) {
      throw new Error(`Expected assignedTo ${analystA._id}, got ${assignedIncident.assignedTo?._id}`);
    }

    // Verify activityHistory recorded INCIDENT_ASSIGNED
    const assignHistory = assignedIncident.activityHistory.find(h => h.action === "INCIDENT_ASSIGNED");
    if (!assignHistory) throw new Error("INCIDENT_ASSIGNED action missing from activityHistory");
    console.log(`✓ Activity History contains INCIDENT_ASSIGNED: "${assignHistory.note}"`);

    // ── STEP 5: Reassignment: Admin reassigns from Analyst Alice to Analyst Bob ──
    console.log("\n[TEST 5] Reassignment: Admin reassigns from Analyst Alice to Analyst Bob");
    const previousHistoryCount = assignedIncident.activityHistory.length;
    const reassignedIncident = await assignIncident(incident.incidentId, {
      analystId: analystB._id,
      assignedByUserId: adminUser._id,
      assignedByName: adminUser.name,
      note: "Workload balancing.",
    });

    console.log(`✓ Reassigned To: ${reassignedIncident.assignedTo?.name} (${reassignedIncident.assignedTo?._id})`);
    if (reassignedIncident.assignedTo?._id.toString() !== analystB._id.toString()) {
      throw new Error(`Expected assignedTo Bob (${analystB._id}), got ${reassignedIncident.assignedTo?._id}`);
    }

    // Verify history preserved and INCIDENT_REASSIGNED recorded
    const reassignHistory = reassignedIncident.activityHistory.find(h => h.action === "INCIDENT_REASSIGNED");
    if (!reassignHistory) throw new Error("INCIDENT_REASSIGNED action missing from activityHistory");
    if (reassignedIncident.activityHistory.length <= previousHistoryCount) {
      throw new Error("Activity history was truncated or lost during reassignment!");
    }
    console.log(`✓ Reassignment recorded in activityHistory without losing history: "${reassignHistory.note}"`);

    // ── STEP 6: Authorization check: Analyst Alice cannot view incident now assigned to Bob ──
    console.log("\n[TEST 6] Authorization Guard: Verify Analyst Alice cannot access Bob's incident");
    // Simulate what getIncident does for an Analyst
    const freshDoc = await getIncidentById(incident.incidentId);
    const assignedId = freshDoc.assignedTo?._id?.toString() || freshDoc.assignedTo?.toString();
    const aliceAuthorized = assignedId === analystA._id.toString();
    const bobAuthorized = assignedId === analystB._id.toString();

    if (aliceAuthorized) {
      throw new Error("Security breach: Alice is considered authorized for Bob's incident!");
    }
    if (!bobAuthorized) {
      throw new Error("Bob should be authorized for this incident!");
    }
    console.log(`✓ Authorization verified: Alice blocked (authorized: ${aliceAuthorized}), Bob permitted (authorized: ${bobAuthorized})`);

    // ── STEP 7: Analyst Bob starts investigation → Incident INVESTIGATING ──
    console.log("\n[TEST 7] Analyst Bob starts investigation → Incident INVESTIGATING");
    const investigatingIncident = await startInvestigation(incident.incidentId, {
      userId: analystB._id,
      userName: analystB.name,
      notes: "Beginning payload deobfuscation and IP reputation check.",
    });

    console.log(`✓ Status: ${investigatingIncident.status} (Expected: INVESTIGATING)`);
    console.log(`  - investigationStartedAt: ${investigatingIncident.investigationStartedAt}`);
    if (investigatingIncident.status !== "INVESTIGATING") {
      throw new Error(`Expected status INVESTIGATING, got ${investigatingIncident.status}`);
    }
    if (!investigatingIncident.investigationStartedAt) {
      throw new Error("investigationStartedAt was not recorded!");
    }

    const startHistory = investigatingIncident.activityHistory.find(h => h.action === "INVESTIGATION_STARTED");
    if (!startHistory) throw new Error("INVESTIGATION_STARTED action missing from activityHistory");
    console.log(`✓ Activity History contains INVESTIGATION_STARTED: "${startHistory.note}"`);

    // ── STEP 8: Analyst Bob adds investigation notes ──
    console.log("\n[TEST 8] Analyst Bob records investigation notes");
    const notedIncident = await addInvestigationNote(incident.incidentId, {
      note: "Confirmed command injection pattern in user agent header.",
      userName: analystB.name,
    });

    if (!notedIncident.investigationNotes.includes("Confirmed command injection pattern")) {
      throw new Error("investigationNotes does not contain added note!");
    }
    const noteHistory = notedIncident.activityHistory.find(h => h.action === "NOTE_ADDED");
    if (!noteHistory) throw new Error("NOTE_ADDED action missing from activityHistory");
    console.log(`✓ Investigation note recorded and added to audit history: "${noteHistory.note}"`);

    console.log("\n==================================================");
    console.log("🎉 ALL MODULE 3 TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");

  } finally {
    await mongoose.disconnect();
    console.log("✓ Disconnected from MongoDB");
  }
}

runModule3Tests().catch((err) => {
  console.error("❌ MODULE 3 TEST FAILED:", err);
  process.exit(1);
});
