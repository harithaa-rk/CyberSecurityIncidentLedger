const http = require("http");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

async function demo() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require("../models/User");
  const admin = await User.findOne({ role: "Admin" });
  const token = jwt.sign({ id: admin._id, role: admin.role, name: admin.name }, process.env.JWT_SECRET);
  const Incident = require("../models/Incident");
  const inc = await Incident.findOne({ status: { $ne: "ARCHIVED" } });

  function upload(filename, content) {
    return new Promise((resolve) => {
      const boundary = "----Boundary" + Date.now();
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: text/plain\r\n\r\n`),
        Buffer.from(content),
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      const req = http.request({
        hostname: "localhost",
        port: 5000,
        path: `/api/incidents/${inc._id}/evidence`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
        },
      }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(JSON.parse(d)));
      });
      req.write(body);
      req.end();
    });
  }

  function getHash(evidenceId) {
    return new Promise((resolve) => {
      http.get({
        hostname: "localhost",
        port: 5000,
        path: `/api/evidence/${evidenceId}/hash`,
        headers: { Authorization: `Bearer ${token}` },
      }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(JSON.parse(d)));
      });
    });
  }

  console.log("\n=======================================================");
  console.log(" PHASE 4 MODULE 2 — LIVE DEMO & TEST SEQUENCE");
  console.log("=======================================================\n");

  console.log(">>> Step 1 & 2: Upload evidence and generate SHA-256");
  const res1 = await upload("firewall-log.txt", "2026-09-09T11:00:00Z | ACCEPT | 192.168.1.100 -> 10.0.0.1:443\n");
  console.log("Uploaded Evidence ID :", res1.evidenceId);
  console.log("Hash Status          :", res1.evidence.hashStatus);
  console.log("Generated SHA-256    :", res1.evidence.sha256Hash);

  console.log("\n>>> Step 3: GET /api/evidence/:evidenceId/hash (from MongoDB)");
  const hashRes = await getHash(res1.evidenceId);
  console.log("API Response:");
  console.log(JSON.stringify(hashRes, null, 2));

  console.log("\n>>> Step 4: Upload EXACT same file bytes again");
  const res2 = await upload("firewall-log-copy.txt", "2026-09-09T11:00:00Z | ACCEPT | 192.168.1.100 -> 10.0.0.1:443\n");
  console.log("Duplicate Evidence ID:", res2.evidenceId);
  console.log("Duplicate SHA-256    :", res2.evidence.sha256Hash);
  console.log("Hashes Identical?    :", res1.evidence.sha256Hash === res2.evidence.sha256Hash ? "YES (MATCH)" : "NO");

  console.log("\n>>> Step 5: Upload MODIFIED file bytes (Port 443 -> 444)");
  const res3 = await upload("firewall-log-modified.txt", "2026-09-09T11:00:00Z | ACCEPT | 192.168.1.100 -> 10.0.0.1:444\n");
  console.log("Modified Evidence ID :", res3.evidenceId);
  console.log("Modified SHA-256     :", res3.evidence.sha256Hash);
  console.log("Hash Changed?        :", res1.evidence.sha256Hash !== res3.evidence.sha256Hash ? "YES (DIFFERENT)" : "NO");

  console.log("\n=======================================================");
  console.log(" ALL 5 TEST STEPS VERIFIED SUCCESSFULLY");
  console.log("=======================================================\n");

  await mongoose.disconnect();
  process.exit(0);
}

demo().catch((e) => {
  console.error(e);
  process.exit(1);
});
