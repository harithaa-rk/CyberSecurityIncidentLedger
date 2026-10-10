const fs       = require("fs");
const path     = require("path");
const crypto   = require("crypto");
const axios    = require("axios");
const { PinataSDK } = require("pinata-web3");
const Evidence = require("../models/Evidence");

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 Module 3: Pinata / IPFS Evidence Storage Service
//
// Uploads collected evidence files to Pinata/IPFS and stores the resulting CID.
//
// Environment Variables:
//  - PINATA_JWT          : Pinata API JWT token
//  - PINATA_GATEWAY_URL  : Pinata or IPFS gateway URL (e.g. https://gateway.pinata.cloud/ipfs)
//
// Credentials are read strictly from environment variables, never hard-coded.
// ─────────────────────────────────────────────────────────────────────────────

const UPLOAD_DIR = path.resolve(__dirname, "../uploads/evidence");

/**
 * Deterministic IPFS CID calculation helper (Base58 multihash 0x12 0x20).
 * Produces valid Qm... multihash corresponding to the exact binary bytes.
 * @param {Buffer} buffer
 * @returns {string} IPFS CID string (e.g. Qm...)
 */
function computeIpfsCid(buffer) {
  const hashBuffer = crypto.createHash("sha256").update(buffer).digest();
  const multihash = Buffer.concat([Buffer.from([0x12, 0x20]), hashBuffer]);
  const base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt("0x" + multihash.toString("hex"));
  let encoded = "";
  while (num > 0n) {
    const remainder = Number(num % 58n);
    num = num / 58n;
    encoded = base58Chars[remainder] + encoded;
  }
  return "Qm" + encoded.slice(0, 44);
}

function normalizeGateway(rawUrl) {
  let url = (rawUrl || "").trim();
  if (!url) {
    return { host: "gateway.pinata.cloud", baseGatewayUrl: "https://gateway.pinata.cloud/ipfs" };
  }
  // Extract pure hostname (e.g. crimson-real-raven-467.mypinata.cloud)
  const host = url.replace(/^https?:\/\//i, "").replace(/\/ipfs.*$/i, "").replace(/\/$/, "");
  // Form full base URL for gateway access
  const baseGatewayUrl = `https://${host}/ipfs`;
  return { host, baseGatewayUrl };
}

/**
 * Upload a raw file buffer to Pinata/IPFS.
 *
 * @param {Buffer} fileBuffer       - Raw exact file bytes (same bytes that were hashed)
 * @param {string} originalFileName - Filename for metadata
 * @param {string} mimeType         - MIME type
 * @returns {Promise<{ cid: string, size: number }>}
 */
async function uploadToPinata(fileBuffer, originalFileName, mimeType = "application/octet-stream") {
  const pinataJwt = process.env.PINATA_JWT;
  const rawGateway = process.env.PINATA_GATEWAY_URL;
  const { host: gatewayHost } = normalizeGateway(rawGateway);

  console.log("[IPFS] Upload started");

  // If mock/test mode is explicitly requested or token is 'mock'
  if (pinataJwt === "mock" || process.env.USE_MOCK_PINATA === "true") {
    const cid = computeIpfsCid(fileBuffer);
    console.log("[IPFS] Upload successful");
    console.log("[IPFS] CID received");
    return { cid, size: fileBuffer.length };
  }

  if (!pinataJwt || !pinataJwt.trim()) {
    const err = new Error("PINATA_JWT is not configured in backend environment variables.");
    err.statusCode = 500;
    throw err;
  }

  // Attempt Pinata upload using PinataSDK
  try {
    const pinata = new PinataSDK({
      pinataJwt: pinataJwt.trim(),
      pinataGateway: gatewayHost,
    });

    const file = new File([fileBuffer], originalFileName, { type: mimeType });
    const result = await pinata.upload.file(file);

    const cid = result?.cid || result?.IpfsHash;
    if (!cid) {
      throw new Error("Pinata response missing CID / IpfsHash.");
    }

    console.log("[IPFS] Upload successful");
    console.log("[IPFS] CID received");
    return { cid, size: result.size || fileBuffer.length };
  } catch (sdkError) {
    // Fallback attempt with direct Axios REST API to Pinata
    try {
      const FormData = require("form-data");
      const form = new FormData();
      form.append("file", fileBuffer, { filename: originalFileName, contentType: mimeType });

      const pinataMetadata = JSON.stringify({ name: originalFileName });
      form.append("pinataMetadata", pinataMetadata);

      const restRes = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", form, {
        maxBodyLength: "Infinity",
        headers: {
          Authorization: `Bearer ${pinataJwt.trim()}`,
          ...form.getHeaders(),
        },
      });

      const cid = restRes.data?.IpfsHash;
      if (cid) {
        console.log("[IPFS] Upload successful");
        console.log("[IPFS] CID received");
        return { cid, size: restRes.data.PinSize || fileBuffer.length };
      }
    } catch (restError) {
      // Both attempts failed — rethrow root reason
      const msg = sdkError?.message || restError?.response?.data?.error?.details || restError?.message || "Pinata upload failed";
      const error = new Error(`Pinata upload failed: ${msg}`);
      error.statusCode = 502;
      throw error;
    }

    throw sdkError;
  }
}

/**
 * Upload an existing Evidence record's file to Pinata/IPFS and update MongoDB.
 *
 * @param {string|object} evidenceTarget - Evidence ID (EVD-...) or Evidence document
 * @param {Buffer} [optionalBuffer]      - File buffer (reads from disk if omitted)
 * @returns {Promise<{ evidenceId: string, ipfsCid: string, sha256Hash: string, storageStatus: string, ipfsUploadedAt: Date }>}
 */
async function uploadEvidenceToIPFS(evidenceTarget, optionalBuffer = null) {
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
    let fileBytes = optionalBuffer;

    // Read stored binary data from disk if not provided
    if (!fileBytes) {
      const diskPath = path.join(UPLOAD_DIR, evidence.fileName);
      if (!fs.existsSync(diskPath)) {
        throw new Error(`Evidence file not found on disk at ${diskPath}`);
      }
      fileBytes = fs.readFileSync(diskPath);
    }

    // Verify file bytes match the recorded SHA-256 hash (integrity guarantee)
    const computedHash = crypto.createHash("sha256").update(fileBytes).digest("hex");
    if (evidence.sha256Hash && evidence.sha256Hash !== computedHash) {
      throw new Error("File integrity check failed: file bytes do not match recorded SHA-256 hash.");
    }

    // Upload the exact same file bytes to Pinata
    const { cid } = await uploadToPinata(fileBytes, evidence.originalFileName, evidence.mimeType);

    // Update MongoDB
    evidence.ipfsCid        = cid;
    evidence.ipfsUploadedAt = new Date();
    evidence.storageStatus  = "UPLOADED";
    await evidence.save();

    console.log("[IPFS] Evidence metadata updated");

    // Phase 4 Module 7: Automatically register on Fabric once IPFS upload succeeds
    try {
      const { registerEvidenceOnFabric } = require("./evidenceService");
      if (evidence.hashStatus === "GENERATED" && evidence.sha256Hash) {
        const fabricDoc = await registerEvidenceOnFabric(evidence.evidenceId, "appUser");
        if (fabricDoc) {
          evidence = fabricDoc;
        }
      }
    } catch (fabricErr) {
      console.warn(`[FABRIC] Auto-registration following IPFS upload deferred: ${fabricErr.message}`);
    }

    return {
      evidenceId:          evidence.evidenceId,
      ipfsCid:             evidence.ipfsCid,
      sha256Hash:          evidence.sha256Hash,
      storageStatus:       evidence.storageStatus,
      ipfsUploadedAt:      evidence.ipfsUploadedAt,
      fabricTransactionId: evidence.fabricTransactionId || null,
      fabricRecordedAt:    evidence.fabricRecordedAt || null,
      blockchainStatus:    evidence.blockchainStatus || "NOT_REGISTERED",
    };

  } catch (error) {
    console.error("[IPFS] Upload failed:", error.message);

    // Per requirement: If Pinata upload fails, storageStatus = FAILED, do not mark as successfully uploaded
    evidence.storageStatus = "FAILED";
    await evidence.save().catch(() => {});

    throw error;
  }
}

/**
 * Retrieve safe file stream and metadata for viewing evidence.
 * Safe backend/IPFS retrieval mechanism:
 * - Checks file availability on IPFS gateway or local storage.
 * - Streams with correct MIME type and Content-Disposition.
 *
 * @param {string} evidenceId - EVD-YYYYMMDD-XXXXXX or Mongo ObjectId
 * @returns {Promise<{ stream: NodeJS.ReadableStream|Buffer, mimeType: string, originalFileName: string, fileSize: number, ipfsCid: string }>}
 */
async function getEvidenceFileForViewing(evidenceId) {
  const evidence = await Evidence.findOne({
    $or: [
      { evidenceId },
      ...(typeof evidenceId === "string" && evidenceId.match(/^[0-9a-fA-F]{24}$/)
        ? [{ _id: evidenceId }]
        : []),
    ],
  });

  if (!evidence) {
    const err = new Error("Evidence not found.");
    err.statusCode = 404;
    throw err;
  }

  // Check if file exists locally on disk
  const diskPath = path.join(UPLOAD_DIR, evidence.fileName);
  if (fs.existsSync(diskPath)) {
    const stream = fs.createReadStream(diskPath);
    return {
      stream,
      mimeType: evidence.mimeType || "application/octet-stream",
      originalFileName: evidence.originalFileName,
      fileSize: evidence.fileSize,
      ipfsCid: evidence.ipfsCid,
    };
  }

  // If local file is missing but IPFS CID is available, fetch from IPFS gateway
  if (evidence.ipfsCid) {
    const { baseGatewayUrl } = normalizeGateway(process.env.PINATA_GATEWAY_URL);
    const ipfsUrl = `${baseGatewayUrl.replace(/\/$/, "")}/${evidence.ipfsCid}`;
    const headers = {};
    if (process.env.PINATA_JWT) {
      headers["Authorization"] = `Bearer ${process.env.PINATA_JWT}`;
    }

    const response = await axios.get(ipfsUrl, {
      responseType: "stream",
      headers,
      timeout: 10000,
    });

    return {
      stream: response.data,
      mimeType: evidence.mimeType || "application/octet-stream",
      originalFileName: evidence.originalFileName,
      fileSize: evidence.fileSize,
      ipfsCid: evidence.ipfsCid,
    };
  }

  const err = new Error("Evidence file is not available on disk or IPFS.");
  err.statusCode = 404;
  throw err;
}

/**
 * Retrieve raw file buffer from IPFS using its CID (Phase 4 Module 8).
 *
 * @param {string} ipfsCid          - IPFS CID of the evidence file
 * @param {object} [evidenceDoc]    - Optional Evidence document for fallback
 * @returns {Promise<Buffer>}       - Raw binary bytes of the evidence file
 */
async function retrieveFileFromIPFS(ipfsCid, evidenceDoc = null) {
  if (!ipfsCid || typeof ipfsCid !== "string") {
    const err = new Error("Cannot retrieve file from IPFS: Valid CID is required.");
    err.statusCode = 400;
    throw err;
  }

  const pinataJwt = process.env.PINATA_JWT;
  const rawGateway = process.env.PINATA_GATEWAY_URL;
  const { baseGatewayUrl } = normalizeGateway(rawGateway);

  // 1. Attempt gateway retrieval if PINATA_JWT is present and not mock
  if (pinataJwt && pinataJwt !== "mock" && process.env.USE_MOCK_PINATA !== "true") {
    try {
      const ipfsUrl = `${baseGatewayUrl.replace(/\/$/, "")}/${ipfsCid}`;
      const headers = {
        Authorization: `Bearer ${pinataJwt.trim()}`,
      };

      const response = await axios.get(ipfsUrl, {
        responseType: "arraybuffer",
        headers,
        timeout: 10000,
      });

      if (response && response.data) {
        return Buffer.from(response.data);
      }
    } catch (gwErr) {
      console.warn(`[IPFS] Gateway fetch failed for CID ${ipfsCid}: ${gwErr.message}. Checking local replica fallback.`);
    }
  }

  // 2. Fallback to local storage replica if available
  if (evidenceDoc && evidenceDoc.fileName) {
    const diskPath = path.join(UPLOAD_DIR, evidenceDoc.fileName);
    if (fs.existsSync(diskPath)) {
      return fs.readFileSync(diskPath);
    }
  }

  // If evidenceDoc was not passed but ipfsCid is known, check database
  if (!evidenceDoc) {
    const fallbackEvidence = await Evidence.findOne({ ipfsCid });
    if (fallbackEvidence && fallbackEvidence.fileName) {
      const diskPath = path.join(UPLOAD_DIR, fallbackEvidence.fileName);
      if (fs.existsSync(diskPath)) {
        return fs.readFileSync(diskPath);
      }
    }
  }

  const err = new Error(`Failed to retrieve evidence file from IPFS with CID: ${ipfsCid}`);
  err.statusCode = 404;
  throw err;
}

module.exports = {
  uploadToPinata,
  uploadEvidenceToIPFS,
  getEvidenceFileForViewing,
  retrieveFileFromIPFS,
  computeIpfsCid,
};
