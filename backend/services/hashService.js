const crypto   = require("crypto");
const fs       = require("fs");
const path     = require("path");
const Evidence = require("../models/Evidence");

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 Module 2: SHA-256 Evidence Hash Generation Service
//
// The hash service:
// 1. Receives the evidence file (file path, raw Buffer, or Multer file object).
// 2. Reads the file as binary data.
// 3. Generates SHA-256.
// 4. Returns a hexadecimal hash.
// 5. Never modifies the original evidence.
// 6. Stores the generated hash in the Evidence document (MongoDB).
//
// Hash is computed strictly from the exact file bytes:
// - Never hashes only the file name or text description.
// - Never modifies whitespace or encoding before hashing.
// - Uses the exact same file bytes that will later be uploaded to IPFS.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a SHA-256 hexadecimal hash from raw binary data (Buffer).
 *
 * @param {Buffer} binaryData - Raw file bytes
 * @returns {string} 64-character lowercase hexadecimal SHA-256 string
 */
function generateSha256(binaryData) {
  if (!binaryData || !Buffer.isBuffer(binaryData)) {
    throw new Error("Invalid binary data: Buffer is required for cryptographic hashing.");
  }

  console.log("[HASH] Evidence hashing started");
  const hash = crypto.createHash("sha256").update(binaryData).digest("hex");
  console.log("[HASH] SHA-256 generated successfully");

  return hash;
}

/**
 * Step 1-4: Receive the evidence file, read as binary data, generate SHA-256 hex hash.
 * Never modifies the original evidence.
 *
 * @param {Buffer|string|object} fileInput - Buffer, disk path string, or Multer file object
 * @returns {string} 64-character hexadecimal SHA-256 hash
 */
function hashEvidenceFile(fileInput) {
  let binaryData;

  if (Buffer.isBuffer(fileInput)) {
    // Already in-memory binary data
    binaryData = fileInput;
  } else if (typeof fileInput === "string") {
    // Disk path — read raw binary without altering encoding
    if (!fs.existsSync(fileInput)) {
      throw new Error(`Evidence file not found on disk at ${fileInput}`);
    }
    binaryData = fs.readFileSync(fileInput);
  } else if (fileInput && typeof fileInput === "object") {
    if (Buffer.isBuffer(fileInput.buffer)) {
      binaryData = fileInput.buffer;
    } else if (fileInput.path && typeof fileInput.path === "string") {
      binaryData = fs.readFileSync(fileInput.path);
    } else {
      throw new Error("Invalid file object: buffer or path is required.");
    }
  } else {
    throw new Error("Invalid input: evidence file must be a Buffer, file path string, or file object.");
  }

  return generateSha256(binaryData);
}

/**
 * Step 6: Store the generated hash in the Evidence document.
 * Sets hashStatus = "GENERATED" (or "FAILED" on error).
 *
 * @param {string|object} evidenceTarget - Evidence ID (EVD-...), Mongo ObjectId, or Evidence document
 * @param {string} hash - 64-char hexadecimal SHA-256 hash
 * @param {string} [status="GENERATED"] - Status string
 * @returns {Promise<object>} Updated Evidence document
 */
async function storeEvidenceHash(evidenceTarget, hash, status = "GENERATED") {
  let evidence;

  if (evidenceTarget && typeof evidenceTarget.save === "function") {
    evidence = evidenceTarget;
  } else {
    evidence = await Evidence.findOne({
      $or: [
        { evidenceId: evidenceTarget },
        ...(typeof evidenceTarget === "string" && evidenceTarget.match(/^[0-9a-fA-F]{24}$/)
          ? [{ _id: evidenceTarget }]
          : []),
      ],
    });
  }

  if (!evidence) {
    const err = new Error("Evidence document not found.");
    err.statusCode = 404;
    throw err;
  }

  evidence.sha256Hash = hash;
  evidence.hashStatus = status;
  await evidence.save();

  if (status === "GENERATED") {
    console.log("[HASH] Evidence hash stored");
  }

  return evidence;
}

/**
 * End-to-end service function:
 * 1. Receives evidence file.
 * 2. Reads file as binary data.
 * 3. Generates SHA-256.
 * 4. Returns hexadecimal hash.
 * 5. Never modifies original evidence.
 * 6. Stores generated hash in Evidence document (hashStatus = GENERATED).
 *
 * If hashing fails: sets hashStatus = "FAILED" in MongoDB.
 *
 * @param {string|object} evidenceTarget - Evidence ID or document
 * @param {Buffer|string|object} [fileInput] - Evidence file (if omitted, reads from stored disk path)
 * @param {string} [uploadDir] - Custom upload directory
 * @returns {Promise<{ evidenceId: string, sha256Hash: string, hashStatus: string }>}
 */
async function hashAndStoreEvidence(evidenceTarget, fileInput = null, uploadDir = null) {
  let evidence;

  if (evidenceTarget && typeof evidenceTarget.save === "function") {
    evidence = evidenceTarget;
  } else {
    evidence = await Evidence.findOne({
      $or: [
        { evidenceId: evidenceTarget },
        ...(typeof evidenceTarget === "string" && evidenceTarget.match(/^[0-9a-fA-F]{24}$/)
          ? [{ _id: evidenceTarget }]
          : []),
      ],
    });
  }

  if (!evidence) {
    const err = new Error("Evidence document not found.");
    err.statusCode = 404;
    throw err;
  }

  try {
    let input = fileInput;

    // If fileInput was not passed directly, read from disk using evidence.fileName
    if (!input) {
      const storageDir = uploadDir || path.resolve(__dirname, "../uploads/evidence");
      input = path.join(storageDir, evidence.fileName);
    }

    // Step 1 - 4: Read raw binary and compute SHA-256 hex digest
    const hash = hashEvidenceFile(input);

    // Step 6: Store generated hash in Evidence document
    await storeEvidenceHash(evidence, hash, "GENERATED");

    return {
      evidenceId: evidence.evidenceId,
      sha256Hash: evidence.sha256Hash,
      hashStatus: evidence.hashStatus,
    };
  } catch (error) {
    console.error(`[HASH] Hashing failed for evidence ${evidence.evidenceId}:`, error.message);

    try {
      await storeEvidenceHash(evidence, null, "FAILED");
    } catch (dbErr) {
      console.error("[HASH] Failed to record FAILED status:", dbErr.message);
    }

    throw error;
  }
}

/**
 * API Helper: GET /api/evidence/:evidenceId/hash
 * Retrieves { evidenceId, sha256Hash, hashStatus } only.
 * Never exposes original file or server disk paths.
 *
 * @param {string} evidenceId - EVD-YYYYMMDD-XXXXXX or Mongo ObjectId
 * @returns {Promise<{ evidenceId: string, sha256Hash: string, hashStatus: string }>}
 */
async function getEvidenceHash(evidenceId) {
  const evidence = await Evidence.findOne({
    $or: [
      { evidenceId },
      ...(typeof evidenceId === "string" && evidenceId.match(/^[0-9a-fA-F]{24}$/)
        ? [{ _id: evidenceId }]
        : []),
    ],
  }).select("evidenceId sha256Hash hashStatus");

  if (!evidence) {
    const err = new Error("Evidence not found.");
    err.statusCode = 404;
    throw err;
  }

  return {
    evidenceId: evidence.evidenceId,
    sha256Hash: evidence.sha256Hash,
    hashStatus: evidence.hashStatus,
  };
}

module.exports = {
  generateSha256,
  hashEvidenceFile,
  storeEvidenceHash,
  hashAndStoreEvidence,
  getEvidenceHash,
};
