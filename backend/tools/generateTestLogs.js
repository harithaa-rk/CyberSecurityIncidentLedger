/**
 * ==========================================================
 *  DEVELOPMENT TEST LOG GENERATOR
 * ==========================================================
 *  This script simulates a local security appliance / IDS / firewall
 *  by appending realistic security log events to backend/logs/security.log.
 * 
 *  NOTE: These are simulated events for local real-time pipeline testing.
 *  Press Ctrl + C to stop the generator.
 * ==========================================================
 */

const fs = require("fs");
const path = require("path");

const LOG_FILE_PATH = path.resolve(__dirname, "../logs/security.log");

// Ensure directory exists
const logDir = path.dirname(LOG_FILE_PATH);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const ATTACK_TEMPLATES = [
  {
    source: "Snort",
    attackType: "SQL_INJECTION",
    severity: "HIGH",
    sourcePort: 44321,
    destinationPort: 80,
    protocol: "TCP",
    message: "Possible SQL injection attempt detected in URI parameter",
  },
  {
    source: "Snort",
    attackType: "PORT_SCAN",
    severity: "MEDIUM",
    sourcePort: 51200,
    destinationPort: 445,
    protocol: "TCP",
    message: "Multiple destination ports probed sequentially",
  },
  {
    source: "Firewall",
    attackType: "BRUTE_FORCE",
    severity: "HIGH",
    sourcePort: 38920,
    destinationPort: 22,
    protocol: "TCP",
    message: "Multiple failed SSH authentication attempts detected from single IP",
  },
  {
    source: "Firewall",
    attackType: "DDOS",
    severity: "CRITICAL",
    sourcePort: 80,
    destinationPort: 443,
    protocol: "TCP",
    message: "Volumetric SYN flood threshold exceeded on external interface",
  },
  {
    source: "Antivirus",
    attackType: "MALWARE",
    severity: "CRITICAL",
    sourcePort: 59120,
    destinationPort: 8080,
    protocol: "HTTP",
    message: "Trojan horse signature detected in incoming payload stream",
  },
  {
    source: "AuthServer",
    attackType: "SUSPICIOUS_LOGIN",
    severity: "LOW",
    sourcePort: 60100,
    destinationPort: 443,
    protocol: "HTTPS",
    message: "User login from unrecognized geolocated IP address",
  },
  {
    source: "WAF",
    attackType: "XSS_EXPLOIT",
    severity: "MEDIUM",
    sourcePort: 48900,
    destinationPort: 80,
    protocol: "TCP",
    message: "Cross-site scripting (XSS) payload identified in POST body",
  },
];

function getRandomIP(subnet = 1) {
  const o1 = subnet === 1 ? 192 : subnet === 2 ? 10 : 172;
  const o2 = subnet === 1 ? 168 : subnet === 2 ? 0 : 16;
  const o3 = Math.floor(Math.random() * 50) + 1;
  const o4 = Math.floor(Math.random() * 254) + 1;
  return `${o1}.${o2}.${o3}.${o4}`;
}

function generateLogLine() {
  const template = ATTACK_TEMPLATES[Math.floor(Math.random() * ATTACK_TEMPLATES.length)];
  const timestamp = new Date().toISOString();
  const sourceIP = getRandomIP(1);
  const destinationIP = getRandomIP(2);

  return `${timestamp} | ${template.source} | ${template.attackType} | ${template.severity} | ${sourceIP} | ${destinationIP} | ${template.sourcePort} | ${template.destinationPort} | ${template.protocol} | ${template.message}\n`;
}

console.log("\n=======================================================");
console.log(" 🛡  DEVELOPMENT TEST LOG GENERATOR");
console.log("=======================================================");
console.log(` Target File : ${LOG_FILE_PATH}`);
console.log(" Interval    : Every 3 seconds");
console.log(" Status      : Active (Simulating real-time local log events)");
console.log(" Press Ctrl + C to stop\n");

let eventCount = 0;

function appendNextLog() {
  const logLine = generateLogLine();
  fs.appendFileSync(LOG_FILE_PATH, logLine, "utf8");
  eventCount++;
  const preview = logLine.trim();
  console.log(`[GENERATOR #${eventCount}] Appended: ${preview.slice(0, 85)}...`);
}

// Generate an immediate first log
appendNextLog();

// Continue generating every 3.5 seconds
const intervalId = setInterval(appendNextLog, 3500);

process.on("SIGINT", () => {
  clearInterval(intervalId);
  console.log(`\n[GENERATOR] Stopped. Total events generated: ${eventCount}.\n`);
  process.exit(0);
});
