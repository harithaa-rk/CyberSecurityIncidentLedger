/**
 * Synthetic Sample / Test Security Event Generator
 *
 * Exclusively generates simulated synthetic threat telemetry for demonstrations
 * and unit/integration testing.
 *
 * STRICT AUTHENTICITY RULE:
 * This generator NEVER fabricates or pretends to be a real Windows operating system event.
 * Every event generated here is explicitly marked with:
 *   dataOrigin: "SAMPLE" (or "TEST")
 *   collectionMethod: "TEST_GENERATOR"
 *   collectorHost: "LOCAL-TEST-GENERATOR"
 */

const crypto = require("crypto");
const { processSecurityLog } = require("../services/logIngestionService");

let sampleCounter = 1;

const SCENARIOS = {
  SQL_INJECTION: {
    source: "Sample Generator",
    eventName: "SQL Injection Probe",
    category: "Web Application Defense",
    attackType: "SQL_INJECTION",
    severity: "HIGH",
    riskScore: 85,
    threat: true,
    threatCategory: "Injection Attacks",
    sourceIP: "192.168.1.105",
    destinationIP: "10.0.0.12",
    sourcePort: 54321,
    destinationPort: 443,
    protocol: "TCP",
    message: "Synthetic SQL injection payload detected in query string: SELECT * FROM users WHERE '1'='1'",
    explanation: "Artificial demonstration of SQL injection probe against simulated database endpoint.",
    recommendedAction: "Verify parameterization and sanitize incoming request parameters.",
  },
  BRUTE_FORCE: {
    source: "Sample Generator",
    eventName: "Authentication Burst Failure",
    category: "Identity & Access",
    attackType: "BRUTE_FORCE",
    severity: "HIGH",
    riskScore: 85,
    threat: true,
    threatCategory: "Credential Access",
    sourceIP: "10.0.2.14",
    destinationIP: "10.0.0.2",
    sourcePort: 51234,
    destinationPort: 22,
    protocol: "TCP",
    message: "Synthetic SSH brute force: 50 simulated credential failures within 30 seconds.",
    explanation: "Artificial demonstration of high-frequency credential stuffing attempt.",
    recommendedAction: "Engage IP throttling or temporary account lockout.",
  },
  PORT_SCAN: {
    source: "Sample Generator",
    eventName: "SYN Port Reconnaissance",
    category: "Network Defense",
    attackType: "PORT_SCAN",
    severity: "MEDIUM",
    riskScore: 55,
    threat: true,
    threatCategory: "Discovery / Reconnaissance",
    sourceIP: "192.168.1.45",
    destinationIP: "10.0.0.8",
    sourcePort: 49152,
    destinationPort: 445,
    protocol: "TCP",
    message: "Synthetic TCP SYN scan detected across 100 consecutive destination ports.",
    explanation: "Artificial port scan demonstration simulating adversarial network reconnaissance.",
    recommendedAction: "Review edge firewall ACLs and drop unauthorized probing traffic.",
  },
  DDOS: {
    source: "Sample Generator",
    eventName: "Volumetric Flood Event",
    category: "Network Availability",
    attackType: "DDOS",
    severity: "CRITICAL",
    riskScore: 95,
    threat: true,
    threatCategory: "Denial of Service",
    sourceIP: "185.220.101.5",
    destinationIP: "10.0.0.5",
    sourcePort: 443,
    destinationPort: 443,
    protocol: "TCP",
    message: "Synthetic volumetric SYN flood exceeding threshold of 50,000 pps.",
    explanation: "Artificial DDoS demonstration simulating distributed flood attack.",
    recommendedAction: "Enable upstream scrubbing center and enforce rate-limiting.",
  },
  SUSPICIOUS_PROCESS_EXECUTION: {
    source: "Sample Generator",
    eventName: "Living-off-the-Land Binary Execution",
    category: "Endpoint Behavior",
    attackType: "SUSPICIOUS_PROCESS_EXECUTION",
    severity: "HIGH",
    riskScore: 80,
    threat: true,
    threatCategory: "Defense Evasion",
    sourceIP: "127.0.0.1",
    destinationIP: "127.0.0.1",
    sourcePort: 0,
    destinationPort: 0,
    protocol: "PROCESS",
    message: "Synthetic process: certutil.exe invoked with -urlcache -split to download payload.",
    explanation: "Artificial LOLBIN execution pattern demonstration.",
    recommendedAction: "Terminate process and quarantine downloaded artifacts.",
  },
  MALWARE_DETECTION: {
    source: "Sample Generator",
    eventName: "Simulated Ransomware Heuristic",
    category: "Endpoint Protection",
    attackType: "MALWARE_DETECTION",
    severity: "CRITICAL",
    riskScore: 92,
    threat: true,
    threatCategory: "Impact / Ransomware",
    sourceIP: "192.168.1.88",
    destinationIP: "10.0.0.20",
    sourcePort: 58821,
    destinationPort: 8080,
    protocol: "HTTP",
    message: "Synthetic malware beacon matching known simulator signature.",
    explanation: "Artificial malware payload execution demonstration.",
    recommendedAction: "Isolate affected endpoint immediately and begin incident triage.",
  },
  NORMAL_TELEMETRY: {
    source: "Sample Generator",
    eventName: "Baseline Health Check",
    category: "Operational Baseline",
    attackType: "BASELINE_TELEMETRY",
    severity: "LOW",
    riskScore: 10,
    threat: false,
    threatCategory: "System Operations",
    sourceIP: "127.0.0.1",
    destinationIP: "127.0.0.1",
    sourcePort: 80,
    destinationPort: 80,
    protocol: "HTTP",
    message: "Synthetic routine heartbeat check performed successfully.",
    explanation: "Non-threat operational baseline sample telemetry.",
    recommendedAction: "No action required.",
  },
};

/**
 * Generates a synthetic SAMPLE or TEST security event and passes it to the ingestion service.
 *
 * @param {string} scenarioKey - Scenario name (e.g., "SQL_INJECTION", "BRUTE_FORCE")
 * @param {"SAMPLE" | "TEST"} [targetOrigin="SAMPLE"] - Origin tag
 * @returns {Promise<object>} Stored SecurityLog document
 */
async function generateSampleSecurityEvent(scenarioKey = "SQL_INJECTION", targetOrigin = "SAMPLE") {
  const normKey = String(scenarioKey || "").toUpperCase().replace(/[-\s]/g, "_");
  const template = SCENARIOS[normKey] || SCENARIOS.SQL_INJECTION;

  const validOrigin = targetOrigin === "TEST" ? "TEST" : "SAMPLE";
  const timestamp = new Date();
  const counterId = sampleCounter++;
  const recordId = `${validOrigin}-${Date.now().toString().slice(-6)}-${String(counterId).padStart(3, "0")}`;

  const rawJson = JSON.stringify(
    {
      synthetic: true,
      dataOrigin: validOrigin,
      scenario: normKey,
      generatedAt: timestamp.toISOString(),
      recordId,
      template,
    },
    null,
    2
  );

  const eventFingerprint = crypto
    .createHash("sha256")
    .update(`SYNTHETIC|${validOrigin}|${recordId}|${normKey}|${timestamp.getTime()}`)
    .digest("hex");

  console.log(`[${validOrigin} GENERATOR] ${validOrigin} event created`);
  console.log(`[${validOrigin} GENERATOR] Origin: ${validOrigin}`);

  const logPayload = {
    ...template,
    timestamp,
    receivedAt: timestamp,
    dataOrigin: validOrigin,
    collectionMethod: "TEST_GENERATOR",
    collectorHost: "LOCAL-TEST-GENERATOR",
    collectorProcess: "sampleLogGenerator.js",
    eventRecordId: recordId,
    providerName: "SyntheticTestHarness",
    logName: "SyntheticSecurity",
    eventFingerprint,
    fingerprint: eventFingerprint,
    rawLog: rawJson,
    fullLog: rawJson,
  };

  const savedLog = await processSecurityLog(logPayload, "TEST_GENERATOR");
  return savedLog;
}

module.exports = {
  SCENARIOS,
  generateSampleSecurityEvent,
};
