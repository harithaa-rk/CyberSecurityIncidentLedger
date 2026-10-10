const Incident = require("../models/Incident");
const {
  collectEvidence,
  getEvidenceForIncident,
  getEvidenceById,
  deleteEvidence,
  registerEvidenceOnFabric,
  verifyEvidenceIntegrity,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} = require("../services/evidenceService");
const { getEvidenceHash } = require("../services/hashService");
const { uploadEvidenceToIPFS, getEvidenceFileForViewing } = require("../services/pinataService");
const fabricService = require("../services/fabricService");

// ─────────────────────────────────────────────────────────────────────────────
// Evidence Controller – Phase 4 Module 1: Digital Evidence Management
//
// All user-identity fields are read exclusively from req.user (JWT middleware).
// The frontend is NEVER trusted for: incidentId resolution, evidenceId,
// collectedBy, or collectionTimestamp.
// ─────────────────────────────────────────────────────────────────────────────

// ── Helper: resolve incident by incidentId string OR MongoDB _id ──────────────
async function resolveIncident(incidentParam) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(incidentParam);
  return isObjectId
    ? Incident.findById(incidentParam).select("_id incidentId status assignedTo")
    : Incident.findOne({ incidentId: incidentParam }).select("_id incidentId status assignedTo");
}

// ── Helper: check Analyst is assigned to the incident ────────────────────────
function analystOwnsIncident(incident, userId) {
  const assignedId = incident.assignedTo?._id?.toString() || incident.assignedTo?.toString();
  return assignedId && assignedId === userId.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/incidents/:incidentId/evidence
// @desc    List all evidence records for a given incident
// @access  Protected (Admin / Analyst / Auditor)
// ─────────────────────────────────────────────────────────────────────────────
const getIncidentEvidenceHandler = async (req, res) => {
  try {
    const { incidentId } = req.params;

    // Resolve incident from DB (never trust raw param as final truth)
    const incident = await resolveIncident(incidentId);
    if (!incident) {
      return res.status(404).json({ message: "Incident not found." });
    }

    // Analyst must only see evidence on their assigned incidents
    if (req.user?.role === "Analyst" && !analystOwnsIncident(incident, req.user.id)) {
      return res.status(403).json({
        message: "Access denied. You are not assigned to this incident.",
      });
    }

    const evidenceList = await getEvidenceForIncident(incident._id);

    res.status(200).json({
      incidentId:    incident.incidentId,
      evidenceCount: evidenceList.length,
      evidence:      evidenceList,
    });
  } catch (error) {
    console.error("[EVIDENCE CONTROLLER] getIncidentEvidence error:", error);
    res.status(500).json({ message: "Server error fetching evidence." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/evidence/:evidenceId
// @desc    Get a single evidence record by evidenceId (EVD-…) or _id
// @access  Protected (Admin / Analyst / Auditor)
// ─────────────────────────────────────────────────────────────────────────────
const getEvidenceByIdHandler = async (req, res) => {
  try {
    const { evidenceId } = req.params;

    const evidence = await getEvidenceById(evidenceId);
    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found." });
    }

    // Resolve parent incident for authorization
    const incident = await Incident.findById(evidence.incidentId._id || evidence.incidentId)
      .select("_id incidentId status assignedTo");

    if (req.user?.role === "Analyst" && incident && !analystOwnsIncident(incident, req.user.id)) {
      return res.status(403).json({
        message: "Access denied. You are not assigned to this incident.",
      });
    }

    res.status(200).json({ evidence });
  } catch (error) {
    console.error("[EVIDENCE CONTROLLER] getEvidenceById error:", error);
    res.status(500).json({ message: "Server error fetching evidence." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/incidents/:incidentId/evidence
// @desc    Upload and collect evidence for an incident
// @access  Protected (Admin / Analyst)
// ─────────────────────────────────────────────────────────────────────────────
const uploadEvidenceHandler = async (req, res) => {
  try {
    const { incidentId } = req.params;

    // ── Validate file was provided ──────────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded. Please attach a file." });
    }

    // ── Resolve incident from DB ────────────────────────────────────────────
    const incident = await resolveIncident(incidentId);
    if (!incident) {
      return res.status(404).json({ message: "Incident not found." });
    }

    // ── Analyst authorization ────────────────────────────────────────────────
    if (req.user?.role === "Analyst" && !analystOwnsIncident(incident, req.user.id)) {
      return res.status(403).json({
        message: "Access denied. You can only submit evidence for incidents assigned to you.",
      });
    }

    // ── Reject ARCHIVED ──────────────────────────────────────────────────────
    if (incident.status === "ARCHIVED") {
      return res.status(400).json({
        message: "Cannot attach evidence to an ARCHIVED incident.",
      });
    }

    // ── Read description from body (optional, safe string only) ─────────────
    const description = typeof req.body.description === "string"
      ? req.body.description.trim().slice(0, 2000)
      : "";

    // ── Delegate to service (user identity always from req.user) ─────────────
    const evidence = await collectEvidence({
      incidentMongoId:   incident._id,
      fileBuffer:        req.file.buffer,
      originalName:      req.file.originalname,
      mimeType:          req.file.mimetype,
      fileSize:          req.file.size,
      description,
      collectedByUserId: req.user.id,
      collectedByName:   req.user.name || req.user.email || "Unknown",
    });

    res.status(201).json({
      message:    "Evidence collected and attached to incident successfully.",
      evidenceId: evidence.evidenceId,
      evidence,
    });
  } catch (error) {
    console.error("[EVIDENCE CONTROLLER] uploadEvidence error:", error);
    const status = error.statusCode || 400;
    res.status(status).json({ message: error.message || "Failed to collect evidence." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/evidence/:evidenceId
// @desc    Delete evidence (only if not yet registered on blockchain)
// @access  Protected (Admin / Analyst)
// ─────────────────────────────────────────────────────────────────────────────
const deleteEvidenceHandler = async (req, res) => {
  try {
    const { evidenceId } = req.params;

    // Fetch the evidence first for authorization
    const evidence = await getEvidenceById(evidenceId);
    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found." });
    }

    // Resolve parent incident for analyst authorization
    const incident = await Incident.findById(evidence.incidentId._id || evidence.incidentId)
      .select("_id incidentId status assignedTo");

    if (req.user?.role === "Analyst" && incident && !analystOwnsIncident(incident, req.user.id)) {
      return res.status(403).json({
        message: "Access denied. You can only delete evidence on your assigned incidents.",
      });
    }

    await deleteEvidence(evidenceId, req.user.name || req.user.email || "Unknown");

    res.status(200).json({ message: "Evidence deleted successfully." });
  } catch (error) {
    console.error("[EVIDENCE CONTROLLER] deleteEvidence error:", error);
    const status = error.statusCode || 400;
    res.status(status).json({ message: error.message || "Failed to delete evidence." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/evidence/:evidenceId/hash
// @desc    Retrieve SHA-256 cryptographic hash and status (never exposes file)
// @access  Protected (Admin / Analyst / Auditor)
// ─────────────────────────────────────────────────────────────────────────────
const getEvidenceHashHandler = async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const hashData = await getEvidenceHash(evidenceId);

    // Return strictly { evidenceId, sha256Hash, hashStatus }
    res.status(200).json({
      evidenceId: hashData.evidenceId,
      sha256Hash: hashData.sha256Hash,
      hashStatus: hashData.hashStatus,
    });
  } catch (error) {
    console.error("[EVIDENCE CONTROLLER] getEvidenceHash error:", error);
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || "Failed to retrieve evidence hash." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/evidence/:evidenceId/upload-ipfs
// @desc    Upload existing evidence file to Pinata/IPFS and store CID
// @access  Protected (Admin / Analyst)
// ─────────────────────────────────────────────────────────────────────────────
const uploadEvidenceToIpfsHandler = async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const result = await uploadEvidenceToIPFS(evidenceId);

    // Return strictly required fields: evidenceId, ipfsCid, sha256Hash, storageStatus
    res.status(200).json({
      evidenceId:    result.evidenceId,
      ipfsCid:       result.ipfsCid,
      sha256Hash:    result.sha256Hash,
      storageStatus: result.storageStatus,
    });
  } catch (error) {
    console.error("[EVIDENCE CONTROLLER] uploadEvidenceToIPFS error:", error.message);
    const status = error.statusCode || 500;
    res.status(status).json({
      message:       error.message || "Failed to upload evidence to Pinata/IPFS.",
      storageStatus: "FAILED",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/evidence/:evidenceId/view
// @desc    Safe backend/IPFS retrieval mechanism: view evidence without exposing secrets
// @access  Protected (Admin / Analyst / Auditor)
// ─────────────────────────────────────────────────────────────────────────────
const viewEvidenceFileHandler = async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const fileData = await getEvidenceFileForViewing(evidenceId);

    res.setHeader("Content-Type", fileData.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(fileData.originalFileName)}"`
    );
    if (fileData.fileSize) {
      res.setHeader("Content-Length", fileData.fileSize);
    }
    if (fileData.ipfsCid) {
      res.setHeader("X-IPFS-CID", fileData.ipfsCid);
    }

    fileData.stream.pipe(res);
  } catch (error) {
    console.error("[EVIDENCE CONTROLLER] viewEvidenceFile error:", error.message);
    const status = error.statusCode || 404;
    res.status(status).json({ message: error.message || "Evidence file could not be retrieved." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/evidence/:evidenceId/register-blockchain
// @desc    Register evidence on Hyperledger Fabric (Phase 4 Module 7)
// @access  Protected (Admin / Analyst)
// ─────────────────────────────────────────────────────────────────────────────
const registerEvidenceBlockchainHandler = async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const actorName = req.user?.name || req.user?.email || "appUser";

    const updated = await registerEvidenceOnFabric(evidenceId, actorName);

    res.status(200).json({
      message:             "Evidence registered on Hyperledger Fabric successfully.",
      evidenceId:          updated.evidenceId,
      fabricTransactionId: updated.fabricTransactionId,
      fabricRecordedAt:    updated.fabricRecordedAt,
      blockchainStatus:    updated.blockchainStatus,
      evidence:            updated,
    });
  } catch (error) {
    console.error("[EVIDENCE CONTROLLER] registerEvidenceBlockchain error:", error.message);
    const status = error.statusCode || 400;
    res.status(status).json({ message: error.message || "Failed to register evidence on blockchain." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/evidence/:evidenceId/blockchain-record
// @desc    Fetch live ledger record & transaction history from Hyperledger Fabric
// @access  Protected (Admin / Analyst / Auditor)
// ─────────────────────────────────────────────────────────────────────────────
const getBlockchainRecordHandler = async (req, res) => {
  try {
    const { evidenceId } = req.params;

    const [record, history] = await Promise.all([
      fabricService.getEvidenceFromBlockchain(evidenceId),
      fabricService.getEvidenceHistoryFromBlockchain(evidenceId),
    ]);

    res.status(200).json({
      evidenceId,
      record,
      history,
    });
  } catch (error) {
    console.error("[EVIDENCE CONTROLLER] getBlockchainRecord error:", error.message);
    const status = error.statusCode || 404;
    res.status(status).json({ message: error.message || "Failed to retrieve blockchain record." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/evidence/:evidenceId/verify
// @desc    Verify evidence integrity against Hyperledger Fabric blockchain record
// @access  Protected (Admin / Analyst / Auditor)
// ─────────────────────────────────────────────────────────────────────────────
const verifyEvidenceHandler = async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const verifiedByName = req.user?.name || req.user?.email || "Analyst";

    const result = await verifyEvidenceIntegrity(evidenceId, verifiedByName);

    // Return required response structure
    res.status(200).json({
      evidenceId:         result.evidenceId,
      blockchainHash:     result.blockchainHash,
      currentHash:        result.currentHash,
      verificationStatus: result.verificationStatus,
      lastVerifiedAt:     result.lastVerifiedAt,
      lastVerifiedBy:     result.lastVerifiedBy,
    });
  } catch (error) {
    console.error("[EVIDENCE CONTROLLER] verifyEvidence error:", error.message);
    const status = error.statusCode || 400;
    res.status(status).json({ message: error.message || "Failed to verify evidence integrity." });
  }
};

module.exports = {
  getIncidentEvidenceHandler,
  getEvidenceByIdHandler,
  uploadEvidenceHandler,
  deleteEvidenceHandler,
  getEvidenceHashHandler,
  uploadEvidenceToIpfsHandler,
  viewEvidenceFileHandler,
  registerEvidenceBlockchainHandler,
  getBlockchainRecordHandler,
  verifyEvidenceHandler,
};



