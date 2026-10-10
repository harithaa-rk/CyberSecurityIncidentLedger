const crypto   = require("crypto");
const fs        = require("fs");
const path      = require("path");
const { v4: uuidv4 } = require("uuid");

const Evidence  = require("../models/Evidence");
const Incident  = require("../models/Incident");

// ─────────────────────────────────────────────────────────────────────────────
// Evidence Service – Phase 4 Module 1: Digital Evidence Management
//
// All user-identity fields (collectedBy, collectionTimestamp) are injected
// from the authenticated session, never from the HTTP request body.
//
// SHA-256 is computed server-side from the in-memory file buffer.
// Files are written to disk with a UUID filename; the server path is
// never transmitted to the frontend.
// ─────────────────────────────────────────────────────────────────────────────

let ioInstance = null;

/**
 * Provide the Socket.IO server instance so this service can emit
 * incident:updated events after evidence operations.
 * @param {object} io - Socket.IO server instance
 */
function setEvidenceSocketIO(io) {
  ioInstance = io;
}

// ── Storage directory ─────────────────────────────────────────────────────────
const EVIDENCE_UPLOAD_DIR = path.join(__dirname, "..", "uploads", "evidence");

// Ensure directory exists on first require
if (!fs.existsSync(EVIDENCE_UPLOAD_DIR)) {
  fs.mkdirSync(EVIDENCE_UPLOAD_DIR, { recursive: true });
}

// ── Allowed MIME types whitelist ─────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",   // .pcap, .log, .bin
  "application/vnd.tcpdump.pcap",
]);

// 50 MB hard limit
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const hashService = require("./hashService");
const pinataService = require("./pinataService");
const fabricService = require("./fabricService");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate EVD-YYYYMMDD-XXXXXX (crypto-random, same pattern as generateIncidentId).
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
function generateEvidenceId(date = new Date()) {
  const d = new Date(date);
  const year  = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day   = String(d.getUTCDate()).padStart(2, "0");

  const randomInt = crypto.randomBytes(3).readUIntBE(0, 3) % 1_000_000;
  const suffix    = String(randomInt).padStart(6, "0");

  return `EVD-${year}${month}${day}-${suffix}`;
}

/**
 * Compute SHA-256 hex digest from a Buffer.
 * Delegates to hashService.generateSha256.
 * @param {Buffer} buffer
 * @returns {string}
 */
function computeSha256(buffer) {
  return hashService.generateSha256(buffer);
}

/**
 * Derive a safe file extension from the original filename (never executed).
 * Falls back to ".bin" if unknown.
 * @param {string} originalName
 * @returns {string}  e.g. ".pdf"
 */
function safeExtension(originalName) {
  const ext = path.extname(originalName || "").toLowerCase().slice(0, 10);
  // Whitelist of safe extensions only
  const safe = new Set([
    ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp",
    ".txt", ".csv", ".json", ".xml", ".zip",
    ".pcap", ".log", ".bin",
  ]);
  return safe.has(ext) ? ext : ".bin";
}

// ─────────────────────────────────────────────────────────────────────────────
// collectEvidence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload and persist evidence tied to an incident.
 *
 * @param {object} params
 * @param {string|mongoose.Types.ObjectId} params.incidentMongoId - Incident _id
 * @param {Buffer}  params.fileBuffer      - Raw file bytes (from multer memoryStorage)
 * @param {string}  params.originalName    - Original client filename (display only)
 * @param {string}  params.mimeType        - MIME type detected by multer
 * @param {number}  params.fileSize        - Bytes
 * @param {string}  params.description     - Optional analyst description
 * @param {string}  params.collectedByUserId - MongoDB ObjectId of authenticated user
 * @param {string}  params.collectedByName   - Authenticated user's display name
 * @returns {Promise<object>} Saved Evidence document (lean)
 */
async function collectEvidence({
  incidentMongoId,
  fileBuffer,
  originalName,
  mimeType,
  fileSize,
  description = "",
  collectedByUserId,
  collectedByName = "Unknown",
}) {
  const actualFileSize = Number(fileSize) || (fileBuffer ? fileBuffer.length : 0);

  // ── 1. Validate file presence ─────────────────────────────────────────────
  if (!fileBuffer || fileBuffer.length === 0) {
    const err = new Error("Uploaded file is empty. Evidence cannot be collected.");
    err.statusCode = 400;
    throw err;
  }

  // ── 2. Validate file size ─────────────────────────────────────────────────
  if (actualFileSize > MAX_FILE_SIZE_BYTES) {
    const err = new Error(`File exceeds maximum allowed size of 50 MB.`);
    err.statusCode = 400;
    throw err;
  }

  // ── 3. Validate MIME type whitelist ───────────────────────────────────────
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    const err = new Error(`File type '${mimeType}' is not permitted. Upload PDF, image, text, CSV, JSON, XML, ZIP, or PCAP files only.`);
    err.statusCode = 400;
    throw err;
  }

  // ── 4. Validate incident exists ───────────────────────────────────────────
  const incident = await Incident.findById(incidentMongoId);
  if (!incident) {
    const err = new Error("Incident not found.");
    err.statusCode = 404;
    throw err;
  }

  // ── 5. Reject evidence on ARCHIVED incidents ──────────────────────────────
  if (incident.status === "ARCHIVED") {
    const err = new Error("Cannot attach evidence to an ARCHIVED incident. Archived incidents are read-only.");
    err.statusCode = 400;
    throw err;
  }

  // ── 6. Compute SHA-256 from in-memory raw binary bytes using hashService ──
  let sha256Hash = null;
  let hashStatus = "GENERATED";
  try {
    sha256Hash = hashService.generateSha256(fileBuffer);
  } catch (hashErr) {
    console.error(`[HASH] Failed generating SHA-256 for ${originalName}:`, hashErr.message);
    hashStatus = "FAILED";
  }

  // ── 7. Write file to disk with UUID filename (path never sent to client) ──
  const ext      = safeExtension(originalName);
  const uuidName = `${uuidv4()}${ext}`;
  const diskPath = path.join(EVIDENCE_UPLOAD_DIR, uuidName);

  fs.writeFileSync(diskPath, fileBuffer);

  // ── 8. Resolve file type label ────────────────────────────────────────────
  const fileType = ext.replace(".", "").toUpperCase() || "UNKNOWN";

  // ── 9. Generate evidenceId (server-only) ──────────────────────────────────
  // Pre-validate hook on the model will also generate one as a safety net,
  // but we pre-compute here so we can reference it in the activity log.
  const now = new Date();
  let evidenceId;
  let attempt = 0;
  while (attempt < 5) {
    evidenceId = generateEvidenceId(now);
    const collision = await Evidence.findOne({ evidenceId }).lean();
    if (!collision) break;
    attempt++;
  }

  // ── 10. Persist Evidence document ─────────────────────────────────────────
  const evidence = new Evidence({
    evidenceId,
    incidentId:          incident._id,
    fileName:            uuidName,           // UUID key on disk
    originalFileName:    originalName,       // display name from client
    fileType,
    mimeType,
    fileSize:            actualFileSize,
    description:         (description || "").trim(),
    collectedBy:         collectedByUserId,
    collectionTimestamp: now,
    storageStatus:       "UPLOADED",
    hashStatus,
    sha256Hash,
    ipfsCid:             null,
    fabricTransactionId: null,
    fabricRecordedAt:    null,
    verificationStatus:  "NOT_VERIFIED",
  });

  const saved = await evidence.save();
  if (hashStatus === "GENERATED") {
    console.log("[HASH] Evidence hash stored");
  }

  // ── 11. Upload to Pinata / IPFS (Phase 4 Module 3) ───────────────────────
  if (process.env.PINATA_JWT && process.env.PINATA_JWT.trim()) {
    try {
      const ipfsRes = await pinataService.uploadEvidenceToIPFS(saved, fileBuffer);
      if (ipfsRes && ipfsRes.ipfsCid) {
        saved.ipfsCid = ipfsRes.ipfsCid;
        saved.storageStatus = ipfsRes.storageStatus || "UPLOADED";
        saved.ipfsUploadedAt = ipfsRes.ipfsUploadedAt || new Date();
        if (ipfsRes.fabricTransactionId) {
          saved.fabricTransactionId = ipfsRes.fabricTransactionId;
          saved.blockchainStatus = ipfsRes.blockchainStatus || "REGISTERED";
        }
      }
    } catch (ipfsErr) {
      console.warn(`[IPFS] Initial IPFS upload failed: ${ipfsErr.message}`);
      saved.storageStatus = "FAILED";
      await saved.save().catch(() => {});
    }
  }

  // ── 11B. Register on Hyperledger Fabric (Phase 4 Module 7) ───────────────
  // Verify that SHA-256 and IPFS upload succeeded
  if (
    saved.hashStatus === "GENERATED" &&
    saved.sha256Hash &&
    saved.ipfsCid &&
    saved.storageStatus === "UPLOADED" &&
    saved.blockchainStatus !== "REGISTERED"
  ) {
    try {
      const fabricDoc = await registerEvidenceOnFabric(saved.evidenceId, collectedByName);
      if (fabricDoc) {
        saved.fabricTransactionId = fabricDoc.fabricTransactionId;
        saved.fabricRecordedAt = fabricDoc.fabricRecordedAt;
        saved.blockchainStatus = fabricDoc.blockchainStatus;
      }
    } catch (fabricErr) {
      console.warn(`[FABRIC] Initial blockchain registration failed: ${fabricErr.message}`);
    }
  }

  // ── 12. Append EVIDENCE_ADDED to incident activityHistory ─────────────────
  const activityDesc = `Evidence ${saved.evidenceId} (${originalName}, ${fileType}, ${(fileSize / 1024).toFixed(1)} KB) was collected and attached to incident ${incident.incidentId}.`;
  incident.activityHistory.push({
    action:      "EVIDENCE_ADDED",
    description: activityDesc,
    note:        activityDesc,
    performedBy: collectedByName,
    performedAt: now,
    timestamp:   now,
  });

  await incident.save();

  // ── 13. Emit real-time update ──────────────────────────────────────────────
  if (ioInstance) {
    ioInstance.emit("incident:updated", incident.toJSON ? incident.toJSON() : incident);
  }

  // Return populated document (never include disk path)
  return getEvidenceById(saved.evidenceId);
}

// ─────────────────────────────────────────────────────────────────────────────
// registerEvidenceOnFabric (Phase 4 Module 7)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register evidence on Hyperledger Fabric after SHA-256 and IPFS upload succeed.
 *
 * Guards:
 * - SHA-256 generation failed -> throw
 * - Pinata upload failed -> throw
 * - Incident does not exist -> throw
 * - Incident is archived -> throw
 * - Evidence is already registered -> return
 *
 * @param {string} evidenceId - EVD-YYYYMMDD-XXXXXX
 * @param {string} [registeredByName] - Name of user initiating registration
 * @returns {Promise<object>}
 */
async function registerEvidenceOnFabric(evidenceId, registeredByName = "appUser") {
  const evidence = await Evidence.findOne({ evidenceId });
  if (!evidence) {
    const err = new Error(`Evidence '${evidenceId}' not found.`);
    err.statusCode = 404;
    throw err;
  }

  // 1. Guard: Incident exists and not archived
  const incident = await Incident.findById(evidence.incidentId);
  if (!incident) {
    const err = new Error("Associated incident does not exist.");
    err.statusCode = 404;
    throw err;
  }
  if (incident.status === "ARCHIVED") {
    const err = new Error("Cannot register evidence for an ARCHIVED incident.");
    err.statusCode = 400;
    throw err;
  }

  // 2. Guard: SHA-256 generation must have succeeded
  if (evidence.hashStatus !== "GENERATED" || !evidence.sha256Hash) {
    const err = new Error("Cannot register evidence on blockchain: SHA-256 hash generation failed or is missing.");
    err.statusCode = 400;
    throw err;
  }

  // 3. Guard: IPFS upload must have succeeded
  if (!evidence.ipfsCid || evidence.storageStatus === "FAILED") {
    const err = new Error("Cannot register evidence on blockchain: IPFS / Pinata upload has not succeeded.");
    err.statusCode = 400;
    throw err;
  }

  // 4. Guard: Already registered
  if (evidence.fabricTransactionId && evidence.blockchainStatus === "REGISTERED") {
    console.log(`[FABRIC] Evidence ${evidenceId} is already registered on blockchain with Tx ID: ${evidence.fabricTransactionId}`);
    return evidence;
  }

  // Update status to REGISTERING
  evidence.blockchainStatus = "REGISTERING";
  await evidence.save().catch(() => {});

  try {
    const recordedAt = new Date().toISOString();
    const recordedBy = registeredByName || "appUser";

    // Submit transaction to Fabric
    const txResult = await fabricService.registerEvidenceOnBlockchain(
      incident.incidentId,
      evidence.evidenceId,
      evidence.ipfsCid,
      evidence.sha256Hash,
      recordedBy,
      recordedAt
    );

    const txId = txResult.fabricTransactionId || txResult.txId;
    if (!txId) {
      throw new Error("Fabric returned an invalid transaction response without a transaction ID.");
    }

    // Update MongoDB
    evidence.fabricTransactionId = txId;
    evidence.fabricRecordedAt    = new Date(recordedAt);
    evidence.blockchainStatus    = "REGISTERED";
    const updated = await evidence.save();

    // Append to incident activityHistory: EVIDENCE_REGISTERED_ON_BLOCKCHAIN
    const actDesc = `Evidence ${evidence.evidenceId} was registered on Hyperledger Fabric.`;
    incident.activityHistory.push({
      action:      "EVIDENCE_REGISTERED_ON_BLOCKCHAIN",
      description: actDesc,
      note:        actDesc,
      performedBy: recordedBy,
      performedAt: new Date(),
      timestamp:   new Date(),
      metadata: {
        evidenceId:          evidence.evidenceId,
        fabricTransactionId: txId,
        sha256Hash:          evidence.sha256Hash,
        ipfsCid:             evidence.ipfsCid,
      },
    });

    await incident.save();

    if (ioInstance) {
      ioInstance.emit("incident:updated", incident.toJSON ? incident.toJSON() : incident);
      ioInstance.emit("evidence:updated", updated.toJSON ? updated.toJSON() : updated);
    }

    return updated;
  } catch (error) {
    console.error(`[FABRIC] Registration failed for evidence ${evidenceId}:`, error.message);
    evidence.blockchainStatus = "FAILED";
    await evidence.save().catch(() => {});
    throw error;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// getEvidenceForIncident
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return all evidence records for a given incident (by MongoDB _id).
 * Sorted chronologically (oldest first) so chain-of-custody is clear.
 * @param {string|mongoose.Types.ObjectId} incidentMongoId
 * @returns {Promise<Array>}
 */
async function getEvidenceForIncident(incidentMongoId) {
  return Evidence.find({ incidentId: incidentMongoId })
    .populate("collectedBy", "name email role")
    .sort({ collectionTimestamp: 1 })
    .lean();
}

// ─────────────────────────────────────────────────────────────────────────────
// getEvidenceById
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return a single evidence record by evidenceId (EVD-…) or MongoDB _id.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function getEvidenceById(id) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  const query = isObjectId ? { _id: id } : { evidenceId: id };

  return Evidence.findOne(query)
    .populate("collectedBy", "name email role")
    .populate("incidentId", "incidentId title status")
    .lean();
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteEvidence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delete a piece of evidence — only permitted if it has NOT been registered
 * on Hyperledger Fabric (fabricTransactionId === null).
 *
 * @param {string} evidenceId  - EVD-… identifier
 * @param {string} deletedByName - Authenticated user display name (for activity log)
 * @returns {Promise<void>}
 */
async function deleteEvidence(evidenceId, deletedByName = "Unknown") {
  const evidence = await Evidence.findOne({ evidenceId }).lean();

  if (!evidence) {
    const err = new Error("Evidence not found.");
    err.statusCode = 404;
    throw err;
  }

  // ── Blockchain Registration Guard ─────────────────────────────────────────
  if (evidence.fabricTransactionId) {
    const err = new Error(
      "This evidence has been registered on the blockchain and cannot be deleted. Blockchain records are immutable."
    );
    err.statusCode = 403;
    throw err;
  }

  // ── Delete physical file from disk ────────────────────────────────────────
  const diskPath = path.join(EVIDENCE_UPLOAD_DIR, evidence.fileName);
  if (fs.existsSync(diskPath)) {
    fs.unlinkSync(diskPath);
  }

  // ── Remove MongoDB document ───────────────────────────────────────────────
  await Evidence.deleteOne({ evidenceId });

  // ── Append EVIDENCE_DELETED to incident activityHistory ───────────────────
  const incident = await Incident.findById(evidence.incidentId);
  if (incident && incident.status !== "ARCHIVED") {
    const now = new Date();
    const desc = `Evidence ${evidence.evidenceId} (${evidence.originalFileName}) was deleted by ${deletedByName}.`;
    incident.activityHistory.push({
      action:      "EVIDENCE_DELETED",
      description: desc,
      note:        desc,
      performedBy: deletedByName,
      performedAt: now,
      timestamp:   now,
    });
    await incident.save();

    if (ioInstance) {
      ioInstance.emit("incident:updated", incident.toJSON ? incident.toJSON() : incident);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// verifyEvidenceIntegrity (Phase 4 Module 8)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify evidence integrity by retrieving file from IPFS, computing SHA-256,
 * and comparing against Hyperledger Fabric on-chain hash (Phase 4 Module 8).
 *
 * Verification Flow:
 * 1. Retrieve evidence record from MongoDB.
 * 2. Validate evidence is registered on Hyperledger Fabric and has an IPFS CID.
 * 3. Retrieve original evidence file bytes from IPFS using its CID.
 * 4. Calculate SHA-256 of the retrieved file.
 * 5. Query Hyperledger Fabric using evidenceId to retrieve original on-chain hash.
 * 6. Compare: currentHash with blockchainHash.
 *    - IF MATCH: verificationStatus = "VERIFIED"
 *    - IF DIFFERENT: verificationStatus = "TAMPERED"
 *    (Trusted reference is strictly the hash recorded on Hyperledger Fabric, not MongoDB).
 * 7. Store verificationStatus, lastVerifiedAt, lastVerifiedBy in MongoDB.
 *    (Never automatically modify the blockchain record after a mismatch).
 * 8. Add incident activity: EVIDENCE_VERIFIED or EVIDENCE_TAMPER_DETECTED.
 *
 * @param {string} evidenceId - EVD-YYYYMMDD-XXXXXX or MongoDB _id
 * @param {string} [verifiedByName="Analyst"] - Name of verifying user
 * @param {Buffer} [overrideFileBytes=null] - Optional override bytes for testing tampering
 * @returns {Promise<{ evidenceId: string, blockchainHash: string, currentHash: string, verificationStatus: string, lastVerifiedAt: Date, lastVerifiedBy: string }>}
 */
async function verifyEvidenceIntegrity(evidenceId, verifiedByName = "Analyst", overrideFileBytes = null) {
  // 1. Find evidence
  const evidence = await Evidence.findOne({
    $or: [
      { evidenceId },
      ...(typeof evidenceId === "string" && evidenceId.match(/^[0-9a-fA-F]{24}$/)
        ? [{ _id: evidenceId }]
        : []),
    ],
  });

  if (!evidence) {
    const err = new Error(`Evidence '${evidenceId}' not found.`);
    err.statusCode = 404;
    throw err;
  }

  // 2. Validate evidence is registered on Hyperledger Fabric
  if (!evidence.fabricTransactionId || evidence.blockchainStatus !== "REGISTERED") {
    const err = new Error("Cannot verify evidence integrity: Evidence has not been registered on Hyperledger Fabric.");
    err.statusCode = 400;
    throw err;
  }

  if (!evidence.ipfsCid) {
    const err = new Error("Cannot verify evidence integrity: Evidence has not been uploaded to IPFS.");
    err.statusCode = 400;
    throw err;
  }

  // 3. Retrieve original file from IPFS using CID (or override for test)
  let fileBytes;
  if (overrideFileBytes && Buffer.isBuffer(overrideFileBytes)) {
    fileBytes = overrideFileBytes;
  } else {
    fileBytes = await pinataService.retrieveFileFromIPFS(evidence.ipfsCid, evidence);
  }

  if (!fileBytes || fileBytes.length === 0) {
    const err = new Error("Retrieved evidence file from IPFS is empty or unavailable.");
    err.statusCode = 502;
    throw err;
  }

  // 4. Calculate SHA-256 of the retrieved file
  const currentHash = hashService.generateSha256(fileBytes);

  // 5. Query Hyperledger Fabric for original blockchain record
  const blockchainRecord = await fabricService.getEvidenceFromBlockchain(evidence.evidenceId);
  if (!blockchainRecord || !blockchainRecord.sha256Hash) {
    const err = new Error(`Fabric ledger query returned no valid cryptographic record for evidence '${evidence.evidenceId}'.`);
    err.statusCode = 502;
    throw err;
  }

  const blockchainHash = blockchainRecord.sha256Hash;

  // 6. Compare currentHash with blockchainHash (trusted anchor is Fabric)
  const isMatch = currentHash.toLowerCase() === blockchainHash.toLowerCase();
  const verificationStatus = isMatch ? "VERIFIED" : "TAMPERED";
  const now = new Date();

  // 7. Store verificationStatus, lastVerifiedAt, lastVerifiedBy in MongoDB
  evidence.verificationStatus = verificationStatus;
  evidence.lastVerifiedAt     = now;
  evidence.lastVerifiedBy     = verifiedByName;
  await evidence.save();

  // 8. Add activity to parent Incident: EVIDENCE_VERIFIED or EVIDENCE_TAMPER_DETECTED
  const incident = await Incident.findById(evidence.incidentId);
  if (incident && incident.status !== "ARCHIVED") {
    const action = isMatch ? "EVIDENCE_VERIFIED" : "EVIDENCE_TAMPER_DETECTED";
    const desc = isMatch
      ? `Evidence ${evidence.evidenceId} integrity confirmed against Hyperledger Fabric record.`
      : `Evidence ${evidence.evidenceId} hash does not match Hyperledger Fabric record. Tampering detected!`;

    incident.activityHistory.push({
      action,
      description: desc,
      note:        desc,
      performedBy: verifiedByName,
      performedAt: now,
      timestamp:   now,
    });
    await incident.save();

    if (ioInstance) {
      ioInstance.emit("incident:updated", incident.toJSON ? incident.toJSON() : incident);
    }
  }

  // Return required response structure
  return {
    evidenceId:         evidence.evidenceId,
    blockchainHash,
    currentHash,
    verificationStatus,
    lastVerifiedAt:     now,
    lastVerifiedBy:     verifiedByName,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  setEvidenceSocketIO,
  generateEvidenceId,
  collectEvidence,
  getEvidenceForIncident,
  getEvidenceById,
  deleteEvidence,
  registerEvidenceOnFabric,
  verifyEvidenceIntegrity,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  EVIDENCE_UPLOAD_DIR,
};

