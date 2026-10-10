const crypto = require("crypto");
const SecurityLog = require("../models/SecurityLog");
const { generateSHA256Hash, generatePinataCID } = require("../utils/logParser");
const { recordBlockchainTransaction } = require("./blockchain/blockchainService");
const { createIncidentFromLog } = require("./incidentService");
const { appendRealSystemLog } = require("../utils/systemLogFileWriter");

let ioInstance = null;

/**
 * Configure the Socket.IO instance used to emit real-time events.
 * @param {object} io - Socket.IO server instance
 */
function setSocketIO(io) {
  ioInstance = io;
}

/**
 * Generates a unique, standardized incident ID formatted like INC-YYYYMMDD-XXXXXX.
 * @param {Date} date
 * @returns {string}
 */
function generateIncidentId(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `INC-${year}${month}${day}-${randomSuffix}`;
}

/**
 * Creates a deterministic SHA-256 fingerprint for duplicate detection.
 * @param {object} logData
 * @returns {string}
 */
function createEventFingerprint(logData) {
  if (logData.fingerprint) {
    return logData.fingerprint;
  }
  const content = `${logData.timestamp || ""}|${logData.sourceIP || ""}|${logData.destinationIP || ""}|${logData.attackType || ""}|${logData.rawLog || logData.message || ""}`;
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Processes, validates, hashes, commits to blockchain ledger, and persists a security log event.
 * @param {object} logData - Parsed security log event
 * @param {string} [collectionMethod="LOCAL_FILE"] - Ingestion source
 * @returns {Promise<object>} - Stored SecurityLog document
 */
async function processSecurityLog(logData, collectionMethod = "LOCAL_FILE") {
  if (!logData || typeof logData !== "object") {
    throw new Error("Invalid log data: Log payload must be an object.");
  }

  // 1. Validate required fields
  const requiredFields = ["source", "attackType", "severity", "sourceIP", "destinationIP", "message"];
  for (const field of requiredFields) {
    if (!logData[field]) {
      throw new Error(`Validation failed: Missing required field "${field}".`);
    }
  }

  // 2. Normalize values
  const normalizedSeverity = String(logData.severity).toUpperCase();
  const validSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const severity = validSeverities.includes(normalizedSeverity) ? normalizedSeverity : "LOW";

  const timestamp = logData.timestamp ? new Date(logData.timestamp) : new Date();
  const receivedAt = logData.receivedAt ? new Date(logData.receivedAt) : new Date();

  // Normalize collectionMethod to standard enum
  let effectiveCollectionMethod = collectionMethod || logData.collectionMethod || "UNKNOWN";
  if (effectiveCollectionMethod === "LOCAL_FILE") effectiveCollectionMethod = "FILE_UPLOAD";
  if (effectiveCollectionMethod === "API_INGEST") effectiveCollectionMethod = "MANUAL";
  if (effectiveCollectionMethod === "TEST_SIMULATION") effectiveCollectionMethod = "TEST_GENERATOR";

  // Enforce dataOrigin (REAL, SAMPLE, TEST, or UNKNOWN)
  const validOrigins = ["REAL", "SAMPLE", "TEST", "UNKNOWN"];
  const dataOrigin = validOrigins.includes(logData.dataOrigin) ? logData.dataOrigin : "UNKNOWN";

  // Build eventFingerprint for Windows/telemetry events or use provided
  let eventFingerprint = logData.eventFingerprint || null;
  if (!eventFingerprint && logData.collectorHost && logData.logName && logData.eventRecordId) {
    eventFingerprint = crypto
      .createHash("sha256")
      .update(`${logData.collectorHost}|${logData.logName}|${logData.eventRecordId}|${logData.providerName || ""}`)
      .digest("hex");
  }

  const fingerprint = logData.fingerprint || createEventFingerprint(logData);

  // 3. Prevent duplicate ingestion if identical event fingerprint exists
  const dupQuery = eventFingerprint ? { $or: [{ fingerprint }, { eventFingerprint }] } : { fingerprint };
  const existingLog = await SecurityLog.findOne(dupQuery);
  if (existingLog) {
    console.log(`[LOG INGESTION] Duplicate log event detected (Fingerprint: ${(eventFingerprint || fingerprint).slice(0, 8)}...). Skipping.`);
    return existingLog;
  }

  // 4. Generate Incident ID
  const incidentId = logData.incidentId || generateIncidentId(timestamp);

  // 5. Generate Cryptographic Hash & Pinata IPFS CID
  const rawLogString = logData.rawLog || logData.fullLog || `${timestamp.toISOString()} | ${logData.source} | ${logData.attackType} | ${severity} | ${logData.sourceIP} | ${logData.destinationIP} | ${logData.sourcePort || 0} | ${logData.destinationPort || 0} | ${logData.protocol || "TCP"} | ${logData.message}`;
  const fullLog = logData.fullLog || rawLogString;
  const hash = logData.hash || generateSHA256Hash(fullLog);
  const cid = logData.cid || generatePinataCID(fullLog);

  // 6. Record Immutable Blockchain Transaction
  let blockchainTxId = null;
  let blockNumber = null;
  try {
    const txRecord = await recordBlockchainTransaction(incidentId, hash, cid);
    blockchainTxId = txRecord.txHash;
    blockNumber = txRecord.blockNumber;
  } catch (bcErr) {
    console.warn(`[LOG INGESTION] Blockchain ledger recording note: ${bcErr.message}`);
  }

  // 7. Create and save Document to MongoDB
  const newLog = new SecurityLog({
    incidentId,
    logId: incidentId,
    timestamp,
    receivedAt,
    dataOrigin,
    collectionMethod: effectiveCollectionMethod,
    collectorHost: logData.collectorHost || "",
    collectorProcess: logData.collectorProcess || "",
    eventRecordId: logData.eventRecordId ? String(logData.eventRecordId) : "",
    providerName: logData.providerName || "",
    logName: logData.logName || "",
    eventFingerprint,
    source: String(logData.source).trim(),
    eventName: logData.eventName || logData.attackType,
    category: logData.category || logData.threatCategory || "Threat Ingestion",
    attackType: String(logData.attackType).trim().toUpperCase(),
    severity,
    sourceIP: String(logData.sourceIP).trim(),
    destinationIP: String(logData.destinationIP).trim(),
    sourcePort: Number(logData.sourcePort) || 0,
    destinationPort: Number(logData.destinationPort) || 0,
    protocol: String(logData.protocol || "TCP").trim().toUpperCase(),
    message: String(logData.message).trim(),
    rawLog: rawLogString,
    fullLog,
    hash,
    cid,
    blockchainTxId,
    blockNumber,
    verificationStatus: "Verified",
    status: logData.status || "NEW",
    organization: logData.organization || "CyberSecurity Inc",
    fileName: logData.fileName || null,
    fileSize: logData.fileSize || rawLogString.length,
    fileType: logData.fileType || effectiveCollectionMethod,
    fingerprint,
    eventId: logData.eventId || null,
    threat: typeof logData.threat === "boolean" ? logData.threat : false,
    threatCategory: logData.threatCategory || logData.category || "General",
    riskScore: typeof logData.riskScore === "number" ? logData.riskScore : (severity === "CRITICAL" ? 90 : severity === "HIGH" ? 70 : severity === "MEDIUM" ? 40 : 10),
    explanation: logData.explanation || "",
    recommendedAction: logData.recommendedAction || "",
    windowsEventData: logData.windowsEventData || null,
  });

  const savedLog = await newLog.save();
  console.log(`[LOG INGESTION] Security event saved: ${savedLog.incidentId} [${savedLog.severity}] Origin: ${savedLog.dataOrigin} Method: ${savedLog.collectionMethod}`);

  // 8. AUTO-CREATE INCIDENT if threat detected (Module 1 – Phase 3)
  let createdIncident = null;
  try {
    createdIncident = await createIncidentFromLog(savedLog);
    if (createdIncident) {
      savedLog.createdIncidentId = createdIncident.incidentId;
      savedLog.incidentRef = createdIncident._id;
    }
  } catch (incidentErr) {
    console.error(`[INCIDENT] Failed to auto-create incident for ${savedLog.incidentId}: ${incidentErr.message}`);
  }

  // 9. Emit Socket.IO event AFTER successful database insertion & incident linking
  if (ioInstance) {
    const safeLogObject = savedLog.toJSON();
    const payload = {
      id: savedLog._id,
      incidentId: savedLog.incidentId,
      createdIncidentId: savedLog.createdIncidentId || (createdIncident ? createdIncident.incidentId : null),
      timestamp: savedLog.timestamp,
      receivedAt: savedLog.receivedAt,
      source: savedLog.source,
      threat: savedLog.threat,
      severity: savedLog.severity,
      riskScore: savedLog.riskScore,
      attackType: savedLog.attackType,
      message: savedLog.message,
      dataOrigin: savedLog.dataOrigin,
      collectionMethod: savedLog.collectionMethod,
      collectorHost: savedLog.collectorHost,
      eventRecordId: savedLog.eventRecordId,
      providerName: savedLog.providerName,
      logName: savedLog.logName,
      rawLog: savedLog.rawLog,
      eventId: savedLog.eventId,
      ...safeLogObject,
    };
    ioInstance.emit("security-log:new", payload);
    console.log(`[SOCKET] security-log:new emitted for ${savedLog.incidentId}`);
  }

  // 10. Stream to root project log file if REAL host telemetry
  if (savedLog.dataOrigin === "REAL" || savedLog.collectionMethod === "WINDOWS_EVENT_LOG") {
    try {
      appendRealSystemLog(savedLog);
    } catch (fileErr) {
      console.warn(`[FILE WRITER] Error writing real system log: ${fileErr.message}`);
    }
  }

  return savedLog;
}

module.exports = {
  setSocketIO,
  processSecurityLog,
  generateIncidentId,
};
