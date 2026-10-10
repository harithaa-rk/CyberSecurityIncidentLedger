const express   = require("express");
const multer    = require("multer");
const path      = require("path");

const router    = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const {
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
} = require("../controllers/evidenceController");
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } = require("../services/evidenceService");

// ─────────────────────────────────────────────────────────────────────────────
// Evidence Routes – Phase 4 Module 1: Digital Evidence Management
//
// Mounted at /api in server.js, so effective paths are:
//   GET    /api/incidents/:incidentId/evidence
//   POST   /api/incidents/:incidentId/evidence
//   GET    /api/evidence/:evidenceId
//   DELETE /api/evidence/:evidenceId
// ─────────────────────────────────────────────────────────────────────────────

// ── Multer – memory storage (files never saved with original name) ─────────────
// Files are held in RAM buffer; evidenceService writes them to disk with a UUID.
// The server filesystem path is never transmitted to the client.
const upload = multer({
  storage: multer.memoryStorage(),

  // ── File size limit (hard-stop before buffer is written) ───────────────────
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 50 MB
    files:    1,
  },

  // ── MIME type whitelist ──────────────────────────────────────────────────────
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        Object.assign(
          new Error(
            `File type '${file.mimetype}' is not permitted. Allowed: PDF, PNG, JPEG, GIF, WEBP, TXT, CSV, JSON, XML, ZIP, PCAP, LOG.`
          ),
          { statusCode: 400 }
        ),
        false
      );
    }
  },
}).single("file");

// ── Multer error-handling wrapper ────────────────────────────────────────────
const uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File exceeds maximum allowed size of 50 MB." });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
    next();
  });
};

// ── All evidence routes require authentication ────────────────────────────────
router.use(["/incidents/:incidentId/evidence", "/evidence"], verifyToken);

// ────────────────────────────────────────────────────────────────────────────
// Incident-scoped Evidence Routes
// These are mounted under /api, so the prefix here must include /incidents/
// ────────────────────────────────────────────────────────────────────────────

// GET /api/incidents/:incidentId/evidence   – list evidence for incident
router.get(
  "/incidents/:incidentId/evidence",
  requireRole("Admin", "Analyst", "Auditor"),
  getIncidentEvidenceHandler
);

// POST /api/incidents/:incidentId/evidence  – upload & collect evidence
router.post(
  "/incidents/:incidentId/evidence",
  requireRole("Admin", "Analyst"),
  uploadMiddleware,
  uploadEvidenceHandler
);

// ────────────────────────────────────────────────────────────────────────────
// Evidence-Scoped Routes
// ────────────────────────────────────────────────────────────────────────────

// GET    /api/evidence/:evidenceId  – single evidence record
router.get(
  "/evidence/:evidenceId",
  requireRole("Admin", "Analyst", "Auditor"),
  getEvidenceByIdHandler
);

// GET    /api/evidence/:evidenceId/hash – retrieve SHA-256 hash & status only
router.get(
  "/evidence/:evidenceId/hash",
  requireRole("Admin", "Analyst", "Auditor"),
  getEvidenceHashHandler
);

// POST   /api/evidence/:evidenceId/upload-ipfs – upload evidence to Pinata/IPFS
router.post(
  "/evidence/:evidenceId/upload-ipfs",
  requireRole("Admin", "Analyst"),
  uploadEvidenceToIpfsHandler
);

// POST   /api/evidence/:evidenceId/register-blockchain – register on Hyperledger Fabric (Phase 4 Module 7)
router.post(
  "/evidence/:evidenceId/register-blockchain",
  requireRole("Admin", "Analyst"),
  registerEvidenceBlockchainHandler
);

// GET    /api/evidence/:evidenceId/blockchain-record – fetch live record & history from Fabric
router.get(
  "/evidence/:evidenceId/blockchain-record",
  requireRole("Admin", "Analyst", "Auditor"),
  getBlockchainRecordHandler
);

// GET    /api/evidence/:evidenceId/view – safe backend/IPFS retrieval mechanism
router.get(
  "/evidence/:evidenceId/view",
  requireRole("Admin", "Analyst", "Auditor"),
  viewEvidenceFileHandler
);

// POST   /api/evidence/:evidenceId/verify – verify evidence integrity against Fabric (Phase 4 Module 8)
router.post(
  "/evidence/:evidenceId/verify",
  requireRole("Admin", "Analyst", "Auditor"),
  verifyEvidenceHandler
);

// DELETE /api/evidence/:evidenceId  – delete (pre-blockchain only)
router.delete(
  "/evidence/:evidenceId",
  requireRole("Admin", "Analyst"),
  deleteEvidenceHandler
);

module.exports = router;
