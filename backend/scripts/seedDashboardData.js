const mongoose = require("mongoose");
require("dotenv").config({ path: "../.env" });

const User = require("../models/User");
const Organization = require("../models/Organization");
const SecurityLog = require("../models/SecurityLog");
const BlockchainTransaction = require("../models/BlockchainTransaction");
const ActivityLog = require("../models/ActivityLog");

const connectDB = async () => {
  const connStr = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/cybersecurity_ledger";
  await mongoose.connect(connStr);
  console.log("Connected to MongoDB for seeding...");
};

const seedData = async () => {
  try {
    await connectDB();

    // 1. Organizations
    const orgCount = await Organization.countDocuments();
    if (orgCount === 0) {
      await Organization.insertMany([
        { name: "CyberShield Defense Ltd", code: "CSD", sector: "Defense", contactEmail: "contact@cybershield.org", userCount: 42, status: "Active" },
        { name: "FinTech Secure Global", code: "FSG", sector: "Finance", contactEmail: "sec@fintechglobal.com", userCount: 128, status: "Active" },
        { name: "HealthData Vault Corp", code: "HDV", sector: "Healthcare", contactEmail: "admin@healthvault.io", userCount: 64, status: "Active" },
        { name: "CloudGate Sentinel", code: "CGS", sector: "Infrastructure", contactEmail: "ops@cloudgate.com", userCount: 35, status: "Active" },
        { name: "Quantum Security Labs", code: "QSL", sector: "Research", contactEmail: "info@quantumsec.net", userCount: 19, status: "Active" },
        { name: "Apex Global Logistics", code: "AGL", sector: "Logistics", contactEmail: "security@apexlogistics.com", userCount: 50, status: "Active" },
      ]);
      console.log("Seeded Organizations");
    }

    // 2. Security Logs
    const logCount = await SecurityLog.countDocuments();
    if (logCount === 0) {
      const sampleLogs = [];
      const attackTypes = ["DDoS Attack", "Ransomware Attempt", "Phishing Campaign", "SQL Injection", "XSS Exploit", "Data Exfiltration", "Brute Force Auth", "Malware Execution"];
      const severities = ["Critical", "High", "Medium", "Low"];
      const statuses = ["Verified", "Verified", "Verified", "Verified", "Tampered", "Unverified"];
      const orgs = ["CyberShield Defense Ltd", "FinTech Secure Global", "HealthData Vault Corp", "CloudGate Sentinel"];

      for (let i = 1; i <= 85; i++) {
        const severity = severities[Math.floor(Math.random() * severities.length)];
        const attackType = attackTypes[Math.floor(Math.random() * attackTypes.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const org = orgs[Math.floor(Math.random() * orgs.length)];
        
        // Random date within last 30 days
        const daysAgo = Math.floor(Math.random() * 30);
        const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

        sampleLogs.push({
          logId: `LOG-2026-${1000 + i}`,
          title: `${attackType} detected on ${org.split(" ")[0]} Gateway`,
          severity,
          attackType,
          status,
          organization: org,
          user: i % 2 === 0 ? "SOC Analyst Alpha" : "Automated Sentinel",
          hash: "0x" + Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join(""),
          ipAddress: `192.168.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`,
          createdAt,
        });
      }
      await SecurityLog.insertMany(sampleLogs);
      console.log("Seeded Security Logs");
    }

    // 3. Blockchain Transactions
    const txCount = await BlockchainTransaction.countDocuments();
    if (txCount === 0) {
      const sampleTx = [];
      for (let i = 1; i <= 60; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        sampleTx.push({
          txHash: "0x" + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join(""),
          blockNumber: 14820000 + i * 14,
          logId: `LOG-2026-${1000 + i}`,
          status: i % 15 === 0 ? "Pending" : "Confirmed",
          gasUsed: 21000 + Math.floor(Math.random() * 15000),
          contractAddress: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
          createdAt,
        });
      }
      await BlockchainTransaction.insertMany(sampleTx);
      console.log("Seeded Blockchain Transactions");
    }

    // 4. Activity Logs
    const actCount = await ActivityLog.countDocuments();
    if (actCount === 0) {
      await ActivityLog.insertMany([
        { userName: "Alexander Wright", userRole: "Admin", action: "Activated Analyst Account", target: "sarah.connor@cyber.io", ipAddress: "10.0.0.14", severity: "success" },
        { userName: "System Guardian", userRole: "System", action: "Blockchain Block #14820840 Mined", target: "Smart Contract", ipAddress: "127.0.0.1", severity: "info" },
        { userName: "Marcus Vance", userRole: "Analyst", action: "Flagged Tampered Log ID LOG-2026-1042", target: "SecurityLog #1042", ipAddress: "192.168.1.45", severity: "critical" },
        { userName: "Elena Rostova", userRole: "Auditor", action: "Generated Compliance Audit Report", target: "Audits", ipAddress: "172.16.0.88", severity: "info" },
        { userName: "Alexander Wright", userRole: "Admin", action: "Updated Organization CSD Status", target: "CyberShield Defense", ipAddress: "10.0.0.14", severity: "warning" },
        { userName: "Automated Sentinel", userRole: "Bot", action: "Ingested 48 New Syslog Entries", target: "Collector Service", ipAddress: "192.168.1.100", severity: "success" },
      ]);
      console.log("Seeded Activity Logs");
    }

    console.log("Seeding finished successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
};

seedData();
