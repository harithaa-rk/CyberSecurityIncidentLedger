/**
 * System Log File Writer — Owlyx: Vigilance Beyond Visibility
 *
 * Separates telemetry into two distinct files in the project root:
 * 1. system-logs.log:
 *    Primary Analyzed Security Incident Ledger.
 *    Includes all analyzed intelligence: IncidentID, Threat status, RiskScore,
 *    Severity, AttackType, Channel, EventID, Provider, ReceivedAt, and full message.
 *
 * 2. live-system-logs.log:
 *    Core System Software Logs (Native Operating System Telemetry).
 *    Displays core Windows configuration and event data as emitted by the OS
 *    with NO extra features (no IncidentID, no threat analysis, no risk score).
 */

const fs = require("fs");
const path = require("path");

// Resolve root project directories
const ROOT_DIR = path.resolve(__dirname, "../../");
const LOG_FILE_PATH_PRIMARY = path.join(ROOT_DIR, "system-logs.log");
const LOG_FILE_PATH_SECONDARY = path.join(ROOT_DIR, "live-system-logs.log");

const APP_NAME = "Owlyx";
const BRAND_PHRASE = "Silent Watch. Unbreakable Proof.";

/**
 * Initializes both root log files with appropriate Owlyx branding and mode banners.
 * @param {boolean} force - If true, resets file headers
 */
function initializeLogFiles(force = false) {
  const timestamp = new Date().toISOString();

  const primaryHeader = 
`================================================================================
 ${APP_NAME.toUpperCase()} — ${BRAND_PHRASE.toUpperCase()}
 Primary Security Incident Ledger & Threat Analysis Stream
 Application: ${APP_NAME} | Brand: ${BRAND_PHRASE}
 Target File: system-logs.log
 Mode: REAL HOST TELEMETRY WITH OWLYX THREAT & INCIDENT ANALYSIS
 Initialized: ${timestamp}
================================================================================

`;

  const secondaryHeader = 
`================================================================================
 ${APP_NAME.toUpperCase()} — ${BRAND_PHRASE.toUpperCase()}
 Core System Software Logs (Native Windows Operating System Telemetry)
 Application: ${APP_NAME} | Brand: ${BRAND_PHRASE}
 Target File: live-system-logs.log
 Mode: NATIVE CORE SYSTEM LOGS ONLY (Raw System Configuration Data — No Extra Features)
 Initialized: ${timestamp}
================================================================================

`;

  try {
    if (force || !fs.existsSync(LOG_FILE_PATH_PRIMARY)) {
      fs.writeFileSync(LOG_FILE_PATH_PRIMARY, primaryHeader, "utf8");
    }
    if (force || !fs.existsSync(LOG_FILE_PATH_SECONDARY)) {
      fs.writeFileSync(LOG_FILE_PATH_SECONDARY, secondaryHeader, "utf8");
    }
    console.log(`[FILE WRITER] [${APP_NAME}] Initialized log files at project root:`);
    console.log(`  - Primary Analyzed Ledger: ${LOG_FILE_PATH_PRIMARY}`);
    console.log(`  - Core Native System Log:   ${LOG_FILE_PATH_SECONDARY}`);
  } catch (err) {
    console.error(`[FILE WRITER] Error initializing log files: ${err.message}`);
  }
}

/**
 * Formats an entry for the Primary Analyzed Security Incident Ledger (system-logs.log).
 * Includes Incident ID, Threat tag, Risk Score, Attack Type, Severity, etc.
 */
function formatAnalyzedLogEntry(logData) {
  const timestamp = logData.timestamp ? new Date(logData.timestamp).toISOString() : new Date().toISOString();
  const receivedAt = logData.receivedAt ? new Date(logData.receivedAt).toISOString() : new Date().toISOString();
  const channel = logData.logName || logData.windowsEventData?.channel || logData.source || "System";
  const eventId = logData.eventId || logData.windowsEventData?.eventId || "N/A";
  const recordId = logData.eventRecordId || logData.windowsEventData?.recordId || "N/A";
  const provider = logData.providerName || logData.windowsEventData?.provider || "Windows";
  const host = logData.collectorHost || logData.windowsEventData?.computerName || "LocalMachine";
  const severity = (logData.severity || "LOW").toUpperCase();
  const isThreat = logData.threat === true;
  const threatTag = isThreat ? "🚨 THREAT DETECTED" : "NORMAL";
  const attackType = logData.attackType || "OS_TELEMETRY";
  const message = (logData.message || "").replace(/[\r\n]+/g, " ").trim();
  const incidentId = logData.createdIncidentId || logData.incidentId || "N/A";

  return `[${timestamp}] [${APP_NAME.toUpperCase()}] [REAL] [WINDOWS_EVENT_LOG] [${severity}] [${threatTag}]
  Host: ${host} | Channel: ${channel} | EventID: ${eventId} | RecordID: ${recordId}
  Provider: ${provider} | AttackType: ${attackType}
  Threat: ${isThreat ? "YES" : "NO"} | RiskScore: ${logData.riskScore || 0} | IncidentID: ${incidentId}
  Message: ${message}
  ReceivedAt: ${receivedAt}
--------------------------------------------------------------------------------
`;
}

/**
 * Formats an entry for Core System Software Logs (live-system-logs.log).
 * Pure native OS event/configuration log with NO extra features (no incident ID, no threat, no risk score).
 */
function formatRawCoreSystemLogEntry(logData) {
  const timestamp = logData.timestamp ? new Date(logData.timestamp).toISOString() : new Date().toISOString();
  const channel = logData.logName || logData.windowsEventData?.channel || "System";
  const eventId = logData.eventId || logData.windowsEventData?.eventId || "N/A";
  const recordId = logData.eventRecordId || logData.windowsEventData?.recordId || "N/A";
  const provider = logData.providerName || logData.windowsEventData?.provider || "Microsoft-Windows";
  const host = logData.collectorHost || logData.windowsEventData?.computerName || "LocalMachine";
  const message = (logData.message || "").trim();
  const rawXml = (logData.rawLog || "").trim();

  let entry = `[${timestamp}] Windows EventLog - Channel: ${channel} | EventID: ${eventId} | RecordID: ${recordId}
  Computer: ${host} | Provider: ${provider}
  Event Data:
  ${message}
`;

  if (rawXml && !rawXml.startsWith("{")) {
    entry += `  Raw Event Record:
  ${rawXml.replace(/[\r\n]+/g, " ")}
`;
  }

  entry += `--------------------------------------------------------------------------------
`;
  return entry;
}

/**
 * Appends to the Primary Analyzed Ledger file (system-logs.log).
 */
function appendAnalyzedSystemLog(logData) {
  if (!logData) return;
  if (logData.dataOrigin !== "REAL" && logData.collectionMethod !== "WINDOWS_EVENT_LOG") return;

  try {
    const entry = formatAnalyzedLogEntry(logData);
    fs.appendFileSync(LOG_FILE_PATH_PRIMARY, entry, "utf8");
  } catch (err) {
    console.error(`[FILE WRITER] Failed to append analyzed system log: ${err.message}`);
  }
}

/**
 * Appends to the Core System Software Log file (live-system-logs.log).
 */
function appendRawCoreSystemLog(logData) {
  if (!logData) return;
  if (logData.dataOrigin !== "REAL" && logData.collectionMethod !== "WINDOWS_EVENT_LOG") return;

  try {
    const entry = formatRawCoreSystemLogEntry(logData);
    fs.appendFileSync(LOG_FILE_PATH_SECONDARY, entry, "utf8");
  } catch (err) {
    console.error(`[FILE WRITER] Failed to append raw core system log: ${err.message}`);
  }
}

/**
 * Convenience dispatcher called during log ingestion:
 * Appends analyzed intelligence to system-logs.log
 * and pure core system telemetry to live-system-logs.log.
 */
function appendRealSystemLog(logData) {
  appendAnalyzedSystemLog(logData);
  appendRawCoreSystemLog(logData);
}

module.exports = {
  APP_NAME,
  BRAND_PHRASE,
  initializeLogFiles,
  appendAnalyzedSystemLog,
  appendRawCoreSystemLog,
  appendRealSystemLog,
  formatAnalyzedLogEntry,
  formatRawCoreSystemLogEntry,
  LOG_FILE_PATH_PRIMARY,
  LOG_FILE_PATH_SECONDARY,
};
