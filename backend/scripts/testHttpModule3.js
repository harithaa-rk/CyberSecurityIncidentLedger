const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");
const http = require("http");

const User = require("../models/User");
const Incident = require("../models/Incident");
const incidentRoutes = require("../routes/incidentRoutes");

async function runHttpIntegrationTest() {
  console.log("==================================================");
  console.log("MODULE 3 – HTTP API INTEGRATION TESTS");
  console.log("==================================================");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✓ Connected to MongoDB");

  // Setup minimal test app with routes
  const app = express();
  app.use(express.json());
  app.use("/api/incidents", incidentRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/incidents`;
  console.log(`✓ Test Express server listening on ${baseUrl}`);

  try {
    // Generate JWT tokens
    const adminUser = await User.findOne({ role: "Admin" });
    const analystA = await User.findOne({ email: "analyst.alice@ledger.test" });
    const analystB = await User.findOne({ email: "analyst.bob@ledger.test" });

    const adminToken = jwt.sign({ id: adminUser._id, role: "Admin", email: adminUser.email, name: adminUser.name }, process.env.JWT_SECRET);
    const aliceToken = jwt.sign({ id: analystA._id, role: "Analyst", email: analystA.email, name: analystA.name }, process.env.JWT_SECRET);
    const bobToken = jwt.sign({ id: analystB._id, role: "Analyst", email: analystB.email, name: analystB.name }, process.env.JWT_SECRET);

    // Find our test incident
    const testIncident = await Incident.findOne().sort({ createdAt: -1 });
    console.log(`✓ Using test incident: ${testIncident.incidentId}`);

    // Test 1: GET /api/incidents?assignedTo=unassigned as Admin
    console.log("\n[HTTP 1] GET /api/incidents?assignedTo=unassigned");
    const unassignedRes = await fetch(`${baseUrl}?assignedTo=unassigned`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`✓ Status: ${unassignedRes.status} (Expected: 200)`);
    if (unassignedRes.status !== 200) throw new Error("Expected 200 from unassigned query");

    // Test 2: Alice attempts to assign incident -> must get 403 (Admin only)
    console.log("\n[HTTP 2] Analyst Alice attempts PATCH /assign (Admin only check)");
    const aliceAssignRes = await fetch(`${baseUrl}/${testIncident.incidentId}/assign`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${aliceToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ analystId: analystA._id }),
    });
    console.log(`✓ Status: ${aliceAssignRes.status} (Expected: 403)`);
    if (aliceAssignRes.status !== 403) throw new Error("Expected 403 when Analyst tries to assign incident");

    // Test 3: Admin assigns incident to Bob via HTTP
    console.log("\n[HTTP 3] Admin assigns incident to Analyst Bob via PATCH /assign");
    const adminAssignRes = await fetch(`${baseUrl}/${testIncident.incidentId}/assign`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ analystId: analystB._id, note: "Assigned via HTTP test" }),
    });
    console.log(`✓ Status: ${adminAssignRes.status} (Expected: 200)`);
    const assignData = await adminAssignRes.json();
    console.log(`  - Message: "${assignData.message}"`);
    console.log(`  - Incident status: ${assignData.incident.status}`);
    if (adminAssignRes.status !== 200) throw new Error("Expected 200 from admin assign");

    // Test 4: Alice attempts to access Bob's incident by URL -> must get 403
    console.log("\n[HTTP 4] Analyst Alice attempts to access Bob's incident by URL");
    const aliceGetRes = await fetch(`${baseUrl}/${testIncident.incidentId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    console.log(`✓ Status: ${aliceGetRes.status} (Expected: 403)`);
    const aliceGetData = await aliceGetRes.json();
    console.log(`  - Rejection message: "${aliceGetData.message}"`);
    if (aliceGetRes.status !== 403) throw new Error("Expected 403 when Analyst accesses unauthorized incident by URL");

    // Test 5: Bob accesses his assigned incident -> must get 200
    console.log("\n[HTTP 5] Analyst Bob accesses his assigned incident");
    const bobGetRes = await fetch(`${baseUrl}/${testIncident.incidentId}`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    console.log(`✓ Status: ${bobGetRes.status} (Expected: 200)`);
    if (bobGetRes.status !== 200) throw new Error("Expected 200 when assigned Analyst accesses incident");

    // Test 6: Bob starts investigation via PATCH /start-investigation
    console.log("\n[HTTP 6] Bob starts investigation via PATCH /api/incidents/:id/start-investigation");
    const startInvRes = await fetch(`${baseUrl}/${testIncident.incidentId}/start-investigation`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${bobToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Starting diagnostic trace over HTTP" }),
    });
    console.log(`✓ Status: ${startInvRes.status} (Expected: 200)`);
    const startInvData = await startInvRes.json();
    console.log(`  - Message: "${startInvData.message}"`);
    console.log(`  - Incident status: ${startInvData.incident.status}`);
    console.log(`  - investigationStartedAt: ${startInvData.incident.investigationStartedAt}`);
    if (startInvRes.status !== 200) throw new Error("Expected 200 from start-investigation");
    if (startInvData.incident.status !== "INVESTIGATING") throw new Error("Expected status INVESTIGATING");

    // Test 7: Bob adds investigation note via PATCH /notes
    console.log("\n[HTTP 7] Bob adds note via PATCH /api/incidents/:id/notes");
    const addNoteRes = await fetch(`${baseUrl}/${testIncident.incidentId}/notes`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${bobToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Extracted SQL injection payload from raw log: UNION SELECT password FROM users" }),
    });
    console.log(`✓ Status: ${addNoteRes.status} (Expected: 200)`);
    const addNoteData = await addNoteRes.json();
    console.log(`  - Message: "${addNoteData.message}"`);
    if (addNoteRes.status !== 200) throw new Error("Expected 200 from add note");

    console.log("\n==================================================");
    console.log("🎉 ALL HTTP API INTEGRATION TESTS PASSED!");
    console.log("==================================================");

  } finally {
    server.close();
    await mongoose.disconnect();
    console.log("✓ Test server closed and DB disconnected");
  }
}

runHttpIntegrationTest().catch((err) => {
  console.error("❌ HTTP INTEGRATION TEST FAILED:", err);
  process.exit(1);
});
